import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { getInfrastructureData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

const Page25Stacked = () => {
    const { lang, layoutPadding } = useOutletContext();
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
    const tableScrollRef = useRef(null);
    
    // Year selector state
    const [isYearSelectorOpen, setIsYearSelectorOpen] = useState(false);
    const yearSelectorRef = useRef(null);
    const yearButtonRef = useRef(null);

    // Close year selector when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (yearSelectorRef.current && !yearSelectorRef.current.contains(event.target)) {
                setIsYearSelectorOpen(false);
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

    const stripHtml = (text) => text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
    const hexToRgba = (hex, opacity = 1) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
        }
        return hex;
    };

    const minYear = useMemo(() => pageData.length > 0 ? pageData[0].year : 2007, [pageData]);
    const maxYear = useMemo(() => pageData.length > 0 ? pageData[pageData.length - 1].year : 2024, [pageData]);

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

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (windowWidth <= 768 && isChartInteractive && chartRef.current && !chartRef.current.contains(event.target)) {
                setIsChartInteractive(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isChartInteractive]);

    useEffect(() => {
        getInfrastructureData()
            .then(data => {
                setPageData(data);
                if (data && data.length > 0) {
                    setYear(data[data.length - 1].year);
                }
            })
            .catch(err => {
                console.error("Failed to load infrastructure data:", err);
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
        'environmental': '#e9d259', 'fuel_energy_pipelines': '#6cbe8d',
        'transport': '#2DA6B4', 'education': '#597DD9',
        'health_housing': '#857550', 'public_safety': '#f58445',
    };

    const CATEGORY_ORDER = ['environmental', 'fuel_energy_pipelines', 'transport', 'education', 'health_housing', 'public_safety'];
    const downloadChartWithTitle = async (plotEl = null) => {
        const plotElement = plotEl || document.querySelector('.page25h-chart .js-plotly-plot') || chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement) {
            console.error('Plot element not found');
            alert('Could not find chart element. Please try again.');
            return;
        }

        const title = `${stripHtml(getText('page25_title', lang))} (${year})`;

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
                link.download = lang === 'en' ? `infrastructure_chart_${year}.png` : `graphique_infrastructures_${year}.png`;
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

    const chartData = useMemo(() => {
        if (!currentYearData) return null;
        const total = currentYearData.total;
        const values = [];
        const colors = [];
        const hoverTexts = [];
        const pctDict = {};

        const hoverKeys = {
            'environmental': 'hover_environmental', 'fuel_energy_pipelines': 'hover_fuel_energy',
            'transport': 'hover_transport', 'education': 'hover_education',
            'health_housing': 'hover_health_housing', 'public_safety': 'hover_public_safety',
        };
        const billionText = getText('billion', lang);

        CATEGORY_ORDER.forEach(cat => {
            const value = currentYearData[cat] || 0;
            const pct = total > 0 ? (value / total) * 100 : 0;
            if (value >= 0) { 
                values.push(value);
                colors.push(COLORS[cat]);
                pctDict[cat] = pct;
                const catName = getText(hoverKeys[cat], lang);
                const valueBillions = value / 1000;
                let hoverText = lang === 'en' 
                    ? `<b>${catName}</b><br>$${valueBillions.toFixed(1)} ${billionText}<br>${pct.toFixed(0)}%`
                    : `<b>${catName}</b><br>${valueBillions.toFixed(1)} $ ${billionText}<br>${pct.toFixed(0)}%`;
                hoverTexts.push(hoverText);
            }
        });
        return { values, colors, hoverTexts, total, pctDict };
    }, [currentYearData, lang]);

    const pieLabels = useMemo(() => {
        const transKeys = {
            'environmental': 'infra_environmental', 'fuel_energy_pipelines': 'infra_fuel_energy',
            'transport': 'infra_transport', 'education': 'infra_education',
            'health_housing': 'infra_health_housing', 'public_safety': 'infra_public_safety',
        };
        return CATEGORY_ORDER.map(cat => {
            const labelText = getText(transKeys[cat], lang);
            return labelText;
        });
    }, [lang]);

    const annotations = useMemo(() => {
        if (!chartData || !chartData.pctDict) return [];
        const totalBillions = (chartData.total || 0) / 1000;

        const centerText = lang === 'en'
            ? `<b>Total</b><br><b>$${totalBillions.toFixed(0)}</b><br><b>billion</b>`
            : `<b>Total</b><br><b>${totalBillions.toFixed(0)} $</b><br><b>milliards</b>`;

        return [{
            text: centerText, x: 0.5, y: 0.54,
            font: { size: 22, color: '#424243', family: 'Arial Black, sans-serif' },
            showarrow: false,
        }];
    }, [chartData, lang]);

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
    }

    if (error) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'red' }}>Error: {error}. Please refresh the page.</div>;
    }

    if (!currentYearData) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>No data available. Please refresh the page.</div>;
    }

    const getSubtitleText = () => {
        if (!currentYearData) return '';
        const fuelPct = ((currentYearData['fuel_energy_pipelines'] || 0) / currentYearData.total) * 100;
        const fuelValueBillions = (currentYearData['fuel_energy_pipelines'] || 0) / 1000;
        const billionText = getText('billion', lang);
        const dollarsText = lang === 'en' ? 'dollars' : 'dollars';
        const valueDisplay = `(${fuelValueBillions.toFixed(1)} ${billionText} ${dollarsText})`;

        return `${getText('page25_subtitle_part1', lang).replace(/<br>/g, ' ')} ${getText('page25_subtitle_part2', lang).replace(/\n/g, ' ')} ${fuelPct.toFixed(1)}% ${getText('page25_subtitle_part3', lang)} ${year} ${valueDisplay}${getText('page25_subtitle_part4', lang)}`;
    };

    const getSubtitle = () => {
        if (!currentYearData) return null;
        const fuelPct = ((currentYearData['fuel_energy_pipelines'] || 0) / currentYearData.total) * 100;
        const fuelValueBillions = (currentYearData['fuel_energy_pipelines'] || 0) / 1000;
        const billionText = getText('billion', lang);
        const valueDisplay = lang === 'en'
            ? `($${fuelValueBillions.toFixed(1)} ${billionText})`
            : `(${fuelValueBillions.toFixed(1)} $ ${billionText})`;

        return (
            <span>
                <strong>{getText('page25_subtitle_part1', lang)}</strong>
                {getText('page25_subtitle_part2', lang)}
                <strong>{fuelPct.toFixed(1)}%</strong>
                {getText('page25_subtitle_part3', lang)}
                <strong>{year}</strong>
                {' '}
                <strong>{valueDisplay}</strong>
                {getText('page25_subtitle_part4', lang)}
            </span>
        );
    };

    const getChartDataSummary = () => {
        if (!chartData || !currentYearData) return '';
        const billionText = getText('billion', lang);
        const dollarsText = lang === 'en' ? 'dollars' : 'dollars';
        const categoryNames = {
            'environmental': 'hover_environmental',
            'fuel_energy_pipelines': 'hover_fuel_energy',
            'transport': 'hover_transport',
            'education': 'hover_education',
            'health_housing': 'hover_health_housing',
            'public_safety': 'hover_public_safety'
        };

        const parts = CATEGORY_ORDER.map(cat => {
            const value = currentYearData[cat] || 0;
            const pct = chartData.pctDict[cat] || 0;
            const name = getText(categoryNames[cat], lang).replace(/<br>/g, ' ');
            const valueBillions = (value / 1000).toFixed(1);
            return `${name}: ${valueBillions} ${billionText} ${dollarsText} (${pct.toFixed(1)}%)`;
        });

        const totalBillions = (chartData.total / 1000).toFixed(1);
        const totalText = `${getText('total', lang)}: ${totalBillions} ${billionText} ${dollarsText}`;

        return `${parts.join('. ')}. ${totalText}.`;
    };

    const getRightSideText = () => {
        const title = getText('infra_definition_title', lang).replace(/\n/g, ' ');
        const quote = getText('infra_definition_text', lang).replace(/\n/g, ' ');
        const description = getText('infra_description', lang).replace(/\n/g, ' ');
        return `${title} "${quote}" ${description}`;
    };

    const formatNumberTable = (val) => {
        return val.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { 
            minimumFractionDigits: 1, 
            maximumFractionDigits: 1 
        });
    };

    const getAccessibleDataTable = () => {
        if (!pageData || pageData.length === 0) return null;

        const categoryLabels = {
            'environmental': stripHtml(getText('infra_environmental', lang)),
            'fuel_energy_pipelines': stripHtml(getText('infra_fuel_energy', lang)),
            'transport': stripHtml(getText('infra_transport', lang)),
            'education': stripHtml(getText('infra_education', lang)),
            'health_housing': stripHtml(getText('infra_health_housing', lang)),
            'public_safety': stripHtml(getText('infra_public_safety', lang)),
        };

        const cellUnitSR = lang === 'en' ? ' billion dollars' : ' milliards de dollars';
        const headerUnitVisual = lang === 'en' ? '($ billions)' : '(milliards $)';
        const headerUnitSR = lang === 'en' ? '(billions of dollars)' : '(milliards de dollars)';
        const captionId = 'page25h-table-caption';

        return (
            <details 
                onToggle={(e) => setIsTableOpen(e.currentTarget.open)}
                style={{ 
                    marginTop: '10px', 
                    marginBottom: '10px', 
                    width: '100%',
                    marginLeft: 0,
                    marginRight: 0,
                    fontFamily: 'Arial, sans-serif'
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
                        backgroundColor: '#fff',
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
                                ? 'Capital expenditures on construction in infrastructure (billions of dollars)'
                                : 'Dépenses en immobilisations pour la construction d\'infrastructures (milliards de dollars)'}
                        </caption>
                        <thead>
                            <tr>
<th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{lang === 'en' ? 'Year' : 'Année'}</th>
                                                {CATEGORY_ORDER.map(cat => (
                                                    <th key={cat} scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>
                                                        {categoryLabels[cat]}<br/>
                                                        <span aria-hidden="true">{headerUnitVisual}</span>
                                                        <span className="wb-inv">{headerUnitSR}</span>
                                                    </th>
                                                ))}
                                                <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>
                                                    {lang === 'en' ? 'Total' : 'Total'}<br/>
                                                    <span aria-hidden="true">{headerUnitVisual}</span>
                                                    <span className="wb-inv">{headerUnitSR}</span>
                                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {pageData.map(yearData => (
                                <tr key={yearData.year}>
<th scope="row" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{yearData.year}</th>
                                                    {CATEGORY_ORDER.map(cat => (
                                                        <td 
                                                            key={cat} 
                                                            style={{ textAlign: 'right', border: '1px solid #ddd' }}
                                                            aria-label={`${yearData.year}, ${categoryLabels[cat]}: ${formatNumberTable((yearData[cat] || 0) / 1000)}${cellUnitSR}`}
                                                        >
                                                            {formatNumberTable((yearData[cat] || 0) / 1000)}
                                                        </td>
                                                    ))}
                                                    <td 
                                                        style={{ textAlign: 'right', border: '1px solid #ddd' }}
                                                        aria-label={`${yearData.year}, ${lang === 'en' ? 'Total' : 'Total'}: ${formatNumberTable((yearData.total || 0) / 1000)}${cellUnitSR}`}
                                                    >
                                                        <strong>{formatNumberTable((yearData.total || 0) / 1000)}</strong>
                                                    </td>
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
        );
    };
    const downloadTableAsCSV = () => {
        if (!pageData || pageData.length === 0) return;

        const categoryLabels = {
            'environmental': stripHtml(getText('infra_environmental', lang)),
            'fuel_energy_pipelines': stripHtml(getText('infra_fuel_energy', lang)),
            'transport': stripHtml(getText('infra_transport', lang)),
            'education': stripHtml(getText('infra_education', lang)),
            'health_housing': stripHtml(getText('infra_health_housing', lang)),
            'public_safety': stripHtml(getText('infra_public_safety', lang)),
        };

        const unitHeader = lang === 'en' ? '($ billions)' : '(milliards $)';
        const headers = [
            lang === 'en' ? 'Year' : 'Année',
            ...CATEGORY_ORDER.map(cat => `${categoryLabels[cat]} ${unitHeader}`),
            `Total ${unitHeader}`
        ];
        const rows = pageData.map(yearData => {
            let total = 0;
            const values = CATEGORY_ORDER.map(cat => {
                const val = (yearData[cat] || 0) / 1000;
                total += val;
                return val.toFixed(2);
            });
            return [yearData.year, ...values, ((yearData.total || 0) / 1000).toFixed(2)];
        });
        const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = lang === 'en' ? 'infrastructure_expenditures_data.csv' : 'depenses_infrastructures_donnees.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };
    const downloadTableAsDocx = async () => {
        if (!pageData || pageData.length === 0) return;

        const categoryLabels = {
            'environmental': stripHtml(getText('infra_environmental', lang)),
            'fuel_energy_pipelines': stripHtml(getText('infra_fuel_energy', lang)),
            'transport': stripHtml(getText('infra_transport', lang)),
            'education': stripHtml(getText('infra_education', lang)),
            'health_housing': stripHtml(getText('infra_health_housing', lang)),
            'public_safety': stripHtml(getText('infra_public_safety', lang)),
        };

        const unitHeader = lang === 'en' ? '($ billions)' : '(milliards $)';
        const title = stripHtml(getText('page25_title', lang));

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
            const values = CATEGORY_ORDER.map(cat => ((yearData[cat] || 0) / 1000).toFixed(2));
            return new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(yearData.year), size: 20 })], alignment: AlignmentType.CENTER })] }),
                    ...values.map(val => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: val, size: 20 })], alignment: AlignmentType.RIGHT })] })),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: ((yearData.total || 0) / 1000).toFixed(2), bold: true, size: 20 })], alignment: AlignmentType.RIGHT })] })
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
                        columnWidths: [1100, 1150, 1150, 1150, 1150, 1150, 1150, 1150],
                        rows: [headerRow, ...dataRows]
                    })
                ]
            }]
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'infrastructure_expenditures_table.docx' : 'depenses_infrastructures_tableau.docx');
    };

    return (
        <main 
            id="main-content"
            tabIndex="-1"
            className="page-content page-25h" 
            role="main"
            aria-label={getText('page25_title', lang)}
            style={{
                backgroundColor: 'white', 
                flex: '1 1 auto', 
                display: 'flex',
                flexDirection: 'column',
                overflowX: 'visible',
                overflowY: 'visible',
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

                .page-25h {
                    margin-right: -${layoutPadding?.right || 15}px;
                    width: calc(100% + ${layoutPadding?.right || 15}px);
                    padding-right: ${layoutPadding?.right || 15}px; 
                }

                .page25h-container {
                    width: 100%;
                    padding: 0; 
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                    min-height: 100%;
                }

                /* ALWAYS COLUMN LAYOUT - No media query switching */
                .page25h-content-row {
                    display: flex;
                    flex-direction: column;
                    flex: 1 1 auto;
                    min-height: 0;
                    align-items: center;
                    gap: 20px;
                }

                .page25h-slider-region {
                    width: 100%;
                    position: relative;
                    z-index: 50;
                }
                .page25h-slider-track { flex: 1; }

                .page25h-chart-column {
                    width: 100%;
                    height: auto;
                    min-height: 500px;
                    max-height: none;
                    position: relative;
                    margin-bottom: 30px;
                    overflow: visible;
                }

                .page25h-chart-column details {
                    width: 100%;
                    position: relative;
                    z-index: 50;
                }

                .page25h-chart-column figure {
                    height: 480px !important;
                    min-height: 480px !important;
                }

                .page25h-text-column {
                    width: 100%;
                    padding-left: 0;
                    padding-right: 0;
                    padding-top: 0;
                    margin-top: 20px;
                    margin-bottom: 40px;
                }

                .page25h-definition-details {
                    width: 100%;
                    margin-top: 20px;
                    margin-bottom: 40px;
                    align-self: flex-start;
                }

                .page25h-definition-details summary {
                    display: flex;
                    align-items: center;
                    padding: 12px 15px;
                    background-color: #fff;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    cursor: pointer;
                    font-family: Arial, sans-serif;
                    font-weight: bold;
                    font-size: 1rem;
                    list-style: none;
                    width: 100%;
                    box-sizing: border-box;
                }

                .page25h-definition-details summary::-webkit-details-marker {
                    display: none;
                }

                .page25h-definition-details summary:hover {
                    background-color: #f5f5f5;
                }

                .page25h-definition-details summary .definition-arrow {
                    margin-right: 10px;
                    font-size: 0.8rem;
                    transition: transform 0.2s ease;
                }

                .page25h-definition-details[open] summary .definition-arrow {
                    transform: rotate(0deg);
                }

                .page25h-definition-details:not([open]) summary .definition-arrow {
                    transform: rotate(-90deg);
                }

                .page25h-definition-content {
                    background-color: #aa9c7a;
                    padding: 20px;
                    border-radius: 0 0 4px 4px;
                    margin-top: -1px;
                    text-align: left;
                    font-size: 1.05rem;
                    line-height: 1.6;
                    color: #333;
                }

                .page25h-definition-content p {
                    text-align: left;
                    margin: 0 0 10px 0;
                }

                .page25h-definition-content p:last-child {
                    margin-bottom: 0;
                }

                .page25h-year-selector {
                    display: flex;
                    align-items: center;
                    margin-bottom: 10px;
                    margin-top: 5px;
                }

                .page25h-year-label {
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

                .js-plotly-plot .plotly .slice path.textline { display: none !important; }
                .js-plotly-plot .plotly g.slice path[class*="textline"] { display: none !important; }

                @media (max-width: 960px) {
                    .page25h-year-ticks { display: none !important; }

                    .page25h-chart-column figure {
                        height: 520px !important;
                        min-height: 520px !important;
                    }
                }

                @media (max-width: 768px) {
                    .page-25h { border-right: none !important; }
                    .page-25h header h1 {
                        font-size: 37px !important;
                    }
                    .page-25h header p {
                        font-size: 18px !important;
                    }

                    .page25h-chart-column figure { 
                        height: 320px !important; 
                        min-height: 320px !important; 
                    }

                    .page25h-chart-column {
                        height: auto !important; 
                        min-height: 340px !important; 
                        margin-bottom: 20px !important;
                    }

                    .page25h-slider-region {
                        flex-direction: column !important;
                        align-items: stretch !important;
                    }
                    .page25h-slider-label { margin-bottom: 10px; margin-right: 0 !important; }
                }

                @media (max-width: 640px) {
                    .page25h-slider-region {
                        flex-direction: column !important;
                        align-items: stretch !important;
                    }

                    .page25h-chart-column { 
                        width: 100% !important; 
                        height: auto !important; 
                        min-height: 500px !important; 
                        margin-bottom: 20px !important;
                    }
                    .page25h-chart-column figure { height: 480px !important; min-height: 480px !important; }

                    input[type=range] { height: 44px !important; padding: 10px 0 !important; }
                    input[type=range]::-webkit-slider-thumb { height: 28px !important; width: 28px !important; margin-top: -10px !important; }
                }

                @media (max-width: 480px) {
                    .page25h-chart-column { min-height: 480px !important; margin-bottom: 20px !important; }
                    .page25h-chart-column figure { height: 480px !important; min-height: 480px !important; }
                }

                @media (max-width: 384px) {
                    .page25h-chart-column {
                        width: 100% !important; 
                        height: auto !important; 
                        min-height: 400px !important; 
                        margin-bottom: 20px !important;
                    }

                    .page25h-chart-column figure { 
                        height: 420px !important; 
                        min-height: 420px !important; 
                    }
                }

                details summary::-webkit-details-marker, details summary::marker { display: none; }
                .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
                .page25h-table-btn-wrapper summary:focus {outline: none !important;}

                .page25h-chart-frame {
                    background-color: #f5f5f5;
                    padding: 20px;
                    border-radius: 8px;
                    box-sizing: border-box;
                    width: 100%;
                }

                .page25h-table-wrapper {
                    display: block;
                    width: 100%;
                    margin: 0;
                }

                .page25h-table-wrapper details > summary {
                    display: block;
                    width: 100%;
                    padding: 12px 15px;
                    background-color: #fff;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: bold;
                    box-sizing: border-box;
                    list-style: none;
                }

                .page25h-table-wrapper details > summary::-webkit-details-marker {
                    display: none;
                }

                .page25h-table-wrapper details > summary:hover {
                    background-color: #f5f5f5;
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

                .page25h-text-column > p {
                    margin-left: auto !important;
                    margin-right: auto !important;
                    max-width: 65ch; 
                }
            `}</style>

            <div className="page25h-container">
                <header 
                    role="region" 
                    aria-label={`${getText('page25_title', lang).replace(/<br>/g, ' ')}. ${getSubtitleText()}`}
                >
                    <h1 aria-hidden="true" style={{ fontFamily: "'Lato', sans-serif", color: '#245e7f', fontSize: '41px', fontWeight: 'bold', margin: '0 0 3px 0' }}>
                        {getText('page25_title', lang)}
                    </h1>

                    <p aria-hidden="true" style={{ fontSize: '20px', color: '#333', marginBottom: '5px', whiteSpace: 'pre-line', fontFamily: "'Noto Sans', sans-serif" }}>
                        {getSubtitle()}
                    </p>
                </header>
                {/* SINGLE-SELECT RADIO DROPDOWN */}
                <div 
                    ref={yearSelectorRef} 
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
                        onClick={() => setIsYearSelectorOpen(!isYearSelectorOpen)}
                        aria-expanded={isYearSelectorOpen}
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
                        <span aria-hidden="true" style={{ fontSize: '12px' }}>{isYearSelectorOpen ? '▲' : '▼'}</span>
                    </button>

                    {/* DROPDOWN LIST */}
                    {isYearSelectorOpen && (
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
                                            setIsYearSelectorOpen(false);
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

                <div className="page25h-content-row">
                    <div className="page25h-chart-frame">
                    <div 
                        className="page25h-chart-column"
                        role="region"
                        aria-label={`${lang === 'en' ? 'Infrastructure pie chart for' : 'Graphique circulaire des infrastructures pour'} ${year}. ${getChartDataSummary()}. ${lang === 'en' ? 'Expand the data table below for detailed values.' : 'Développez le tableau de données ci-dessous pour les valeurs détaillées.'}`}
                        tabIndex="0"
                    >
                        {chartData && (
                            <figure ref={chartRef} className="page25h-chart" style={{ width: '100%', height: '450px', minHeight: '450px', margin: 0, position: 'relative' }}>
                                {selectedSlices !== null && (
                                    <button onClick={() => setSelectedSlices(null)} style={{ position: 'absolute', top: 0, right: 295, zIndex: 20 }}>{lang === 'en' ? 'Clear' : 'Effacer'}</button>
                                )}
                                <Plot
                                    key={`pie-${selectedSlices ? selectedSlices.join('-') : 'none'}`}
                                    data={[{
                                        values: chartData.values,
                                        labels: pieLabels,
                                        hole: windowWidth <= 480 ? 0.80 : windowWidth <= 768 ? 0.75 : 0.73,
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
                                        texttemplate: windowWidth <= 768 ? '%{percent:.0%}' : '%{label}<br>%{percent:.0%}',
                                        textinfo: windowWidth <= 768 ? 'percent' : 'label+percent',
                                        textposition: windowWidth <= 768 ? 'inside' : 'outside',
                                        textfont: { 
                                            size: windowWidth <= 480 ? 10 : windowWidth <= 768 ? 12 : 18, 
                                            family: 'Arial, sans-serif',
                                            color: (() => {
                                                if (windowWidth <= 768) return '#fff';
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
                                        hovertext: chartData.hoverTexts, hoverinfo: 'text',
                                        hoverlabel: { bgcolor: 'white', font: { size: 14, family: 'Arial, sans-serif' } },
                                        direction: 'clockwise', sort: false, rotation: 335,
                                        pull: (() => {
                                            if (selectedSlices === null) return chartData.values.map(() => 0.02);
                                            return chartData.values.map((_, i) => selectedSlices.includes(i) ? 0.08 : 0.02);
                                        })(),
                                        automargin: true
                                    }]}
                                    layout={{
                                        showlegend: windowWidth <= 768,
                                        legend: windowWidth <= 768 ? (
                                            windowWidth <= 384 ? {
                                                orientation: 'h',
                                                y: -0.50,
                                                x: 0.5,
                                                xanchor: 'center',
                                                yanchor: 'top',
                                                font: { size: 9 },
                                                itemclick: false,
                                                itemdoubleclick: false
                                            } : windowWidth <= 480 ? {
                                                orientation: 'h',
                                                y: -0.15, 
                                                x: 0.5,
                                                xanchor: 'center',
                                                yanchor: 'top',
                                                font: { size: 9 },
                                                itemclick: false,
                                                itemdoubleclick: false
                                            } : windowWidth <= 640 ? {
                                                orientation: 'h',
                                                y: -0.15,
                                                x: 0.6,
                                                xanchor: 'center',
                                                yanchor: 'top',
                                                font: { size: 10 },
                                                itemclick: false,
                                                itemdoubleclick: false
                                            } : {
                                                orientation: 'v',
                                                y: 0.5,
                                                x: 1.05,
                                                xanchor: 'left',
                                                yanchor: 'middle',
                                                font: { size: 10 },
                                                itemclick: false,
                                                itemdoubleclick: false
                                            }
                                        ) : undefined,
                                        margin: windowWidth <= 384
                                            ? { l: 0, r: 0, t: 10, b: 80 }
                                            : windowWidth <= 480
                                                ? { l: 0, r: 0, t: 10, b: 70 }
                                                : windowWidth <= 640
                                                    ? { l: 0, r: 0, t: 10, b: 60 }
                                                    : windowWidth <= 768 
                                                        ? { l: 0, r: 0, t: 10, b: 10 }
                                                        : { l: 0, r: 0, t: 40, b: 40 },
                                        paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
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
                                                return;
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
                            </figure>
                        )}

                        <div className="page25h-table-wrapper">
                            {getAccessibleDataTable()}
                        </div>
                    </div>
                    </div> {/* End chart-frame */}

                    <details 
                        className="page25h-definition-details"
                        role="region"
                        aria-label={getRightSideText()}
                    >
                        <summary>
                            <span className="definition-arrow" aria-hidden="true">▼</span>
                            <span>{getText('infra_definition_title', lang).replace(/\n/g, ' ')}</span>
                        </summary>
                        <div className="page25h-definition-content">
                            <p>
                                {getText('infra_definition_text', lang).replace(/\n/g, ' ')}
                            </p>
                            <p>
                                {getText('infra_description', lang).replace(/\n/g, ' ')}
                            </p>
                        </div>
                    </details>
                </div>
            </div>
        </main>
    );
};

export default Page25Stacked;
