import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { getInfrastructureData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

const Page25 = () => {
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
        import('./Page26');
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

    const COLORS = {
        'environmental': '#e9d259', 'fuel_energy_pipelines': '#6cbe8d',
        'transport': '#2DA6B4', 'education': '#597DD9',
        'health_housing': '#857550', 'public_safety': '#f58445',
    };

    const CATEGORY_ORDER = ['environmental', 'fuel_energy_pipelines', 'transport', 'education', 'health_housing', 'public_safety'];
    const downloadChartWithTitle = async (plotEl = null) => {
        const plotElement = plotEl || document.querySelector('.page25-chart .js-plotly-plot') || chartRef.current?.querySelector('.js-plotly-plot');
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
            ? `<b>TOTAL</b><br><b>$${totalBillions.toFixed(0)}</b><br><b>BILLION</b>`
            : `<b>TOTAL</b><br><b>${totalBillions.toFixed(0)} $</b><br><b>MILLIARDS</b>`;

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
        const captionId = 'page25-table-caption';

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
                        backgroundColor: '#f9f9f9',
                        borderRadius: '4px',
                        listStyle: 'none'
                    }}
                >
                    <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                    {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                    <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                </summary>

                <div className="table-responsive" role="region" aria-labelledby={captionId}>
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
            className="page-content page-25" 
            role="main"
            aria-label={getText('page25_title', lang)}
            style={{
                backgroundColor: 'white', 
                flex: '1 1 auto', 
                display: 'flex',
                flexDirection: 'column',
                overflowX: 'hidden',
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

                .page-25 {
                    margin-right: -${layoutPadding?.right || 15}px;
                    width: calc(100% + ${layoutPadding?.right || 15}px);
                    padding-right: ${layoutPadding?.right || 15}px; 
                }

                .page25-container {
                    width: 100%;
                    padding: 0; 
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                    min-height: 100%;
                }

                .page25-content-row {
                    display: flex;
                    flex-direction: row;
                    flex: 1 1 auto;
                    min-height: 0;
                    align-items: flex-start;
                    gap: 40px;
                }

                .page25-slider-region {
                    width: 100%;
                    position: relative;
                    z-index: 50;
                }
                .page25-slider-track { flex: 1; }

                .page25-chart-column {
                    width: 60%;
                    height: auto;
                    min-height: 500px;
                    position: relative;
                    margin-bottom: 20px;
                }

                .page25-chart-column details {
                    width: 100%;
                    position: relative;
                    z-index: 50;
                }

                .layout-stacked {
                    flex-direction: column !important;
                    height: auto !important;
                    align-items: center !important;
                    flex: 0 0 auto !important;
                }
                .layout-stacked .page25-chart-column {
                    width: 100% !important;
                    height: auto !important;
                    max-height: none !important;
                    margin-bottom: 30px !important;
                    overflow: visible !important;
                }
                .layout-stacked .page25-text-column {
                    width: 100% !important;
                    padding-left: 0 !important;
                    padding-right: 0 !important;
                    margin-top: 20px !important;
                }
                .layout-stacked figure {
                    height: 500px !important;
                    min-height: 500px !important;
                }

                .page25-chart-column figure {
                    height: 450px;
                    min-height: 450px;
                }

                .page25-text-column {
                    width: 40%;
                    padding-left: 25px;
                    padding-right: 0;
                    padding-top: 0;
                    margin-top: 0;
                }

                .page25-definition-box {
                    position: relative;
                    background-color: #aa9c7a;
                    padding: 20px 30px;
                    border-radius: 3px;
                    width: 100%;
                    margin-top: 10px;
                }
                .page25-definition-box h2 {
                    text-align: center !important;
                    padding-left: 0 !important;
                }

                .page25-year-selector {
                    display: flex;
                    align-items: center;
                    margin-bottom: 10px;
                    margin-top: 5px;
                }

                .page25-year-label {
                    font-weight: bold;
                    margin-right: 15px;
                    font-size: 18px;
                    font-family: Arial, sans-serif;
                    white-space: nowrap;
                }

                .page25-year-select {
                    padding: 8px 12px;
                    font-size: 16px;
                    font-family: Arial, sans-serif;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    background-color: #fff;
                    cursor: pointer;
                    min-width: 100px;
                }

                .page25-year-select:hover {
                    border-color: #007bff;
                }

                .page25-year-select:focus {
                    outline: 2px solid #005fcc;
                    outline-offset: 2px;
                    border-color: #007bff;
                }

                .js-plotly-plot .plotly .slice path.textline { display: none !important; }
                .js-plotly-plot .plotly g.slice path[class*="textline"] { display: none !important; }

                @media (max-width: 1800px) {
                    .page25-content-row {
                        flex-direction: column;
                        height: auto;
                        align-items: center;
                    }

                    .page25-chart-column {
                        width: 100%;
                        height: auto;
                        min-height: 500px;
                        max-height: none;
                        margin-bottom: 30px;
                    }

                    .page25-chart-column figure {
                        height: 480px !important;
                        min-height: 480px !important;
                    }

                    .page25-text-column {
                        width: 100%;
                        padding-left: 0;
                        padding-right: 0;
                        margin-top: 20px;
                        margin-bottom: 40px;
                    }
                }

                @media (max-width: 960px) {
                    .page25-year-ticks { display: none !important; }

                    .page25-chart-column figure {
                        height: 520px !important;
                        min-height: 520px !important;
                    }
                }

                @media (max-width: 768px) {
                    .page-25 { border-right: none !important; }

                    .page25-chart-column figure { 
                        height: 320px !important; 
                        min-height: 320px !important; 
                    }

                    .page25-chart-column {
                        height: auto !important; 
                        min-height: 340px !important; 
                        margin-bottom: 20px !important;
                    }

                    .page25-slider-region {
                        flex-direction: column !important;
                        align-items: stretch !important;
                    }
                    .page25-slider-label { margin-bottom: 10px; margin-right: 0 !important; }
                }

                @media (max-width: 640px) {
                    .page25-slider-region {
                        flex-direction: column !important;
                        align-items: stretch !important;
                    }

                    .page25-chart-column,
                    .layout-stacked .page25-chart-column { 
                        width: 100% !important; 
                        height: auto !important; 
                        min-height: 500px !important; 
                        margin-bottom: 20px !important;
                    }
                    .page25-chart-column figure { height: 480px !important; min-height: 480px !important; }
                    .decorative-quote { display: none !important; }

                    input[type=range] { height: 44px !important; padding: 10px 0 !important; }
                    input[type=range]::-webkit-slider-thumb { height: 28px !important; width: 28px !important; margin-top: -10px !important; }
                }

                @media (max-width: 480px) {
                    .page25-chart-column { min-height: 480px !important; margin-bottom: 20px !important; }
                    .page25-chart-column figure { height: 480px !important; min-height: 480px !important; }
                }

                @media (max-width: 384px) {
                    .page25-chart-column,
                    .layout-stacked .page25-chart-column {
                        width: 100% !important; 
                        height: auto !important; 
                        min-height: 400px !important; 
                        margin-bottom: 20px !important;
                    }

                    .page25-chart-column figure { 
                        height: 420px !important; 
                        min-height: 420px !important; 
                    }
                }

                details summary::-webkit-details-marker, details summary::marker { display: none; }
                .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
                .page25-table-btn-wrapper summary:focus {outline: none !important;}
            `}</style>

            <div className="page25-container">
                <header 
                    role="region" 
                    aria-label={`${getText('page25_title', lang).replace(/<br>/g, ' ')}. ${getSubtitleText()}`}
                >
                    <h1 aria-hidden="true" style={{ fontFamily: 'Georgia, serif', color: '#8e7e52', fontSize: '3rem', fontWeight: 'normal', margin: '0 0 3px 0' }}>
                        {getText('page25_title', lang)}
                    </h1>

                    <p aria-hidden="true" style={{ fontSize: '1.4rem', color: '#333', marginBottom: '5px', whiteSpace: 'pre-line' }}>
                        {getSubtitle()}
                    </p>
                </header>
                <div className="page25-year-selector">
                    <label 
                        id="year-label-25"
                        className="page25-year-label"
                        htmlFor="year-select-25"
                    >
                        {getText('year_slider_label', lang)}
                    </label>
                    <select
                        id="year-select-25"
                        className="page25-year-select"
                        value={year || maxYear}
                        onChange={(e) => setYear(parseInt(e.target.value))}
                        aria-labelledby="year-label-25"
                    >
                        {yearsList.map(y => (
                            <option key={y} value={y}>
                                {y}
                            </option>
                        ))}
                    </select>
                </div>

                <div 
                    aria-live="polite" 
                    aria-atomic="true" 
                    style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }}
                >
                    {chartData && `${year}`}
                </div>

                <div className={`page25-content-row ${isTableOpen ? 'layout-stacked' : ''}`}>
                    <div 
                        className="page25-chart-column"
                        role="region"
                        aria-label={`${lang === 'en' ? 'Infrastructure pie chart for' : 'Graphique circulaire des infrastructures pour'} ${year}. ${getChartDataSummary()}. ${lang === 'en' ? 'Expand the data table below for detailed values.' : 'Développez le tableau de données ci-dessous pour les valeurs détaillées.'}`}
                    >
                        {chartData && (
                            <figure ref={chartRef} className="page25-chart" style={{ width: '100%', height: '450px', minHeight: '450px', margin: 0, position: 'relative' }}>
                                {selectedSlices !== null && (
                                    <button onClick={() => setSelectedSlices(null)} style={{ position: 'absolute', top: 0, right: 295, zIndex: 20 }}>{lang === 'en' ? 'Clear' : 'Effacer'}</button>
                                )}
                                <Plot
                                    key={`pie-${selectedSlices ? selectedSlices.join('-') : 'none'}`}
                                    data={[{
                                        values: chartData.values,
                                        labels: pieLabels,
                                        hole: windowWidth <= 480 ? 0.80 : windowWidth <= 768 ? 0.75 : windowWidth <= 1400 ? 0.73 : 0.70,
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
                                                width: 1000,
                                                height: 1000,
                                                path: 'm500 450c-83 0-150-67-150-150 0-83 67-150 150-150 83 0 150 67 150 150 0 83-67 150-150 150z m400 150h-120c-16 0-34 13-39 29l-31 93c-6 15-23 28-40 28h-340c-16 0-34-13-39-28l-31-94c-6-15-23-28-40-28h-120c-55 0-100-45-100-100v-450c0-55 45-100 100-100h800c55 0 100 45 100 100v450c0 55-45 100-100 100z m-400-550c-138 0-250 112-250 250 0 138 112 250 250 250 138 0 250-112 250-250 0-138-112-250-250-250z m365 380c-19 0-35 16-35 35 0 19 16 35 35 35 19 0 35-16 35-35 0-19-16-35-35-35z',
                                                transform: 'matrix(1 0 0 -1 0 850)'
                                            },
                                            click: (gd) => downloadChartWithTitle(gd)
                                        }]
                                    }}
                                />
                            </figure>
                        )}

                        {getAccessibleDataTable()}
                    </div>

                    <aside 
                        className="page25-text-column"
                        role="region"
                        aria-label={getRightSideText()}
                    >
                        <div className="page25-definition-box" aria-hidden="true">
                            <h2 style={{ fontSize: '1.15rem', fontWeight: 'bold', textAlign: 'center', color: '#333', margin: '0 0 15px 0px', lineHeight: '1.4', whiteSpace: 'pre-line' }}>
                                {getText('infra_definition_title', lang)}
                            </h2>
                            <div style={{ textAlign: 'center' }}>
                                <span className="decorative-quote" aria-hidden="true" style={{ 
                                    position: 'absolute',
                                    top: '-5px',
                                    left: '10px',
                                    fontSize: '6rem', 
                                    color: '#292419', 
                                    fontFamily: 'Georgia, serif', 
                                    lineHeight: '1',
                                    pointerEvents: 'none'
                                }}>❞</span>

                                <p style={{ fontSize: '1.05rem', color: '#333', lineHeight: '1.6', whiteSpace: 'pre-line', textAlign: 'center', margin: 0, padding: '0 10px' }}>
                                    {getText('infra_definition_text', lang)}
                                </p>

                                <span className="decorative-quote" aria-hidden="true" style={{ 
                                    position: 'absolute',
                                    bottom: '-35px',
                                    left: 'calc(100% - 70px)',
                                    fontSize: '6rem', 
                                    color: '#292419', 
                                    fontFamily: 'Georgia, serif', 
                                    lineHeight: '1',
                                    pointerEvents: 'none'
                                }}>❞</span>
                            </div>
                        </div>
                        <p aria-hidden="true" style={{ fontSize: '1.05rem', color: '#333', lineHeight: '1.5', marginTop: '10px', marginLeft: '0', textAlign: 'center', whiteSpace: 'pre-line' }}>
                            {getText('infra_description', lang)}
                        </p>
                    </aside>
                </div>
            </div>
        </main>
    );
};

export default Page25;
