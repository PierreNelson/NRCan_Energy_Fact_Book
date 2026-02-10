import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { getInternationalInvestmentData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
const Page31 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [pageData, setPageData] = useState([]);
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

    const scrollToFootnote = (e) => {
        e.preventDefault();
        document.getElementById('fn-asterisk-page31')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const scrollToRef = (e) => {
        e.preventDefault();
        document.getElementById('fn-asterisk-rf-page31')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

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
        getInternationalInvestmentData()
            .then(data => {
                setPageData(data);
            })
            .catch(err => {
                console.error("Failed to load international investment data:", err);
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
        'cdia': '#419563',  
        'fdi': '#2EA3AD',  
    };

    const chartData = useMemo(() => {
        if (pageData.length === 0) return null;

        const years = pageData.map(d => d.year);
        const minYear = Math.min(...years);
        const maxYear = Math.max(...years);

        const tickVals = [];
        for (let y = 2008; y <= maxYear; y += 2) {
            tickVals.push(y);
        }

        const cdiaValues = pageData.map(d => (d.cdia || 0) / 1000);
        const fdiValues = pageData.map(d => (d.fdi || 0) / 1000);

        const cdiaHoverText = cdiaValues.map((v, i) => {
            const vFormatted = v < 1 ? v.toFixed(2) : v.toFixed(1);
            return `<b>${getText('page31_hover_cdia', lang)}</b><br>${years[i]}: $${vFormatted}B`;
        });

        const fdiHoverText = fdiValues.map((v, i) => {
            const vFormatted = v < 1 ? v.toFixed(2) : v.toFixed(1);
            return `<b>${getText('page31_hover_fdi', lang)}</b><br>${years[i]}: $${vFormatted}B`;
        });

        const traces = [
            {
                name: getText('page31_legend_cdia', lang),
                x: years,
                y: cdiaValues,
                type: 'bar',
                marker: { 
                    color: COLORS.cdia,
                    opacity: selectedPoints === null ? 1 : years.map((_, i) => selectedPoints[0]?.includes(i) ? 1 : 0.3)
                },
                hovertext: cdiaHoverText,
                hoverinfo: 'text',
                hoverlabel: {
                    bgcolor: '#ffffff',
                    bordercolor: '#000000',
                    font: { color: '#000000', size: windowWidth <= 480 ? 12 : 14, family: 'Arial, sans-serif' }
                }
            },
            {
                name: getText('page31_legend_fdi', lang),
                x: years,
                y: fdiValues,
                type: 'bar',
                marker: { 
                    color: COLORS.fdi,
                    opacity: selectedPoints === null ? 1 : years.map((_, i) => selectedPoints[1]?.includes(i) ? 1 : 0.3)
                },
                hovertext: fdiHoverText,
                hoverinfo: 'text',
                hoverlabel: {
                    bgcolor: '#ffffff',
                    bordercolor: '#000000',
                    font: { color: '#000000', size: windowWidth <= 480 ? 12 : 14, family: 'Arial, sans-serif' }
                }
            }
        ];

        return { traces, years, tickVals, minYear, maxYear, cdiaValues, fdiValues };
    }, [pageData, lang, windowWidth, selectedPoints]);

    const formatBillionSR = (val) => {
        const decimals = val < 1 ? 2 : 1;
        return lang === 'en' 
            ? `${val.toFixed(decimals)} billion dollars` 
            : `${val.toFixed(decimals)} milliards de dollars`;
    };

    const getChartDataSummary = () => {
        if (!pageData || pageData.length === 0) return '';

        const latestYear = pageData[pageData.length - 1];
        const latestYearNum = latestYear.year;
        const latestCDIA = (latestYear.cdia || 0) / 1000;
        const latestFDI = (latestYear.fdi || 0) / 1000;

        if (lang === 'en') {
            return `Grouped bar chart showing stock of foreign direct investment in Canada and Canadian direct investment abroad in the energy industry from ${chartData?.minYear} to ${latestYearNum}. In ${latestYearNum}, Canadian direct investment abroad was approximately ${formatBillionSR(latestCDIA)} and foreign direct investment was approximately ${formatBillionSR(latestFDI)}. Expand the data table below for detailed values.`;
        } else {
            return `Graphique à barres groupées montrant le stock d'investissement direct étranger au Canada et l'investissement direct canadien à l'étranger dans le secteur de l'énergie de ${chartData?.minYear} à ${latestYearNum}. En ${latestYearNum}, l'investissement direct canadien à l'étranger était d'environ ${formatBillionSR(latestCDIA)} et l'investissement direct étranger était d'environ ${formatBillionSR(latestFDI)}. Développez le tableau de données ci-dessous pour les valeurs détaillées.`;
        }
    };

    const getChartTitleSR = () => {
        if (lang === 'en') {
            return 'Stock of foreign direct investment in Canada and Canadian direct investment abroad in the energy industry';
        } else {
            return "Stock d'investissement direct étranger au Canada et investissement direct canadien à l'étranger dans le secteur de l'énergie";
        }
    };

    const renderTextWithFootnoteLink = (text) => {
        if (!text) return null;
        if (!text.includes('*')) return text;
        const parts = text.split('*');
        return parts.map((part, index) => (
            <React.Fragment key={index}>
                {part}
                {index < parts.length - 1 && (
                    <span id="fn-asterisk-rf-page31" style={{ verticalAlign: 'super', fontSize: '0.75em', lineHeight: '0' }}>
                        <a className="fn-lnk" href="#fn-asterisk-page31" onClick={scrollToFootnote}>
                            <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span><span aria-hidden="true">*</span>
                        </a>
                    </span>
                )}
            </React.Fragment>
        ));
    };

    const formatNumber = (val) => {
        const decimals = val < 1 ? 2 : 1;
        return val.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { 
            minimumFractionDigits: decimals, 
            maximumFractionDigits: decimals 
        });
    };

    const getAccessibleDataTable = () => {
        if (!pageData || pageData.length === 0) return null;

        const cellUnitSR = lang === 'en' ? ' billion dollars' : ' milliards de dollars';
        const headerUnitVisual = lang === 'en' ? '($ billions)' : '(milliards $)';
        const headerUnitSR = lang === 'en' ? '(billions of dollars)' : '(milliards de dollars)';
        const captionId = 'page31-table-caption';
        const cdiaLabel = getText('page31_legend_cdia', lang);
        const fdiLabel = getText('page31_legend_fdi', lang);

        return (
            <details 
                onToggle={(e) => setIsTableOpen(e.currentTarget.open)}
                className="page31-data-table"
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
                    <span className="sr-only">{lang === 'en' ? ' (press Enter to open or close)' : ' (appuyez sur Entrée pour ouvrir ou fermer)'}</span>
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
                                ? 'Stock of foreign direct investment (FDI) in Canada and Canadian direct investment abroad (CDIA) in the energy industry (billions of dollars)'
                                : "Stock d'investissement direct étranger (IDE) au Canada et investissement direct canadien à l'étranger (IDCE) dans le secteur de l'énergie (milliards de dollars)"}
                        </caption>
                        <thead>
                            <tr>
<th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{lang === 'en' ? 'Year' : 'Année'}</th>
                                                <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>
                                                    {cdiaLabel}<br/>
                                                    <span aria-hidden="true">{headerUnitVisual}</span>
                                                    <span className="wb-inv">{headerUnitSR}</span>
                                                </th>
                                                <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>
                                                    {fdiLabel}<br/>
                                                    <span aria-hidden="true">{headerUnitVisual}</span>
                                                    <span className="wb-inv">{headerUnitSR}</span>
                                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {pageData.map(yearData => {
                                const cdiaVal = (yearData.cdia || 0) / 1000;
                                const fdiVal = (yearData.fdi || 0) / 1000;
                                return (
                                    <tr key={yearData.year}>
                                        <th scope="row" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{yearData.year}</th>
                                        <td 
                                            style={{ textAlign: 'right', border: '1px solid #ddd' }}
                                            aria-label={`${yearData.year}, ${cdiaLabel}: ${formatNumber(cdiaVal)}${cellUnitSR}`}
                                        >
                                            {formatNumber(cdiaVal)}
                                        </td>
                                        <td 
                                            style={{ textAlign: 'right', border: '1px solid #ddd' }}
                                            aria-label={`${yearData.year}, ${fdiLabel}: ${formatNumber(fdiVal)}${cellUnitSR}`}
                                        >
                                            {formatNumber(fdiVal)}
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

        const cdiaLabel = getText('page31_legend_cdia', lang);
        const fdiLabel = getText('page31_legend_fdi', lang);
        const unitHeader = lang === 'en' ? '($ billions)' : '(milliards $)';
        const headers = [
            lang === 'en' ? 'Year' : 'Année',
            `${cdiaLabel} ${unitHeader}`,
            `${fdiLabel} ${unitHeader}`
        ];
        const rows = pageData.map(yearData => [
            yearData.year,
            ((yearData.cdia || 0) / 1000).toFixed(2),
            ((yearData.fdi || 0) / 1000).toFixed(2)
        ]);
        const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = lang === 'en' ? 'fdi_investment_data.csv' : 'ide_investissement_donnees.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };
    const downloadTableAsDocx = async () => {
        if (!pageData || pageData.length === 0) return;

        const cdiaLabel = getText('page31_legend_cdia', lang);
        const fdiLabel = getText('page31_legend_fdi', lang);
        const unitHeader = lang === 'en' ? '($ billions)' : '(milliards $)';
        const title = stripHtml(getText('page31_title', lang));

        const headers = [
            lang === 'en' ? 'Year' : 'Année',
            `${cdiaLabel} ${unitHeader}`,
            `${fdiLabel} ${unitHeader}`
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
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: ((yearData.cdia || 0) / 1000).toFixed(2), size: 22 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: ((yearData.fdi || 0) / 1000).toFixed(2), size: 22 })], alignment: AlignmentType.RIGHT })] })
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
                        columnWidths: [1800, 3700, 3700],
                        rows: [headerRow, ...dataRows]
                    })
                ]
            }]
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'fdi_investment_table.docx' : 'ide_investissement_tableau.docx');
    };
    const downloadChartWithTitle = async (plotEl = null) => {
        const plotElement = plotEl || document.querySelector('.page31-chart .js-plotly-plot') || document.querySelector('#page-31 .js-plotly-plot');
        if (!plotElement) {
            console.error('Plot element not found');
            alert('Could not find chart element. Please try again.');
            return;
        }

        const title = stripHtml(getText('page31_chart_title', lang));

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
                link.download = lang === 'en' ? 'fdi_investment_chart.png' : 'ide_investissement_graphique.png';
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

    if (!chartData) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>No data available. Please refresh the page.</div>;
    }

    return (
        <main 
            id="main-content"
            tabIndex="-1"
            className="page-content page-31" 
            role="main"
            aria-label={getText('page31_title', lang)}
            style={{
                backgroundColor: 'white',
                flex: '1 1 auto',
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto',
                overflowX: 'visible',
                boxSizing: 'border-box',
            }}
        >
            <style>{`

                .page-31 {
                    margin-right: -${layoutPadding?.right || 15}px;
                    width: calc(100% + ${layoutPadding?.right || 15}px);
                    padding-right: ${layoutPadding?.right || 15}px; 
                }

                .page31-container {
                    width: 100%;
                    padding: 15px 0 0 0; 
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                    flex: 1;
                    overflow: visible;
                }

                .page31-chart {
                    height: calc(100vh - 700px);
                    width: 100%;
                    min-height: 500px;
                }

                .page31-title {
                    font-family: 'Lato', sans-serif;
                    color: #245e7f;
                    font-size: 50px;
                    font-weight: bold;
                    margin-bottom: 10px;
                    margin-top: 5px;
                    position: relative;
                    padding-bottom: 0.5em;
                }

                .page31-title::after {
                    content: '';
                    position: absolute;
                    left: 0;
                    bottom: 0.2em;
                    width: 72px;
                    height: 6px;
                    background-color: var(--gc-red);
                }

                .page31-subtitle {
                    font-family: 'Noto Sans', sans-serif;
                    color: #332f30;
                    font-size: 20px;
                    margin-bottom: 15px;
                    line-height: 1.5;
                    max-width: 65ch;
                }

                .page31-chart-title {
                    font-family: 'Lato', sans-serif;
                    color: var(--gc-text);
                    font-size: 29px;
                    font-weight: bold;
                    text-align: center;
                    margin-bottom: 5px;
                }

                .page31-data-table {
                    margin-top: 10px;
                    margin-bottom: 10px;
                    margin-left: 0;
                    margin-right: 0;
                    font-family: Arial, sans-serif;
                    width: 100%;
                }

                .page31-footnotes {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                    color: #555;
                    margin-top: 10px;
                    line-height: 1.4;
                    max-width: 65ch;
                }

                @media (max-width: 1745px) {
                    .page31-chart {
                        height: calc(100vh - 450px);
                        min-height: 480px;
                    }
                }

                @media (max-width: 1536px) {
                    .page31-title {
                        font-size: 1.8rem;
                    }
                    .page31-chart {
                        height: calc(100vh - 420px);
                        min-height: 460px;
                    }
                }

                @media (max-width: 1280px) {
                    .page31-title {
                        font-size: 1.6rem;
                    }
                    .page31-chart {
                        height: calc(100vh - 380px);
                        min-height: 440px;
                    }
                }

                @media (max-width: 1097px) {
                    .page31-title {
                        font-size: 1.5rem;
                    }
                    .page31-subtitle {
                        font-size: 1.2rem;
                    }
                    .page31-chart {
                        height: calc(100vh - 340px);
                        min-height: 420px;
                    }
                }

                @media (max-width: 960px) {
                    .page31-title {
                        font-size: 1.4rem;
                    }
                    .page31-subtitle {
                        font-size: 1.2rem;
                    }
                    .page31-chart {
                        height: calc(100vh - 280px);
                        min-height: 400px;
                    }
                }

                @media (max-width: 768px) {
                    .page-31 { border-right: none !important; }
                    .page31-title {
                        font-size: 37px;
                        text-align: left !important;
                    }
                    .page31-subtitle {
                        font-size: 18px;
                        text-align: left !important;
                    }
                    .page31-chart-title {
                        font-size: 26px;
                    }
                    .page31-chart {
                        height: calc(100vh - 280px);
                        min-height: 350px;
                    }
                    .page31-footnotes {
                        font-size: 18px;
                    }
                }

                @media (max-width: 640px) {
                    .page31-title {
                        font-size: 1.2rem;
                    }
                    .page31-subtitle {
                        font-size: 1.2rem;
                    }
                    .page31-chart {
                        height: calc(100vh - 260px);
                        min-height: 320px;
                    }
                }

                @media (max-width: 480px) {
                    .page31-title {
                        font-size: 1.1rem;
                    }
                    .page31-subtitle {
                        font-size: 1.2rem;
                    }
                    .page31-chart {
                        height: calc(100vh - 240px);
                        min-height: 280px;
                    }
                }

                @media (max-width: 384px) {
                    .page31-title {
                        font-size: 1rem;
                    }
                    .page31-subtitle {
                        font-size: 1.2rem;
                    }
                    .page31-chart {
                        height: calc(100vh - 220px);
                        min-height: 250px;
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

                .page31-chart-frame {
                    background-color: #f5f5f5;
                    padding: 20px;
                    border-radius: 8px;
                    box-sizing: border-box;
                }

                .page31-table-wrapper {
                    display: block;
                    width: 100%;
                    margin: 0;
                }

                .page31-table-wrapper details > summary {
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

                .page31-table-wrapper details > summary::-webkit-details-marker {
                    display: none;
                }

                .page31-table-wrapper details > summary:hover {
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

            <div className="page31-container">
                <header role="region" aria-label={getText('page31_title', lang)}>
                    <h1 className="page31-title" aria-hidden="true">
                        {getText('page31_title', lang)}
                    </h1>
                    <p className="page31-subtitle">
                        {getText('page31_subtitle', lang)}
                    </p>
                </header>

                <div className="page31-chart-frame">
                    <h2 className="page31-chart-title">
                        {renderTextWithFootnoteLink(getText('page31_chart_title', lang))}
                    </h2>

                    <div 
                        role="region"
                        aria-label={getChartDataSummary()}
                        tabIndex="0"
                    >
                        <figure 
                            ref={chartRef} 
                            className="page31-chart"
                            style={{ margin: 0, position: 'relative' }}
                        >
                            {selectedPoints !== null && (
                                <button onClick={() => setSelectedPoints(null)} style={{ position: 'absolute', top: 0, right: 295, zIndex: 20 }}>{lang === 'en' ? 'Clear' : 'Effacer'}</button>
                            )}
                            <div aria-hidden="true">
                            <Plot
                            data={chartData.traces}
                            layout={{
                                barmode: 'group',
                                hovermode: 'closest',
                                clickmode: 'event',
                                dragmode: windowWidth <= 768 ? false : 'zoom',
                                xaxis: {
                                    tickvals: chartData.tickVals,
                                    showgrid: false,
                                    zeroline: false,
                                    range: [chartData.minYear - 0.5, chartData.maxYear + 0.5],
                                    tickangle: windowWidth <= 640 ? -45 : 0,
                                    tickfont: { size: windowWidth <= 480 ? 10 : 12, family: 'Arial, sans-serif' },
                                    automargin: true,
                                },
                                yaxis: {
                                    title: { 
                                        text: getText('page31_yaxis', lang), 
                                        font: { size: windowWidth <= 768 ? 18 : windowWidth <= 960 ? 20 : 24, family: 'Arial, sans-serif', color: '#58585a'},
                                        standoff: 5
                                    },
                                    rangemode: 'tozero',
                                    showgrid: false,
                                    showline: true,
                                    linewidth: 1,
                                    linecolor: '#333',
                                    automargin: true,
                                    tickfont: { size: windowWidth <= 480 ? 9 : 11, family: 'Arial, sans-serif' }
                                },
                                legend: {
                                    orientation: 'h',
                                    x: windowWidth <= 384 ? 0.17 : windowWidth <= 480 ? 0.13 : windowWidth <= 640 ? 0.12 : windowWidth <= 768 ? 0.094 : windowWidth <= 960 ? 0.074 : windowWidth <= 1097 ? 0.064 : windowWidth <= 1280 ? 0.052 : windowWidth <= 1536 ? 0.044 : windowWidth <= 1745 ? 0.044 : 0.045,
                                    xanchor: 'center',
                                    y: windowWidth <= 384 ? -0.40 : windowWidth <= 480 ? -0.34 : windowWidth <= 640 ? -0.34 : windowWidth <= 768 ? -0.24 : windowWidth <= 960 ? -0.18 : windowWidth <= 1097 ? -0.16 :windowWidth <= 1280 ? -0.16 : windowWidth <= 1536 ? -0.16 : windowWidth <= 1745 ? -0.16 : -0.16,
                                    yanchor: 'bottom',
                                    font: { size: windowWidth <= 480 ? 11 : 18, family: 'Arial, sans-serif' },
                                    traceorder: 'normal',
                                    itemclick: false,
                                    itemdoubleclick: false
                                },
                                margin: { 
                                    l: 0, 
                                    r: 0,
                                    t: 40, 
                                    b: 50
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
                                        const newSelection = [[], []];
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
                                scrollZoom: false,
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

                        <div className="page31-table-wrapper">
                            {getAccessibleDataTable()}
                        </div>
                    </div>
                </div>

                <aside className="wb-fnote" role="note">
                    <h2 id="fn">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt>{lang === 'en' ? 'Footnote *' : 'Note de bas de page *'}</dt>
                        <dd id="fn-asterisk-page31" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', width: '100%' }}>
                                <a href="#fn-asterisk-rf-page31" onClick={scrollToRef} className="fn-num" title={lang === 'en' ? 'Return to footnote * referrer' : 'Retour à la référence de la note de bas de page *'}>
                                    <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>*
                                </a>
                                <p style={{ margin: 0 }}>{getText('page31_footnote', lang)}</p>
                            </div>
                            <p style={{ margin: '10px 0 0 0', paddingLeft: '1.85rem' }}>{getText('page31_footnote1', lang)}</p>
                        </dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default Page31;
