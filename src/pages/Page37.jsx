import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { getEnvironmentalProtectionData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
const Page37 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const mainRef = useRef(null);
    const tableSummaryRef = useRef(null);
    const [year, setYear] = useState(null);
    const [pageData, setPageData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [isChartInteractive, setIsChartInteractive] = useState(typeof window !== 'undefined' ? window.innerWidth > 768 : true);
    const [selectedSlices, setSelectedSlices] = useState(null);
    const chartRef = useRef(null);
    const lastClickRef = useRef({ time: 0, index: null });
    const topScrollRef = useRef(null);
    
    // Year dropdown state
    const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
    const yearDropdownRef = useRef(null);
    const yearButtonRef = useRef(null);
    const tableScrollRef = useRef(null);

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

    const stripHtml = (text) => text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
    const hexToRgba = (hex, opacity = 1) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
        }
        return hex;
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (isChartInteractive && chartRef.current && !chartRef.current.contains(event.target)) {
                setIsChartInteractive(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isChartInteractive]);

    useEffect(() => {
        if (tableSummaryRef.current) {
            tableSummaryRef.current.focus();
        }
    }, [isTableOpen]);

    const minYear = useMemo(() => pageData.length > 0 ? pageData[0].year : 2018, [pageData]);
    const maxYear = useMemo(() => pageData.length > 0 ? pageData[pageData.length - 1].year : 2022, [pageData]);

    const yearsList = useMemo(() => Array.from(
        { length: maxYear - minYear + 1 },
        (_, i) => minYear + i
    ), [minYear, maxYear]);
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

    // Close dropdown when clicking outside
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
        getEnvironmentalProtectionData()
            .then(data => {
                setPageData(data);
                if (data && data.length > 0) {
                    setYear(data[data.length - 1].year);
                }
            })
            .catch(err => {
                console.error("Failed to load environmental protection data:", err);
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

    const COLORS = {
        'wastewater': '#857550',  
        'soil': '#224397',        
        'air': '#23808B',         
        'solid_waste': '#CA4F0C', 
        'other': '#877312',       
    };

    const CATEGORY_ORDER = ['wastewater', 'soil', 'air', 'solid_waste', 'other'];
    const downloadChartWithTitle = async (plotEl = null) => {
        const plotElement = plotEl || document.querySelector('.page37-chart .js-plotly-plot') || chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement) {
            console.error('Plot element not found');
            alert('Could not find chart element. Please try again.');
            return;
        }
        const chartTitleText = getText('page37_chart_title', lang);
        const subtitle = getText('page37_chart_subtitle', lang);
        const title = `${stripHtml(chartTitleText)} (${year}, ${stripHtml(subtitle)})`;

        try {
            if (!window.Plotly) {
                console.error('Plotly not available on window');
                alert('Plotly library not loaded. Please refresh the page and try again.');
                return;
            }

            const imgData = await window.Plotly.toImage(plotElement, {
                format: 'png',
                width: 1200,
                height: 800,
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
                link.download = lang === 'en' ? `environmental_protection_chart_${year}.png` : `graphique_protection_environnement_${year}.png`;
                link.href = canvas.toDataURL('image/png');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            };

            img.onerror = () => {
                console.error('Failed to load chart image');
                alert('Failed to generate chart image. Please try again.');
            };

            img.src = imgData;
        } catch (error) {
            console.error('Error downloading chart:', error);
            alert('Error downloading chart: ' + error.message);
        }
    };

    const currentYearData = useMemo(() => {
        if (!year || pageData.length === 0) return null;
        return pageData.find(d => d.year === year) || pageData[pageData.length - 1];
    }, [year, pageData]);
    const dynamicValues = useMemo(() => {
        if (!currentYearData) return null;

        const oilGasTotal = currentYearData.oil_gas_total || 0;
        const allIndustriesTotal = currentYearData.all_industries_total || 0;
        const electricTotal = currentYearData.electric_total || 0;
        const naturalGasTotal = currentYearData.natural_gas_total || 0;
        const petroleumTotal = currentYearData.petroleum_total || 0;
        const petroleumPollution = currentYearData.petroleum_pollution || 0;
        const energySectorTotal = oilGasTotal + electricTotal + naturalGasTotal + petroleumTotal;
        const petroleumPollutionPct = petroleumTotal > 0 ? Math.round((petroleumPollution / petroleumTotal) * 100) : 0;
        const energySectorPct = allIndustriesTotal > 0 ? (energySectorTotal / allIndustriesTotal) * 100 : 0;
        const oilGasPct = allIndustriesTotal > 0 ? (oilGasTotal / allIndustriesTotal) * 100 : 0;

        return {
            energySectorTotal,
            energySectorPct,
            oilGasTotal,
            oilGasPct,
            electricTotal,
            petroleumTotal,
            petroleumPollutionPct,
            allIndustriesTotal
        };
    }, [currentYearData]);
    const chartData = useMemo(() => {
        if (!currentYearData) return null;

        const values = [];
        const colors = [];
        const hoverTexts = [];
        const pctDict = {};

        const oilGasTotal = currentYearData.oil_gas_total || 0;
        const millionText = getText('page37_million', lang);

        const catMapping = {
            'wastewater': 'oil_gas_wastewater',
            'soil': 'oil_gas_soil',
            'air': 'oil_gas_air',
            'solid_waste': 'oil_gas_solid_waste',
            'other': 'oil_gas_other'
        };

        const hoverKeys = {
            'wastewater': 'page37_hover_wastewater',
            'soil': 'page37_hover_soil',
            'air': 'page37_hover_air',
            'solid_waste': 'page37_hover_solid_waste',
            'other': 'page37_hover_other'
        };
        const wrapText = (text, maxLength = 30) => {
            if (!text || text.length <= maxLength) return text;
            const words = text.split(' ');
            let currentLine = '';
            let result = '';
            words.forEach(word => {
                if ((currentLine + word).length > maxLength) {
                    result += currentLine.trim() + '<br>';
                    currentLine = word + ' ';
                } else {
                    currentLine += word + ' ';
                }
            });
            return result + currentLine.trim();
        };

        CATEGORY_ORDER.forEach(cat => {
            const value = currentYearData[catMapping[cat]] || 0;
            const pct = oilGasTotal > 0 ? (value / oilGasTotal) * 100 : 0;
            if (value >= 0) {
                values.push(value);
                colors.push(COLORS[cat]);
                pctDict[cat] = pct;
                let catName = getText(hoverKeys[cat], lang);
                if (windowWidth <= 480) {
                    catName = wrapText(catName, 20);
                }

                let hoverText = lang === 'en' 
                    ? `<b>${catName}</b><br>$${value.toLocaleString()} ${millionText}<br>${pct.toFixed(0)}%`
                    : `<b>${catName}</b><br>${value.toLocaleString()} ${millionText}<br>${pct.toFixed(0)}%`;
                hoverTexts.push(hoverText);
            }
        });

        return { values, colors, hoverTexts, total: oilGasTotal, pctDict };
    }, [currentYearData, lang, windowWidth]);
    const pieLabels = useMemo(() => {
        const transKeys = {
            'wastewater': 'page37_cat_wastewater',
            'soil': 'page37_cat_soil',
            'air': 'page37_cat_air',
            'solid_waste': 'page37_cat_solid_waste',
            'other': 'page37_cat_other'
        };
        return CATEGORY_ORDER.map(cat => getText(transKeys[cat], lang));
    }, [lang]);
    const annotations = useMemo(() => {
        if (!chartData) return [];
        const totalBillions = (chartData.total || 0) / 1000;

        const centerText = lang === 'en'
            ? `<b>Total</b><br><b>$${totalBillions.toFixed(0)}B</b>`
            : `<b>Total</b><br><b>${totalBillions.toFixed(0)}</b><br><b>milliards</b>`;

        return [{
            text: centerText, x: 0.5, y: 0.5,
            font: { size: windowWidth <= 480 ? 14 : windowWidth <= 768 ? 16 : 22, color: '#424243', family: 'Arial Black, sans-serif' },
            showarrow: false,
        }];
    }, [chartData, lang, windowWidth]);
    const formatNumber = (val) => {
        if (val >= 1000) {
            return `$${(val / 1000).toFixed(1)} ${lang === 'en' ? 'billion' : 'milliards de dollars'}`;
        }
        return `$${val.toLocaleString()} ${getText('page37_million', lang)}`;
    };
    const formatNumberTable = (val) => {
        return val.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { 
            minimumFractionDigits: 0, 
            maximumFractionDigits: 0 
        });
    };
    const getSubtitleText = () => {
        if (!dynamicValues) return '';
        return `${getText('page37_subtitle_part1', lang)}${formatNumber(dynamicValues.energySectorTotal)}${getText('page37_subtitle_part2', lang)}${year}${getText('page37_subtitle_part3', lang)}${dynamicValues.energySectorPct.toFixed(0)}${getText('page37_subtitle_part4', lang)}`;
    };
    const getChartDataSummary = () => {
        if (!chartData || !currentYearData) return '';
        const millionText = getText('page37_million', lang);
        const categoryNames = {
            'wastewater': 'page37_hover_wastewater',
            'soil': 'page37_hover_soil',
            'air': 'page37_hover_air',
            'solid_waste': 'page37_hover_solid_waste',
            'other': 'page37_hover_other'
        };

        const catMapping = {
            'wastewater': 'oil_gas_wastewater',
            'soil': 'oil_gas_soil',
            'air': 'oil_gas_air',
            'solid_waste': 'oil_gas_solid_waste',
            'other': 'oil_gas_other'
        };

        const parts = CATEGORY_ORDER.map(cat => {
            const value = currentYearData[catMapping[cat]] || 0;
            const pct = chartData.pctDict[cat] || 0;
            const name = stripHtml(getText(categoryNames[cat], lang));
            return `${name}: ${value.toLocaleString()} ${millionText} (${pct.toFixed(0)}%)`;
        });

        const totalText = `${getText('total', lang)}: ${chartData.total.toLocaleString()} ${millionText}`;
        return `${parts.join('. ')}. ${totalText}.`;
    };
const getAccessibleStrings = () => {
    if(!dynamicValues) return { subtitle: '', text: '' };

    const percentWord = lang === 'en' ? 'percent' : 'pour cent';

    const subtitle = `${getText('page37_subtitle_part1', lang)} ${formatNumber(dynamicValues.energySectorTotal)} ${getText('page37_subtitle_part2', lang)} ${year} ${getText('page37_subtitle_part3', lang)} ${dynamicValues.energySectorPct.toFixed(0)} ${percentWord} ${getText('page37_subtitle_part4', lang)}`;

    const text = `${getText('page37_text_part1', lang)} ${formatNumber(dynamicValues.oilGasTotal)} ${getText('page37_text_part2', lang)} ${dynamicValues.oilGasPct.toFixed(0)} ${percentWord} ${getText('page37_text_part3', lang)}`;

    return { subtitle, text };
};

const accessibleStrings = getAccessibleStrings();
const getAccessibleDataTable = () => {
    if (!pageData || pageData.length === 0) return null;

        const categoryLabels = {
            'wastewater': stripHtml(getText('page37_cat_wastewater', lang)),
            'soil': stripHtml(getText('page37_cat_soil', lang)),
            'air': stripHtml(getText('page37_cat_air', lang)),
            'solid_waste': stripHtml(getText('page37_cat_solid_waste', lang)),
            'other': stripHtml(getText('page37_cat_other', lang)),
        };

        const catMapping = {
            'wastewater': 'oil_gas_wastewater',
            'soil': 'oil_gas_soil',
            'air': 'oil_gas_air',
            'solid_waste': 'oil_gas_solid_waste',
            'other': 'oil_gas_other'
        };

        const captionId = 'page37-table-caption';

        return (
            <details 
                open={isTableOpen}
                onToggle={(e) => setIsTableOpen(e.currentTarget.open)}
                className="page37-data-table"
            >
                <summary
                    ref={tableSummaryRef}
                    role="button"
                    aria-expanded={isTableOpen}
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
                    aria-labelledby={captionId}
                    tabIndex="0"
                >
                    <table className="table table-striped table-hover">
                        <caption id={captionId} className="wb-inv">
                            {lang === 'en' 
                                ? 'Oil and gas extraction expenditures per environmental activity (millions of dollars)'
                                : "Dépenses d'extraction de pétrole et de gaz par activité environnementale (millions de dollars)"}
                        </caption>
                        <thead>
                            <tr>
                                <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{lang === 'en' ? 'Year' : 'Année'}</th>
                                {CATEGORY_ORDER.map(cat => (
                                    <th key={cat} scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>
                                        {categoryLabels[cat]}<br/>
                                        <span aria-hidden="true">{lang === 'en' ? '($ millions)' : '(millions $)'}</span>
                                        <span className="wb-inv">{lang === 'en' ? '(millions of dollars)' : '(millions de dollars)'}</span>
                                    </th>
                                ))}
                                <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>
                                    {getText('total', lang)}<br/>
                                    <span aria-hidden="true">{lang === 'en' ? '($ millions)' : '(millions $)'}</span>
                                    <span className="wb-inv">{lang === 'en' ? '(millions of dollars)' : '(millions de dollars)'}</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {pageData.map((yearData, idx) => {
                                const cellUnitSR = lang === 'en' ? ' million dollars' : ' millions de dollars';
                                return (
                                    <tr key={yearData.year}>
                                        <th scope="row" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{yearData.year}</th>
                                        {CATEGORY_ORDER.map(cat => (
                                            <td 
                                                key={cat} 
                                                style={{ textAlign: 'right', border: '1px solid #ddd' }}
                                                aria-label={`${yearData.year}, ${categoryLabels[cat]}: ${formatNumberTable(yearData[catMapping[cat]] || 0)}${cellUnitSR}`}
                                            >
                                                {formatNumberTable(yearData[catMapping[cat]] || 0)}
                                            </td>
                                        ))}
                                        <td 
                                            style={{ textAlign: 'right', border: '1px solid #ddd' }}
                                            aria-label={`${yearData.year}, ${getText('total', lang)}: ${formatNumberTable(yearData.oil_gas_total || 0)}${cellUnitSR}`}
                                        >
                                            <strong>{formatNumberTable(yearData.oil_gas_total || 0)}</strong>
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
                            backgroundColor: '#26374a',
                            border: '1px solid #26374a',
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
                            backgroundColor: '#26374a',
                            border: '1px solid #26374a',
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
        );
    };
    const downloadTableAsCSV = () => {
        if (!pageData || pageData.length === 0) return;

        const categoryLabels = {
            'wastewater': stripHtml(getText('page37_cat_wastewater', lang)),
            'soil': stripHtml(getText('page37_cat_soil', lang)),
            'air': stripHtml(getText('page37_cat_air', lang)),
            'solid_waste': stripHtml(getText('page37_cat_solid_waste', lang)),
            'other': stripHtml(getText('page37_cat_other', lang)),
        };

        const catMapping = {
            'wastewater': 'oil_gas_wastewater',
            'soil': 'oil_gas_soil',
            'air': 'oil_gas_air',
            'solid_waste': 'oil_gas_solid_waste',
            'other': 'oil_gas_other'
        };

        const unitHeader = lang === 'en' ? '($ millions)' : '(millions $)';
        const headers = [
            lang === 'en' ? 'Year' : 'Année',
            ...CATEGORY_ORDER.map(cat => `${categoryLabels[cat]} ${unitHeader}`),
            `Total ${unitHeader}`
        ];
        const rows = pageData.map(yearData => {
            const values = CATEGORY_ORDER.map(cat => yearData[catMapping[cat]] || 0);
            return [yearData.year, ...values, yearData.oil_gas_total || 0];
        });
        const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = lang === 'en' ? 'environmental_protection_expenditures_data.csv' : 'depenses_protection_environnement_donnees.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };
    const downloadTableAsDocx = async () => {
        if (!pageData || pageData.length === 0) return;

        const categoryLabels = {
            'wastewater': stripHtml(getText('page37_cat_wastewater', lang)),
            'soil': stripHtml(getText('page37_cat_soil', lang)),
            'air': stripHtml(getText('page37_cat_air', lang)),
            'solid_waste': stripHtml(getText('page37_cat_solid_waste', lang)),
            'other': stripHtml(getText('page37_cat_other', lang)),
        };

        const catMapping = {
            'wastewater': 'oil_gas_wastewater',
            'soil': 'oil_gas_soil',
            'air': 'oil_gas_air',
            'solid_waste': 'oil_gas_solid_waste',
            'other': 'oil_gas_other'
        };

        const unitHeader = lang === 'en' ? '($ millions)' : '(millions $)';
        const title = stripHtml(getText('page37_title', lang));

        const headers = [
            lang === 'en' ? 'Year' : 'Année',
            ...CATEGORY_ORDER.map(cat => `${categoryLabels[cat]} ${unitHeader}`),
            `Total ${unitHeader}`
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

        const dataRows = pageData.map(yearData => {
            const values = CATEGORY_ORDER.map(cat => yearData[catMapping[cat]] || 0);
            return new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(yearData.year), size: 20 })], alignment: AlignmentType.CENTER })] }),
                    ...values.map(val => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(val), size: 20 })], alignment: AlignmentType.RIGHT })] })),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(yearData.oil_gas_total || 0), bold: true, size: 20 })], alignment: AlignmentType.RIGHT })] })
                ]
            });
        });

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
                        columnWidths: [1200, 1300, 1300, 1300, 1300, 1300, 1300],
                        rows: [headerRow, ...dataRows]
                    })
                ]
            }]
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'environmental_protection_expenditures_table.docx' : 'depenses_protection_environnement_tableau.docx');
    };

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
    }

    if (error) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'red' }}>Error: {error}. Please refresh the page.</div>;
    }

    if (!currentYearData) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>No data available. Please refresh the page.</div>;
    }

    return (
        <main 
            id="main-content"
            ref={mainRef}
            tabIndex="-1"
            className="page-37"
            role="main"
            aria-label={getText('page37_title', lang)}
            style={{ 
                backgroundColor: 'white', 
                flex: '1 1 auto', 
                display: 'flex', 
                flexDirection: 'column',
                boxSizing: 'border-box'
            }}
        >
            <style>{`

                .page-37 {
                    margin-right: -${layoutPadding?.right || 15}px;
                    width: calc(100% + ${layoutPadding?.right || 15}px);
                    padding-right: ${layoutPadding?.right || 15}px; 
                }

                .wb-inv {
                    clip: rect(1px, 1px, 1px, 1px);
                    height: 1px;
                    margin: 0;
                    overflow: hidden;
                    position: absolute;
                    width: 1px;
                }

                .js-plotly-plot .plotly .slice path.textline { display: none !important; }
                .js-plotly-plot .plotly g.slice path[class*="textline"] { display: none !important; }

                .page37-year-selector {
                    display: flex;
                    align-items: center;
                    margin-bottom: 15px;
                    padding: 2px 0;
                }

                .page37-year-label {
                    font-weight: bold;
                    margin-right: 15px;
                    font-size: 18px;
                    font-family: Arial, sans-serif;
                    white-space: nowrap;
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

                .page37-container {
                    width: 100%;
                    padding: 15px 0;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                    min-height: 100%;
                }

                .page37-title {
                    font-family: 'Lato', sans-serif;
                    color: #245e7f;
                    font-size: 50px;
                    margin-top: 0;
                    margin-bottom: 25px;
                    font-weight: bold;
                    margin: 0 0 10px 0;
                    line-height: 1.2;
                    position: relative;
                    padding-bottom: 0.5em;
                }

                .page37-title::after {
                    content: '';
                    position: absolute;
                    left: 0;
                    bottom: 0.2em;
                    width: 72px;
                    height: 6px;
                    background-color: var(--gc-red);
                }

                .page37-subtitle {
                    font-family: 'Noto Sans', sans-serif;
                    color: var(--gc-text);
                    font-size: 20px;
                    margin-bottom: 10px;
                    line-height: 1.5;
                    max-width: 65ch;
                }

                .page37-subtitle:focus,
                .page37-text:focus {
                    outline: none;
                }

                .page37-text {
                    font-family: 'Noto Sans', sans-serif;
                    color: var(--gc-text);
                    font-size: 20px;
                    margin-bottom: 15px;
                    line-height: 1.5;
                    max-width: 65ch;
                }

                .page37-content-row {
                    display: flex;
                    flex-direction: row;
                    flex: 1 1 auto;
                    min-height: 0;
                    align-items: flex-start;
                    gap: 40px;
                }

                .page37-chart-column {
                    width: 55%;
                    height: auto;
                    min-height: auto;
                    position: relative;
                    display: flex;
                    flex-direction: column;
                }

                .page37-chart-area {
                    width: 100%;
                    height: calc(100vh - 550px); 
                    min-height: 400px;
                    margin-bottom: 50px;
                }

                .page37-text-column {
                    width: 40%;
                    padding-top: 20px;
                }

                .page37-chart-title {
                    font-family: 'Lato', sans-serif;
                    font-weight: bold;
                    color: var(--gc-text);
                    font-size: 29px;
                    text-align: center;
                    margin-bottom: 5px;
                }

                .page37-bullets {
                    font-family: 'Noto Sans', sans-serif;
                    color: var(--gc-text);
                    font-size: 20px;
                    line-height: 1.6;
                    padding-left: 20px;
                    list-style-type: disc;
                    max-width: 65ch;
                }

                .page37-bullets li {
                    margin-bottom: 12px;
                }

                .visual-bold {
                    font-weight: bold;
                }

                .page37-data-table {
                    margin-top: 20px;
                    margin-bottom: 0;
                    font-family: Arial, sans-serif;
                    width: 100%;
                }

                .page37-data-table > summary {
                    display: block;
                    width: 100%;
                    padding: 12px 15px;
                    background-color: #26374a;
                    border: 1px solid #26374a;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: bold;
                    color: #ffffff;
                    box-sizing: border-box;
                    list-style: none;
                }

                .page37-data-table > summary::-webkit-details-marker {
                    display: none;
                }

                .page37-data-table > summary:hover {
                    background-color: #1e2a3a;
                }

                .layout-stacked {
                    flex-direction: column !important;
                    height: auto !important;
                    align-items: stretch !important;
                }

                .layout-stacked .page37-chart-column,
                .layout-stacked .page37-text-column {
                    width: 100% !important;
                }

                .layout-stacked .page37-chart-column {
                    height: auto !important;
                    max-height: none !important;
                    margin-bottom: 30px !important;
                }

                .layout-stacked .page37-text-column {
                    padding-top: 0 !important;
                }

                @media (max-width: 1745px) {
                    .page37-content-row {
                        flex-direction: column; 
                        align-items: stretch;
                    }

                    .page37-chart-column,
                    .page37-text-column {
                        width: 100%;
                    }

                    .page37-chart-column {
                        margin-bottom: 30px;
                    }

                    .page37-chart-area {
                        height: 500px;
                    }

                    .page37-text-column {
                        padding-top: 10px;
                    }
                }

                @media (max-width: 1536px) {
                    .page37-title {
                        font-size: 2rem;
                    }

                    .page37-chart-column {
                        height: auto;
                        max-height: none;
                    }

                    .page37-text-column {
                        padding-top: 0;
                    }
                }

                @media (max-width: 1280px) {
                    .page37-title {
                        font-size: 1.8rem;
                    }
                    .page37-chart-column {
                        height: auto;
                    }
                    .page37-chart-area {
                        height: 550px;
                    }
                }

                @media (max-width: 960px) {
                    .page37-year-ticks {
                        display: none !important;
                    }
                }

               @media (max-width: 768px) {
                    .page-37 {
                        border-right: none !important;
                    }
                    .page37-title {
                        font-size: 37px;
                    }
                    .page37-subtitle {
                        font-size: 18px;
                    }
                    .page37-text {
                        font-size: 18px;
                    }
                    .page37-chart-title {
                        font-size: 26px;
                    }
                    .page37-bullets {
                        font-size: 18px;
                    }
                    .page37-year-selector {
                        flex-direction: column !important;
                        align-items: flex-start !important;
                    }
                    .page37-year-label {
                        margin-bottom: 10px;
                        margin-right: 0;
                    }
                    
                    .page37-chart-area {
                        height: 400px;
                    }

                    .page37-chart-column {
                        height: auto !important;
                        min-height: 400px;
                        margin-bottom: 0 !important; 
                    }
                }

                @media (max-width: 640px) {
                    .page37-chart-area {
                        height: 360px;
                    }
                    .page37-chart-column {
                        height: auto !important;
                    }
                }

                @media (max-width: 480px) {
                    .page37-chart-area {
                        height: 460px;
                    }
                    .page37-chart-column {
                        height: auto !important;
                    }
                    .page37-title {
                        font-size: 1.3rem;
                    }
                }

                @media (max-width: 384px) {
                   .page37-chart-area {
                        height: 460px;
                    }
                    .page37-chart-column {
                        height: auto !important;
                    }
                }

                details summary::-webkit-details-marker,
                details summary::marker {
                    display: none;
                }

                .page37-chart-frame {
                    background-color: #f5f5f5;
                    padding: 20px;
                    border-radius: 8px;
                    box-sizing: border-box;
                    overflow: visible;
                }

                .page37-table-wrapper {
                    display: block;
                    width: 100%;
                    margin: 0;
                }

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

            <div className="page37-container">
                <header role="region" aria-label={getText('page37_title', lang)}>
                    <h1 className="page37-title">
                        {getText('page37_title', lang)}
                    </h1>

                    {dynamicValues && (
                        <>
                            <p 
                                className="page37-subtitle"
                                role="region"
                                aria-label={accessibleStrings.subtitle}
                                tabIndex="0"
                            >
                                <span aria-hidden="true">
                                    {getText('page37_subtitle_part1', lang)}
                                    <span className="visual-bold">{formatNumber(dynamicValues.energySectorTotal)}</span>
                                    {getText('page37_subtitle_part2', lang)}
                                    {year}
                                    {getText('page37_subtitle_part3', lang)}
                                    <span className="visual-bold">{dynamicValues.energySectorPct.toFixed(0)}%</span>
                                    {getText('page37_subtitle_part4', lang)}
                                </span>
                            </p>
                            <p 
                                className="page37-text"
                                role="region"
                                aria-label={accessibleStrings.text}
                                tabIndex="0"
                            >
                                <span aria-hidden="true">
                                    {getText('page37_text_part1', lang)}
                                    <span className="visual-bold">{formatNumber(dynamicValues.oilGasTotal)}</span>
                                    {getText('page37_text_part2', lang)}
                                    <span className="visual-bold">{dynamicValues.oilGasPct.toFixed(0)}%</span>
                                    {getText('page37_text_part3', lang)}
                                </span>
                            </p>
                        </>
                    )}
                </header>
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
                <div className={`page37-content-row ${isTableOpen ? 'layout-stacked' : ''}`}>
                    <div className="page37-chart-column">
                        <div className="page37-chart-frame">
                        <h2 
                            className="page37-chart-title"
                            role="region"
                            aria-label={`${stripHtml(getText('page37_chart_title', lang))} (${year}, ${lang === 'en' ? 'millions of dollars' : 'millions de dollars'})`}
                            tabIndex="0"
                        >
                            <span aria-hidden="true">
                                {getText('page37_chart_title', lang)}
                                <br />
                                ({year}, {getText('page37_chart_subtitle', lang)})
                            </span>
                        </h2>

                        {chartData && (
                            <div 
                                role="region"
                                className="page37-chart-area" 
                                aria-label={`${lang === 'en' ? 'Environmental protection expenditures pie chart for' : 'Graphique circulaire des dépenses de protection de l\'environnement pour'} ${year}. ${getChartDataSummary()}. ${lang === 'en' ? 'Expand the data table below for detailed values.' : 'Développez le tableau de données ci-dessous pour les valeurs détaillées.'}`}
                                style={{ width: '100%' }} 
                                tabIndex="0"
                            >
                                <figure ref={chartRef} className="page37-chart" style={{ width: '100%', height: '100%', margin: 0, position: 'relative' }}>
                                    {selectedSlices !== null && (
                                        <button onClick={() => setSelectedSlices(null)} style={{ position: 'absolute', top: 0, right: 295, zIndex: 20 }}>{lang === 'en' ? 'Clear' : 'Effacer'}</button>
                                    )}
                                    <div aria-hidden="true">
                                    <Plot
                                        key={`pie-${selectedSlices ? selectedSlices.join('-') : 'none'}`}
                                        data={[{
                                            values: chartData.values,
                                            labels: pieLabels,
                                            hole: 0.60,
                                            type: 'pie',
                                            marker: { 
                                                colors: (() => {
                                                    if (selectedSlices === null) return chartData.colors;
                                                    return chartData.colors.map((color, i) => {
                                                        if (selectedSlices.includes(i)) return color;
                                                        return hexToRgba(color, 0.3);
                                                    });
                                                })(), 
                                                line: { color: 'white', width: 2 }
                                            },
                                            texttemplate: windowWidth <= 768 ? '%{percent:.0%}' : '%{label}<br><b>%{value:,.0f}</b>',
                                            textinfo: windowWidth <= 768 ? 'percent' : 'label+value',
                                            textposition: 'outside',
                                            textfont: { 
                                                size: windowWidth <= 480 ? 11 : windowWidth <= 768 ? 12 : windowWidth <= 1280 ? 15 : 18, 
                                                family: 'Arial, sans-serif',
                                                color: (() => {
                                                    if (selectedSlices === null) return chartData.colors;
                                                    return chartData.colors.map((color, i) => {
                                                        if (selectedSlices.includes(i)) return color;
                                                        return hexToRgba(color, 0.3);
                                                    });
                                                })()
                                            },
                                            outsidetextfont: { 
                                                color: (() => {
                                                    if (selectedSlices === null) return chartData.colors;
                                                    return chartData.colors.map((color, i) => {
                                                        if (selectedSlices.includes(i)) return color;
                                                        return hexToRgba(color, 0.3);
                                                    });
                                                })()
                                            },
                                            hovertext: chartData.hoverTexts, 
                                            hoverinfo: 'text',
                                            hoverlabel: { bgcolor: 'white', font: { size: 14, family: 'Arial, sans-serif' } },
                                            direction: 'clockwise', 
                                            sort: false, 
                                            rotation: 330,
                                            pull: (() => {
                                                if (selectedSlices === null) return chartData.values.map(() => 0.02);
                                                return chartData.values.map((_, i) => selectedSlices.includes(i) ? 0.08 : 0.02);
                                            })(),
                                            automargin: true
                                        }]}
                                        layout={{
                                            showlegend: windowWidth <= 768,
                                            legend: windowWidth <= 768 ? (
                                                windowWidth <= 480 ? {
                                                    orientation: 'h',
                                                    y: -0.10,
                                                    x: 0.6,
                                                    xanchor: 'center',
                                                    yanchor: 'top',
                                                    font: { size: 9 },
                                                    itemwidth: 30,
                                                    itemclick: false,
                                                    itemdoubleclick: false
                                                } : {
                                                    orientation: 'v',
                                                    y: 0.5,
                                                    x: 1.02,
                                                    xanchor: 'left',
                                                    yanchor: 'middle',
                                                    font: { size: 12 },
                                                    itemclick: false,
                                                    itemdoubleclick: false
                                                }
                                            ) : undefined,
                                            margin: windowWidth <= 480
                                                ? { l: 0, r: 0, t: 5, b: 140 }
                                                : windowWidth <= 768 
                                                    ? { l: 0, r: 0, t: 10, b: 10 }
                                                    : { l: 0, r: 0, t: 30, b: 30 },
                                            paper_bgcolor: 'rgba(0,0,0,0)', 
                                            plot_bgcolor: 'rgba(0,0,0,0)',
                                            autosize: true, 
                                            annotations: annotations,
                                            clickmode: 'event',
                                            dragmode: windowWidth <= 768 ? false : 'zoom'
                                        }}
                                        useResizeHandler={true}
                                        style={{ width: '100%', height: '100%' }}
                                        onClick={(data) => {
                                            if (!data.points || data.points.length === 0) return;
                                            const clickedPoint = data.points[0];
                                            const sliceIndex = clickedPoint.pointNumber !== undefined ? clickedPoint.pointNumber : clickedPoint.pointIndex;

                                            if (sliceIndex === undefined) return;
                                            if (windowWidth <= 768) {
                                                const currentTime = new Date().getTime();
                                                const lastClick = lastClickRef.current;
                                                const isSamePoint = (sliceIndex === lastClick.index);
                                                const isDoubleTap = isSamePoint && (currentTime - lastClick.time < 300);
                                                
                                                lastClickRef.current = { time: currentTime, index: sliceIndex };
                                                
                                                if (!isDoubleTap) {
                                                    return; // Single tap: show hover label only
                                                }
                                            }

                                            setSelectedSlices(prev => {
                                                if (prev === null) {
                                                    return [sliceIndex];
                                                }

                                                const isSelected = prev.includes(sliceIndex);

                                                if (isSelected) {
                                                    const newSelection = prev.filter(p => p !== sliceIndex);
                                                    if (newSelection.length === 0) {
                                                        return null;
                                                    }
                                                    return newSelection;
                                                } else {
                                                    return [...prev, sliceIndex];
                                                }
                                            });
                                        }}
                                        config={{ 
                                            displayModeBar: true, 
                                            displaylogo: false,
                                            responsive: true, 
                                            staticPlot: false,
                                            modeBarButtonsToRemove: ['toImage', 'select2d', 'lasso2d'],
                                            modeBarButtonsToAdd: [{
                                                name: lang === 'en' ? 'Download chart as PNG' : 'Télécharger le graphique en PNG',
                                            icon: {
                                                width: 24,
                                                height: 24,
                                                path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z'
                                            },
                                                click: (gd) => downloadChartWithTitle(gd)
                                            }]
                                        }}
                                    />
                                    </div>
                                </figure>
                            </div>
                        )}

                        <div className="page37-table-wrapper">
                            {getAccessibleDataTable()}
                        </div>
                        </div> {/* End chart-frame */}
                    </div>
                    <div className="page37-text-column">

                        {dynamicValues && (
                            <ul className="page37-bullets" role="list">
                                <li role="listitem" aria-label={lang === 'en'
                                    ? `Electric power generation, transmission and distribution invested ${formatNumber(dynamicValues.electricTotal)} on environmental protection measures.`
                                    : `Les secteurs de production, le transport et la distribution d'électricité ont investi ${formatNumber(dynamicValues.electricTotal)} dans des mesures de protection de l'environnement.`
                                }>
                                    <span aria-hidden="true">
                                        {getText('page37_bullet1_part1', lang)}
                                        <span className="visual-bold">{formatNumber(dynamicValues.electricTotal)}</span>
                                        {getText('page37_bullet1_part2', lang)}
                                    </span>
                                </li>
                                <li role="listitem" aria-label={lang === 'en'
                                    ? `Petroleum and coal product manufacturing invested ${formatNumber(dynamicValues.petroleumTotal)} in environmental protection activities, with the largest percentage of spending (${dynamicValues.petroleumPollutionPct}%) in pollution abatement and control.`
                                    : `Le secteur de fabrication de produits du pétrole et du charbon a investi ${formatNumber(dynamicValues.petroleumTotal)} dans des activités de protection de l'environnement, dont le pourcentage le plus élevé des dépenses (${dynamicValues.petroleumPollutionPct} %) a été consacré à la réduction et au contrôle de la pollution.`
                                }>
                                    <span aria-hidden="true">
                                        {getText('page37_bullet2_part1', lang)}
                                        <span className="visual-bold">{formatNumber(dynamicValues.petroleumTotal)}</span>
                                        {getText('page37_bullet2_part2', lang)}
                                        {dynamicValues.petroleumPollutionPct}
                                        {getText('page37_bullet2_part3', lang)}
                                    </span>
                                </li>
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
};

export default Page37;
