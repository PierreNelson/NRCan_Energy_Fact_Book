import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { getForeignControlData, getInternationalInvestmentData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
const Page32 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [chartData, setChartData] = useState([]);
    const [investmentData, setInvestmentData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [isChartInteractive, setIsChartInteractive] = useState(typeof window !== 'undefined' ? window.innerWidth > 768 : true);
    const [selectedPoints, setSelectedPoints] = useState(null);
    const chartRef = useRef(null);
    const lastClickRef = useRef({ time: 0, traceIndex: null, pointIndex: null });
    const topScrollRef = useRef(null);
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
        Promise.all([
            getForeignControlData(),
            getInternationalInvestmentData()
        ])
            .then(([foreignData, intlData]) => {
                setChartData(foreignData);
                setInvestmentData(intlData);
            })
            .catch(err => {
                console.error("Failed to load page 32 data:", err);
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
    }, [chartData, lang]);

    const COLORS = {
        'utilities': '#284162',
        'oil_gas': '#419563',
        'all_non_financial': '#8B7355',
    };
    const bulletValues = useMemo(() => {
        if (investmentData.length < 2) return null;

        const latestYear = investmentData[investmentData.length - 1];
        const prevYear = investmentData[investmentData.length - 2];

        const fdiLatest = (latestYear.fdi || 0) / 1000;
        const fdiPrev = (prevYear.fdi || 0) / 1000;
        const cdiaLatest = (latestYear.cdia || 0) / 1000;
        const cdiaPrev = (prevYear.cdia || 0) / 1000;

        const fdiGrowth = fdiPrev > 0 ? ((fdiLatest - fdiPrev) / fdiPrev * 100) : 0;
        const cdiaGrowth = cdiaPrev > 0 ? ((cdiaLatest - cdiaPrev) / cdiaPrev * 100) : 0;
        const energyShare = 10;
        const oilGasCdia = Math.round(cdiaLatest * 0.168);

        return {
            year: latestYear.year,
            prevYear: prevYear.year,
            fdi: Math.round(fdiLatest),
            fdiGrowth: fdiGrowth.toFixed(1),
            energyShare,
            cdia: Math.round(cdiaLatest),
            cdiaGrowth: Math.round(cdiaGrowth),
            oilGasCdia
        };
    }, [investmentData]);
    const processedChartData = useMemo(() => {
        if (chartData.length === 0) return null;

        const years = chartData.map(d => d.year);
        const minYear = Math.min(...years);
        const maxYear = Math.max(...years);
        const tickVals = [];
        for (let y = 2010; y <= maxYear; y += 2) {
            tickVals.push(y);
        }

        const utilitiesValues = chartData.map(d => d.utilities || 0);
        const oilGasValues = chartData.map(d => d.oil_gas || 0);
        const allIndustriesValues = chartData.map(d => d.all_non_financial || 0);
        const buildHoverText = (values, labelKey) => values.map((v, i) => {
            return `<b>${getText(labelKey, lang)}</b><br>${years[i]}: ${v.toFixed(1)}%`;
        });
        const traces = [
            {
                name: getText('page32_legend_all_industries', lang),
                x: years,
                y: allIndustriesValues,
                type: 'bar',
                marker: { 
                    color: COLORS.all_non_financial,
                    opacity: selectedPoints === null ? 1 : years.map((_, i) => selectedPoints[0]?.includes(i) ? 1 : 0.3)
                },
                hovertext: buildHoverText(allIndustriesValues, 'page32_hover_all_industries'),
                hoverinfo: 'text',
                hoverlabel: {
                    bgcolor: '#ffffff',
                    bordercolor: '#000000',
                    font: { color: '#000000', size: windowWidth <= 480 ? 12 : 14, family: 'Arial, sans-serif' }
                },
            },
            {
                name: getText('page32_legend_oil_gas', lang),
                x: years,
                y: oilGasValues,
                type: 'bar',
                marker: { 
                    color: COLORS.oil_gas,
                    opacity: selectedPoints === null ? 1 : years.map((_, i) => selectedPoints[1]?.includes(i) ? 1 : 0.3)
                },
                hovertext: buildHoverText(oilGasValues, 'page32_hover_oil_gas'),
                hoverinfo: 'text',
                hoverlabel: {
                    bgcolor: '#ffffff',
                    bordercolor: '#000000',
                    font: { color: '#000000', size: windowWidth <= 480 ? 12 : 14, family: 'Arial, sans-serif' }
                },
            },
            {
                name: getText('page32_legend_utilities', lang),
                x: years,
                y: utilitiesValues,
                type: 'bar',
                marker: { 
                    color: COLORS.utilities,
                    opacity: selectedPoints === null ? 1 : years.map((_, i) => selectedPoints[2]?.includes(i) ? 1 : 0.3)
                },
                hovertext: buildHoverText(utilitiesValues, 'page32_hover_utilities'),
                hoverinfo: 'text',
                hoverlabel: {
                    bgcolor: '#ffffff',
                    bordercolor: '#000000',
                    font: { color: '#000000', size: windowWidth <= 480 ? 12 : 14, family: 'Arial, sans-serif' }
                },
            }
        ];

        return { traces, years, tickVals, minYear, maxYear, utilitiesValues, oilGasValues, allIndustriesValues };
    }, [chartData, lang, windowWidth, selectedPoints]);
    const formatPercentSR = (val) => {
        return lang === 'en' 
            ? `${val.toFixed(1)} percent` 
            : `${val.toFixed(1)} pour cent`;
    };
    const getChartTitleSR = () => {
        if (lang === 'en') {
            return 'Foreign control of Canadian assets';
        } else {
            return "Contrôle étranger d'actifs canadiens";
        }
    };
    const getChartDataSummary = () => {
        if (!chartData || chartData.length === 0) return '';

        const latestYear = chartData[chartData.length - 1];
        const latestYearNum = latestYear.year;

        if (lang === 'en') {
            return `Grouped bar chart showing foreign control of Canadian assets from ${processedChartData?.minYear} to ${latestYearNum}. Expand the data table below for detailed values.`;
        } else {
            return `Graphique à barres groupées montrant le contrôle étranger des actifs canadiens de ${processedChartData?.minYear} à ${latestYearNum}. Développez le tableau de données ci-dessous pour les valeurs détaillées.`;
        }
    };
    const formatNumber = (val) => {
        return val.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { 
            minimumFractionDigits: 1, 
            maximumFractionDigits: 1 
        });
    };
    const getAccessibleDataTable = () => {
        if (!chartData || chartData.length === 0) return null;

        const unitText = lang === 'en' ? ', in percent' : ', en pourcentage';
        const captionId = 'page32-table-caption';

        const utilitiesLabel = getText('page32_legend_utilities', lang);
        const oilGasLabel = getText('page32_legend_oil_gas', lang);
        const allIndustriesLabel = getText('page32_legend_all_industries', lang);
        const cellUnitSR = lang === 'en' ? ' percent' : ' pour cent';
        const headerUnitVisual = '(%)';
        const headerUnitSR = lang === 'en' ? '(percentage)' : '(pourcentage)';

        return (
            <details 
                onToggle={(e) => setIsTableOpen(e.currentTarget.open)}
                className="page32-data-table"
                style={{ cursor: 'pointer' }} 
            >
                <summary 
                    role="button"
                    aria-expanded={isTableOpen}
                    style={{ 
                        cursor: 'pointer', 
                        color: 'var(--gc-text)', 
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
                                ? 'Foreign control of Canadian assets (percentage of total assets)'
                                : "Contrôle étranger d'actifs canadiens (pourcentage des actifs totaux)"}
                        </caption>
                        <thead>
                            <tr>
                                <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{lang === 'en' ? 'Year' : 'Année'}</th>
                                <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>
                                    {utilitiesLabel}<br/>
                                    <span aria-hidden="true">{headerUnitVisual}</span>
                                    <span className="wb-inv">{headerUnitSR}</span>
                                </th>
                                <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>
                                    {oilGasLabel}<br/>
                                    <span aria-hidden="true">{headerUnitVisual}</span>
                                    <span className="wb-inv">{headerUnitSR}</span>
                                </th>
                                <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>
                                    {allIndustriesLabel}<br/>
                                    <span aria-hidden="true">{headerUnitVisual}</span>
                                    <span className="wb-inv">{headerUnitSR}</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {chartData.map(yearData => (
                                <tr key={yearData.year}>
                                    <th scope="row" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{yearData.year}</th>
                                    <td 
                                        style={{ textAlign: 'right', border: '1px solid #ddd' }}
                                        aria-label={`${yearData.year}, ${utilitiesLabel}: ${formatNumber(yearData.utilities || 0)}${cellUnitSR}`}
                                    >
                                        {formatNumber(yearData.utilities || 0)}%
                                    </td>
                                    <td 
                                        style={{ textAlign: 'right', border: '1px solid #ddd' }}
                                        aria-label={`${yearData.year}, ${oilGasLabel}: ${formatNumber(yearData.oil_gas || 0)}${cellUnitSR}`}
                                    >
                                        {formatNumber(yearData.oil_gas || 0)}%
                                    </td>
                                    <td 
                                        style={{ textAlign: 'right', border: '1px solid #ddd' }}
                                        aria-label={`${yearData.year}, ${allIndustriesLabel}: ${formatNumber(yearData.all_non_financial || 0)}${cellUnitSR}`}
                                    >
                                        {formatNumber(yearData.all_non_financial || 0)}%
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
        );
    };
    const downloadTableAsCSV = () => {
        if (!chartData || chartData.length === 0) return;

        const utilitiesLabel = getText('page32_legend_utilities', lang);
        const oilGasLabel = getText('page32_legend_oil_gas', lang);
        const allIndustriesLabel = getText('page32_legend_all_industries', lang);
        const unitHeader = '(%)';
        const headers = [
            lang === 'en' ? 'Year' : 'Année',
            `${utilitiesLabel} ${unitHeader}`,
            `${oilGasLabel} ${unitHeader}`,
            `${allIndustriesLabel} ${unitHeader}`
        ];
        const rows = chartData.map(yearData => [
            yearData.year,
            (yearData.utilities || 0).toFixed(1),
            (yearData.oil_gas || 0).toFixed(1),
            (yearData.all_non_financial || 0).toFixed(1)
        ]);
        const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = lang === 'en' ? 'environmental_protection_data.csv' : 'protection_environnement_donnees.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };
    const downloadTableAsDocx = async () => {
        if (!chartData || chartData.length === 0) return;

        const utilitiesLabel = getText('page32_legend_utilities', lang);
        const oilGasLabel = getText('page32_legend_oil_gas', lang);
        const allIndustriesLabel = getText('page32_legend_all_industries', lang);
        const unitHeader = '(%)';
        const title = stripHtml(getText('page32_title', lang));

        const headers = [
            lang === 'en' ? 'Year' : 'Année',
            `${utilitiesLabel} ${unitHeader}`,
            `${oilGasLabel} ${unitHeader}`,
            `${allIndustriesLabel} ${unitHeader}`
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

        const dataRows = chartData.map(yearData => new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(yearData.year), size: 22 })], alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: (yearData.utilities || 0).toFixed(1), size: 22 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: (yearData.oil_gas || 0).toFixed(1), size: 22 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: (yearData.all_non_financial || 0).toFixed(1), size: 22 })], alignment: AlignmentType.RIGHT })] })
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
                        columnWidths: [1800, 2200, 2200, 3000],
                        rows: [headerRow, ...dataRows]
                    })
                ]
            }]
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'environmental_protection_table.docx' : 'protection_environnement_tableau.docx');
    };
    const downloadChartWithTitle = async (plotEl = null) => {
        const plotElement = plotEl || document.querySelector('.page32-chart .js-plotly-plot') || document.querySelector('#page-32 .js-plotly-plot');
        if (!plotElement) {
            console.error('Plot element not found');
            alert('Could not find chart element. Please try again.');
            return;
        }
        const title = stripHtml(getText('page32_chart_title', lang));

        try {
            if (!window.Plotly) {
                console.error('Plotly not available on window');
                alert('Plotly library not loaded. Please refresh the page and try again.');
                return;
            }

            const imgData = await window.Plotly.toImage(plotElement, {
                format: 'png',
                width: 1200,
                height: 600,
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
                link.download = lang === 'en' ? 'environmental_protection_chart.png' : 'protection_environnement_graphique.png';
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

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
    }

    if (error) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'red' }}>Error: {error}. Please refresh the page.</div>;
    }

    if (!processedChartData) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>No data available. Please refresh the page.</div>;
    }

    return (
        <main 
            id="main-content"
            tabIndex="-1"
            className="page-content page-32" 
            role="main"
            aria-label={getText('page32_title', lang)}
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

                .page-32 {
                    margin-left: -${layoutPadding?.left || 55}px;
                    width: calc(100% + ${layoutPadding?.left || 55}px);
                    padding-left: ${layoutPadding?.left || 55}px; 
                }

                .wb-inv {
                    clip: rect(1px, 1px, 1px, 1px);
                    height: 1px;
                    margin: 0;
                    overflow: hidden;
                    position: absolute;
                    width: 1px;
                }

                .page32-container {
                    width: 100%;
                    padding: 15px 0 20px 0;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                    flex: 1;
                    overflow: visible;
                }

                .page32-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 41px;
                    font-weight: bold;
                    margin-top: 0;
                    margin-bottom: 25px;
                    color: var(--gc-text);
                    margin-top: 5px;
                    line-height: 1.3;
                    position: relative;
                    padding-bottom: 0.5em;
                }

                .page32-title::after {
                    content: '';
                    position: absolute;
                    left: 0;
                    bottom: 0.2em;
                    width: 72px;
                    height: 6px;
                    background-color: var(--gc-red);
                }

                .page32-bullets {
                    font-family: 'Noto Sans', sans-serif;
                    color: var(--gc-text);
                    font-size: 20px;
                    margin-bottom: 10px;
                    line-height: 1.6;
                    list-style-type: disc;
                    padding-left: 20px;
                    max-width: 65ch;
                }

                .page32-bullets li {
                    margin-bottom: 8px;
                }

                .page32-bullets li::marker {
                    font-size: 1rem; 
                }

                .visual-bold {
                    font-weight: bold;
                }

                .page32-section-title {
                    font-family: 'Lato', sans-serif;
                    color: var(--gc-text);
                    font-size: 29px;
                    font-weight: bold;
                    margin-bottom: 0;
                    margin-top: 15px;
                }

                .page32-section-text {
                    font-family: 'Noto Sans', sans-serif;
                    color: var(--gc-text);
                    font-size: 20px;
                    margin-bottom: 0;
                    line-height: 1.5;
                    position: relative;
                    max-width: 65ch;
                }

                .page32-chart-title {
                    font-family: 'Lato', sans-serif;
                    color: var(--gc-text);
                    font-size: 29px;
                    font-weight: bold;
                    text-align: center;
                    margin-bottom: 5px;
                }

                .page32-chart-wrapper {
                    display: flex;
                    flex-direction: row;
                    align-items: flex-start;
                    justify-content: flex-start;
                    gap: 40px;
                    width: 100%;
                }

                .page32-chart {
                    flex: 1;
                    min-width: 0;
                    width: 100%;
                    height: calc(100vh - 680px);
                    min-height: 260px;
                }

                .page32-data-table {
                    width: 100%;
                    margin-top: 200px;
                    margin-bottom: 0;
                    margin-left: 0;
                    margin-right: 0;
                }

                @media (max-width: 1745px) {
                    .page32-chart {
                        height: calc(100vh - 660px);
                        min-height: 264px;
                    }
                }

                @media (max-width: 1536px) {
                    .page32-title {
                        font-size: 1.8rem;
                    }
                    .page32-chart {
                        height: calc(100vh - 640px);
                        min-height: 268px;
                    }
                }

                @media (max-width: 1280px) {
                    .page32-title {
                        font-size: 1.6rem;
                    }
                    .page32-chart {
                        height: calc(100vh - 620px);
                        min-height: 272px;
                    }
                }

                @media (max-width: 1097px) {
                    .page32-title {
                        font-size: 1.5rem;
                    }
                    .page32-chart {
                        height: calc(100vh - 600px);
                        min-height: 276px;
                    }
                }

                @media (max-width: 960px) {
                    .page32-title {
                        font-size: 1.4rem;
                    }
                    .page32-chart {
                        min-height: 280px;
                    }
                }

                @media (max-width: 768px) {
                    .page-32 { border-left: none !important; }
                    .page32-title {
                        font-size: 37px;
                    }
                    .page32-bullets {
                        font-size: 18px;
                    }
                    .page32-section-title {
                        font-size: 26px;
                    }
                    .page32-section-text {
                        font-size: 18px;
                    }
                    .page32-chart-title {
                        font-size: 26px;
                    }
                    .page32-chart {
                        height: calc(100vh - 550px);
                        min-height: 285px;
                    }
                }

                @media (max-width: 640px) {
                    .page32-title {
                        font-size: 1.2rem;
                    }
                    .page32-chart {
                        height: calc(100vh - 520px);
                        min-height: 290px;
                    }
                }

                @media (max-width: 480px) {
                    .page32-title {
                        font-size: 1.1rem;
                    }
                    .page32-chart {
                        height: calc(100vh - 500px);
                        min-height: 295px;
                    }
                }

                @media (max-width: 384px) {
                    .page32-title {
                        font-size: 1rem;
                    }
                    .page32-chart {
                        height: calc(100vh - 480px);
                        min-height: 300px;
                    }
                }

                details summary::-webkit-details-marker,
                details summary::marker {
                    display: none;
                }

                .page32-chart-frame {
                    background-color: #f5f5f5;
                    padding: 20px;
                    border-radius: 8px;
                    box-sizing: border-box;
                }

                .page32-table-wrapper {
                    display: block;
                    width: 100%;
                    margin: 0;
                }

                .page32-table-wrapper details > summary {
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

                .page32-table-wrapper details > summary::-webkit-details-marker {
                    display: none;
                }

                .page32-table-wrapper details > summary:hover {
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
            `}</style>

            <div className="page32-container">
                <h1 className="page32-title">
                    {getText('page32_title', lang)}
                </h1>
                {bulletValues && (
                    <ul className="page32-bullets" role="list">
                        <li role="listitem" aria-label={lang === 'en' 
                            ? `${getText('page32_bullet1_part1', lang)}${getText('page32_bullet1_part2', lang)}${getText('page32_bullet1_part3', lang)}${bulletValues.year}${getText('page32_bullet1_part4', lang)}${bulletValues.fdi}${getText('page32_bullet1_part5', lang)} (+${bulletValues.fdiGrowth}% over the previous year)`
                            : `${getText('page32_bullet1_part1', lang)}${getText('page32_bullet1_part2', lang)}${getText('page32_bullet1_part3', lang)}${bulletValues.fdi}${getText('page32_bullet1_part4', lang)}${getText('page32_bullet1_part5', lang)}${bulletValues.year} (+${bulletValues.fdiGrowth}% par rapport à l'année précédente)`
                        }>
                            <span aria-hidden="true">
                                {lang === 'en' ? (
                                    <>
                                        {getText('page32_bullet1_part1', lang)}
                                        <span className="visual-bold">{getText('page32_bullet1_part2', lang)}</span>
                                        {getText('page32_bullet1_part3', lang)}
                                        {bulletValues.year}
                                        {getText('page32_bullet1_part4', lang)}
                                        <span className="visual-bold">${bulletValues.fdi}{getText('page32_bullet1_part5', lang)}</span>
                                        {' (+'}
                                        {bulletValues.fdiGrowth}
                                        {'% over the previous year).'}
                                    </>
                                ) : (
                                    <>
                                        {getText('page32_bullet1_part1', lang)}
                                        <span className="visual-bold">{getText('page32_bullet1_part2', lang)}</span>
                                        {getText('page32_bullet1_part3', lang)}
                                        <span className="visual-bold">{bulletValues.fdi}{getText('page32_bullet1_part4', lang)}</span>
                                        {getText('page32_bullet1_part5', lang)}
                                        {bulletValues.year}
                                        {' (+'}
                                        {bulletValues.fdiGrowth}
                                        {"% par rapport à l'année précédente)."}
                                    </>
                                )}
                            </span>
                        </li>
                        <li role="listitem" aria-label={`${getText('page32_bullet2_part1', lang)} ${bulletValues.energyShare}${getText('page32_bullet2_part2', lang)}${bulletValues.year}${getText('page32_bullet2_part3', lang)}${bulletValues.prevYear}${getText('page32_bullet2_part4', lang)}`}>
                            <span aria-hidden="true">
                                {getText('page32_bullet2_part1', lang)}
                                <span className="visual-bold">{bulletValues.energyShare}</span>
                                {getText('page32_bullet2_part2', lang)}
                                {bulletValues.year}
                                {getText('page32_bullet2_part3', lang)}
                                {bulletValues.prevYear}
                                {getText('page32_bullet2_part4', lang)}
                            </span>
                        </li>
                        <li role="listitem" aria-label={lang === 'en'
                            ? `${getText('page32_bullet3_part1', lang)}${getText('page32_bullet3_part2', lang)}${getText('page32_bullet3_part3', lang)}${bulletValues.cdia}${getText('page32_bullet3_part4', lang)}${getText('page32_bullet3_part5', lang)}${bulletValues.year}${getText('page32_bullet3_part6', lang)}${bulletValues.cdiaGrowth}${getText('page32_bullet3_part7', lang)}${bulletValues.prevYear}${getText('page32_bullet3_part8', lang)}`
                            : `${getText('page32_bullet3_part1', lang)}${getText('page32_bullet3_part2', lang)}${getText('page32_bullet3_part3', lang)}${bulletValues.cdia}${getText('page32_bullet3_part4', lang)}${getText('page32_bullet3_part5', lang)}${bulletValues.year}${getText('page32_bullet3_part6', lang)}${bulletValues.cdiaGrowth}${getText('page32_bullet3_part7', lang)}${bulletValues.prevYear}${getText('page32_bullet3_part8', lang)}`
                        }>
                            <span aria-hidden="true">
                                {getText('page32_bullet3_part1', lang)}
                                <span className="visual-bold">{getText('page32_bullet3_part2', lang)}</span>
                                {getText('page32_bullet3_part3', lang)}
                                <span className="visual-bold">${bulletValues.cdia}{getText('page32_bullet3_part4', lang)}</span>
                                {getText('page32_bullet3_part5', lang)}
                                {bulletValues.year}
                                {getText('page32_bullet3_part6', lang)}
                                {bulletValues.cdiaGrowth}
                                {getText('page32_bullet3_part7', lang)}
                                {bulletValues.prevYear}
                                {getText('page32_bullet3_part8', lang)}
                            </span>
                        </li>
                        <li role="listitem" aria-label={lang === 'en'
                            ? `${getText('page32_bullet4_part1', lang)}${bulletValues.oilGasCdia}${getText('page32_bullet4_part2', lang)}${getText('page32_bullet4_part3', lang)}${bulletValues.year}${getText('page32_bullet4_part4', lang)}`
                            : `${getText('page32_bullet4_part1', lang)}${bulletValues.oilGasCdia}${getText('page32_bullet4_part2', lang)}${getText('page32_bullet4_part3', lang)}${bulletValues.year}${getText('page32_bullet4_part4', lang)}`
                        }>
                            <span aria-hidden="true">
                                {getText('page32_bullet4_part1', lang)}
                                <span className="visual-bold">${bulletValues.oilGasCdia}{getText('page32_bullet4_part2', lang)}</span>
                                {getText('page32_bullet4_part3', lang)}
                                {bulletValues.year}
                                {getText('page32_bullet4_part4', lang)}
                            </span>
                        </li>
                    </ul>
                )}
                <h2 className="page32-section-title">
                    {getText('page32_section_title', lang)}
                </h2>
                <p 
                    className="page32-section-text"
                    role="region"
                    aria-label={getText('page32_section_text', lang)}
                    tabIndex="0"
                >
                    <span 
                        aria-hidden="true"
                        dangerouslySetInnerHTML={{
                            __html: getText('page32_section_text', lang).replace(
                                getText('page32_section_bold_text', lang),
                                `<span class="visual-bold">${getText('page32_section_bold_text', lang)}</span>`
                            )
                        }}
                    />
                </p>
                <div className="page32-chart-frame">
                    <h3 
                        className="page32-chart-title" 
                        aria-label={getChartTitleSR()} 
                    >
                        {getText('page32_chart_title', lang)}
                    </h3>

                        <div role="region" aria-label={getChartDataSummary()} tabIndex="0">
                        <div className="page32-chart-wrapper">
                            <figure ref={chartRef} className="page32-chart" style={{ margin: 0, position: 'relative' }}>
                                {selectedPoints !== null && (
                                    <button onClick={() => setSelectedPoints(null)} style={{ position: 'absolute', top: 0, right: 295, zIndex: 20 }}>{lang === 'en' ? 'Clear' : 'Effacer'}</button>
                                )}
                                <div aria-hidden="true">
                                <Plot
                                    data={processedChartData.traces}
                                    layout={{
                                        barmode: 'group',
                                        hovermode: 'closest',
                                        clickmode: 'event',
                                        dragmode: windowWidth <= 768 ? false : 'zoom',
                                        showlegend: true,
                                        legend: {
                                            orientation: windowWidth <= 1280 ? 'h' : 'v',
                                            x: windowWidth <= 1280 ? 0.5 : 1.02,
                                            xanchor: windowWidth <= 1280 ? 'center' : 'left',
                                            y: windowWidth <= 1280 ? -0.25 : 0.1,
                                            yanchor: windowWidth <= 1280 ? 'top' : 'middle',
                                            font: { size: windowWidth <= 480 ? 13 : 16, family: 'Arial, sans-serif' },
                                            itemclick: false,
                                            itemdoubleclick: false
                                        },
                                        xaxis: {
                                            tickvals: processedChartData.tickVals,
                                            showgrid: false,
                                            zeroline: false,
                                            range: [processedChartData.minYear - 0.5, processedChartData.maxYear + 0.5],
                                            tickangle: windowWidth <= 640 ? -45 : 0,
                                            tickfont: { size: windowWidth <= 480 ? 11 : 12, family: 'Arial, sans-serif' },
                                            automargin: true,
                                        },
                                        yaxis: {
                                            title: { 
                                                text: getText('page32_yaxis', lang), 
                                                font: { size: windowWidth <= 768 ? 14 : windowWidth <= 960 ? 16 : 18, family: 'Arial, sans-serif', color: '#333'},
                                                standoff: 5
                                            },
                                            range: [0, 55],
                                            dtick: 10,
                                            tickformat: '.0f',
                                            ticksuffix: '%',
                                            showgrid: false,
                                            showline: true,
                                            linewidth: 1,
                                            linecolor: '#333',
                                            automargin: true,
                                            tickfont: { size: windowWidth <= 480 ? 11 : 12, family: 'Arial, sans-serif' }
                                        },
                                        margin: { 
                                            l: 0, 
                                            r: 0,
                                            t: 20, 
                                            b: windowWidth <= 1280 ? 80 : 50
                                        },
                                        autosize: true,
                                        bargap: 0.15,
                                        bargroupgap: 0.1,
                                        paper_bgcolor: 'rgba(0,0,0,0)',
                                        plot_bgcolor: 'rgba(0,0,0,0)'
                                    }}
                                    style={{ width: '100%', height: '100%' }}
                                    useResizeHandler={true}
                                    onClick={(data) => {
                                        if (!data.points || data.points.length === 0) return;
                                        const clickedPoint = data.points[0];
                                        const traceIndex = clickedPoint.curveNumber;
                                        const pointIndex = clickedPoint.pointIndex;
                                        if (windowWidth <= 768) {
                                            const currentTime = new Date().getTime();
                                            const lastClick = lastClickRef.current;
                                            const isSamePoint = (traceIndex === lastClick.traceIndex && pointIndex === lastClick.pointIndex);
                                            const isDoubleTap = isSamePoint && (currentTime - lastClick.time < 300);
                                            
                                            lastClickRef.current = { time: currentTime, traceIndex, pointIndex };
                                            
                                            if (!isDoubleTap) {
                                                return; // Single tap: show hover label only
                                            }
                                        }

                                        setSelectedPoints(prev => {
                                            if (prev === null) {
                                                const newSelection = [[], [], []];
                                                newSelection[traceIndex].push(pointIndex);
                                                return newSelection;
                                            }

                                            const isSelected = prev[traceIndex]?.includes(pointIndex);

                                            if (isSelected) {
                                                const newSelection = prev.map((tracePoints, idx) => 
                                                    idx === traceIndex ? tracePoints.filter(p => p !== pointIndex) : [...tracePoints]
                                                );
                                                if (newSelection.every(arr => arr.length === 0)) {
                                                    return null;
                                                }
                                                return newSelection;
                                            } else {
                                                const newSelection = prev.map((tracePoints, idx) => 
                                                    idx === traceIndex ? [...tracePoints, pointIndex] : [...tracePoints]
                                                );
                                                return newSelection;
                                            }
                                        });
                                    }}
                                    config={{ 
                                        displayModeBar: true, 
                                        displaylogo: false,
                                        responsive: true,
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

                        <div className="page32-table-wrapper">
                            {getAccessibleDataTable()}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default Page32;
