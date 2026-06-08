import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { getGHGEmissionsData, getGhgNarrativeStats } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

const Page20 = () => {
    const { lang } = useOutletContext();
    const [pageData, setPageData] = useState([]);
    const [narrativeStats, setNarrativeStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isTableOpen, setIsTableOpen] = useState(false);

    const [hiddenSeries] = useState([]);
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

    useEffect(() => {
        const handleResize = () => {
            setWindowWidth(window.innerWidth);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        Promise.all([getGHGEmissionsData(), getGhgNarrativeStats()])
            .then(([data, stats]) => {
                setPageData(data);
                setNarrativeStats(stats);
            })
            .catch(err => {
                console.error("Failed to load GHG emissions data:", err);
                setError(err.message || 'Failed to load data');
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

            const downloadBtn = plotContainer.querySelector('.modebar-btn[data-title*="Download"], .modebar-btn[data-title*="Télécharger"]');
            
            if (downloadBtn) {
                downloadBtn.setAttribute('tabindex', '0');
                downloadBtn.setAttribute('role', 'button');
                
                const title = downloadBtn.getAttribute('data-title');
                if (title) downloadBtn.setAttribute('aria-label', title);

                downloadBtn.onkeydown = (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        downloadBtn.click();
                    }
                };
            }

            const otherButtons = plotContainer.querySelectorAll('.modebar-btn');
            otherButtons.forEach(btn => {
                const dataTitle = btn.getAttribute('data-title');
                if (!dataTitle || (!dataTitle.includes('Download') && !dataTitle.includes('Télécharger'))) {
                    btn.setAttribute('aria-hidden', 'true');
                    btn.setAttribute('tabindex', '-1');
                }
            });
        };

        const observer = new MutationObserver(setupChartAccessibility);
        observer.observe(chartRef.current, { childList: true, subtree: true });

        setupChartAccessibility();

        return () => observer.disconnect();
    }, [pageData, lang]);

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;
    if (pageData.length === 0) return <div className="page20-empty" style={{ padding: '24px 20px', marginTop: '32px' }} role="region" aria-label={lang === 'en' ? 'GHG emissions chart' : 'Graphique des émissions de GES'}>{lang === 'en' ? 'No data available.' : 'Aucune donnée disponible.'}</div>;

    const stats = narrativeStats ?? {
        baseYear: 2000,
        endYear: 2023,
        electricityPct: null,
        oilGasEmissionsPct: null,
        heavyIndustryPct: null,
        crudeProductionPct: null,
    };

    const formatPctDisplay = (value) => {
        const n = Math.abs(Math.round(Number(value)));
        return lang === 'fr' ? `${n} %` : `${n}%`;
    };

    const emissionsChangeShort = (pct) => {
        const n = formatPctDisplay(pct);
        if (lang === 'fr') {
            return Number(pct) < 0 ? `diminué de ${n}` : `augmenté de ${n}`;
        }
        return Number(pct) < 0 ? `decreased ${n}` : `increased ${n}`;
    };

    const yearRangePrefix = lang === 'fr'
        ? `Entre ${stats.baseYear} et ${stats.endYear}`
        : `Between ${stats.baseYear} and ${stats.endYear}`;

    const years = pageData.map(d => d.year);
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    const chartTitle = `${getText('page20_chart_title_prefix', lang)}${minYear}${lang === 'en' ? '–' : '-'}${maxYear}`;

    const tickVals = [];
    const tickStart = minYear % 2 === 0 ? minYear : minYear + 1;
    for (let y = tickStart; y <= maxYear; y += 2) {
        tickVals.push(y);
    }

    const bullet1Prefix = lang === 'fr'
        ? `${yearRangePrefix}, les `
        : `${yearRangePrefix}, `;
    const bullet1Highlight = stats.electricityPct != null
        ? (() => {
            const n = formatPctDisplay(stats.electricityPct);
            if (lang === 'fr') {
                const verb = Number(stats.electricityPct) < 0 ? `ont connu une baisse de ${n}` : `ont augmenté de ${n}`;
                return `émissions provenant de la production d'électricité ${verb}`;
            }
            const verb = Number(stats.electricityPct) < 0 ? `decreased ${n}` : `increased ${n}`;
            return `emissions from electricity production ${verb}`;
        })()
        : getText('page20_bullet1_part2', lang);
    const bullet1Text = `${bullet1Prefix}${bullet1Highlight}${getText('page20_bullet1_part3', lang)}`;

    const bullet2Highlight = stats.oilGasEmissionsPct != null
        ? emissionsChangeShort(stats.oilGasEmissionsPct)
        : getText('page20_bullet2_part2', lang);
    const bullet2ProductionPct = stats.crudeProductionPct != null
        ? formatPctDisplay(stats.crudeProductionPct)
        : null;
    const bullet2Text = bullet2ProductionPct != null
        ? `${getText('page20_bullet2_part1', lang)}${bullet2Highlight}${getText('page20_bullet2_part3a', lang)}${bullet2ProductionPct}${getText('page20_bullet2_part3b', lang)}`
        : `${getText('page20_bullet2_part1', lang)}${bullet2Highlight}${getText('page20_bullet2_part3', lang)}`;

    const bullet3Highlight = stats.heavyIndustryPct != null
        ? (() => {
            const n = formatPctDisplay(stats.heavyIndustryPct);
            if (lang === 'fr') {
                return Number(stats.heavyIndustryPct) < 0 ? `ont diminué de près de ${n}` : `ont augmenté de ${n}`;
            }
            return Number(stats.heavyIndustryPct) < 0 ? `have decreased by nearly ${n}` : `have increased by ${n}`;
        })()
        : getText('page20_bullet3_part2', lang);
    const bullet3Text = `${getText('page20_bullet3_part1', lang)}${bullet3Highlight}${getText('page20_bullet3_part3', lang)}`;

    const colors = {
        'oil_gas': '#819892',
        'heavy_industry': '#54A2AB',
        'transportation': '#214897',
        'buildings': '#647c8f',
        'electricity': '#2D9FA9',
        'waste_others': '#48A36C',
        'agriculture': '#857550'
    };

    const seriesConfig = [
        { id: 'oil_gas', key: 'oil_gas', labelKey: 'page20_legend_oil_gas' },
        { id: 'heavy_industry', key: 'heavy_industry', labelKey: 'page20_legend_heavy_industry' },
        { id: 'transportation', key: 'transportation', labelKey: 'page20_legend_transportation' },
        { id: 'buildings', key: 'buildings', labelKey: 'page20_legend_buildings' },
        { id: 'electricity', key: 'electricity', labelKey: 'page20_legend_electricity' },
        { id: 'waste_others', key: 'waste_others', labelKey: 'page20_legend_waste_others' },
        { id: 'agriculture', key: 'agriculture', labelKey: 'page20_legend_agriculture' }
    ];

    const getSeriesValues = (key) => pageData.map(d => d[key] || 0);

    const formatNumber = (val) => {
        return val.toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    };

    const stripHtml = (text) => text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';

    const hoverTemplate = (labelKey, values) => {
        return values.map((v, i) => {
            const y = years[i];
            return `<b>${getText(labelKey, lang)}</b><br>${y}: ${formatNumber(v)} Mt`;
        });
    };

    const getChartSummary = () => {
        if (lang === 'en') {
            return `Stacked bar chart showing GHG emissions by Canadian economic sector from ${minYear} to ${maxYear}. The chart displays emissions in megatonnes of CO2 equivalent for oil and gas, heavy industry, transportation, buildings, electricity, waste and others, and agriculture. Expand the data table below for detailed values.`;
        } else {
            return `Graphique à barres empilées montrant les émissions de GES par secteur économique canadien de ${minYear} à ${maxYear}. Le graphique affiche les émissions en mégatonnes d'équivalent CO2 pour le pétrole et gaz, l'industrie lourde, le transport, les bâtiments, l'électricité, les déchets et autres, et l'agriculture. Développez le tableau de données ci-dessous pour les valeurs détaillées.`;
        }
    };

    const getAccessibleDataTable = () => {
        const cellUnitText = lang === 'en' ? ' Mt CO₂ eq' : ' Mt éq. CO₂';
        const headerUnitVisual = lang === 'en' ? '(Mt)' : '(Mt)';
        const headerUnitSR = lang === 'en' ? '(megatonnes of CO2 equivalent)' : '(mégatonnes d\'équivalent CO2)';

        return (
            <details onToggle={(e) => setIsTableOpen(e.currentTarget.open)} className="page20-data-table">
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
                        display: windowWidth <= 768 ? 'none' : 'block' 
                    }}
                    aria-hidden="true"
                >
                    <div style={{ height: '20px' }}></div>
                </div>
                <div 
                    ref={tableScrollRef}
                    className="table-responsive"
                    tabIndex="0"
                >
                    <table className="table table-striped table-hover">
                        <caption className="wb-inv">
                            {lang === 'en' 
                                ? 'GHG emissions by Canadian economic sector (megatonnes of CO2 equivalent)' 
                                : 'Émissions de GES par secteur économique canadien (mégatonnes d\'équivalent CO2)'}
                        </caption>
                        <thead>
                            <tr>
                                <th scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>
                                    {lang === 'en' ? 'Year' : 'Année'}
                                </th>
                                {seriesConfig.map(series => (
                                    <th key={series.id} scope="col" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>
                                        {stripHtml(getText(series.labelKey, lang))}<br/>
                                        <span aria-hidden="true">{headerUnitVisual}</span>
                                        <span className="wb-inv">{headerUnitSR}</span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {pageData.map(yearData => (
                                <tr key={yearData.year}>
                                    <th scope="row" className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>
                                        {yearData.year}
                                    </th>
                                    {seriesConfig.map(series => (
                                        <td 
                                            key={series.id}
                                            style={{ textAlign: 'right', border: '1px solid #ddd' }}
                                            aria-label={`${yearData.year}, ${stripHtml(getText(series.labelKey, lang))}: ${formatNumber(yearData[series.key] || 0)}${cellUnitText}`}
                                        >
                                            {formatNumber(yearData[series.key] || 0)}
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
        );
    };

    const downloadTableAsCSV = () => {
        const unitHeader = lang === 'en' ? '(Mt CO2 eq)' : '(Mt éq. CO2)';
        const headers = [
            lang === 'en' ? 'Year' : 'Année',
            ...seriesConfig.map(s => `${stripHtml(getText(s.labelKey, lang))} ${unitHeader}`)
        ];
        const rows = pageData.map(yearData => [
            yearData.year,
            ...seriesConfig.map(s => (yearData[s.key] || 0).toFixed(1))
        ]);
        const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = lang === 'en' ? 'ghg_emissions_by_sector_data.csv' : 'emissions_ges_par_secteur_donnees.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const downloadTableAsDocx = async () => {
        const unitHeader = lang === 'en' ? '(Mt)' : '(Mt)';
        const title = stripHtml(chartTitle);

        const headers = [
            lang === 'en' ? 'Year' : 'Année',
            ...seriesConfig.map(s => `${stripHtml(getText(s.labelKey, lang))} ${unitHeader}`)
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
                ...seriesConfig.map(s => new TableCell({ 
                    children: [new Paragraph({ 
                        children: [new TextRun({ text: (yearData[s.key] || 0).toFixed(1), size: 22 })], 
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
                        columnWidths: [1000, 1400, 1400, 1400, 1200, 1200, 1400, 1200],
                        rows: [headerRow, ...dataRows]
                    })
                ]
            }]
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'ghg_emissions_by_sector_table.docx' : 'emissions_ges_par_secteur_tableau.docx');
    };

    const downloadChartWithTitle = async (plotEl = null) => {
        const plotElement = plotEl || document.querySelector('.page20-chart.js-plotly-plot') || document.querySelector('.page20-chart-wrapper .js-plotly-plot');
        if (!plotElement) {
            console.error('Plot element not found');
            alert('Could not find chart element. Please try again.');
            return;
        }

        const title = stripHtml(chartTitle);

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
                const legendHeight = 100;
                canvas.width = img.width;
                canvas.height = img.height + titleHeight + legendHeight;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#333333';
                ctx.font = 'bold 36px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(title, canvas.width / 2, 50);
                ctx.drawImage(img, 0, titleHeight);

                const legendY = titleHeight + img.height + 30;
                ctx.font = '20px Arial';
                ctx.textAlign = 'left';
                let xPos = 50;
                let yPos = legendY;

                seriesConfig.forEach((item, idx) => {
                    const label = stripHtml(getText(item.labelKey, lang));
                    ctx.fillStyle = colors[item.id];
                    ctx.fillRect(xPos, yPos - 14, 20, 20);
                    ctx.fillStyle = '#333333';
                    ctx.fillText(label, xPos + 28, yPos);
                    xPos += ctx.measureText(label).width + 60;
                    if (xPos > canvas.width - 200 && idx < seriesConfig.length - 1) {
                        xPos = 50;
                        yPos += 30;
                    }
                });

                const link = document.createElement('a');
                link.download = lang === 'en' ? 'ghg_emissions_by_sector_chart.png' : 'emissions_ges_par_secteur_graphique.png';
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

    const legendItems = seriesConfig.map(s => ({
        id: s.id,
        label: getText(s.labelKey, lang),
        color: colors[s.id]
    }));

    const isColumnFormat = windowWidth <= 1400;
    const chartMarginLeft = 60;
    const chartMarginRight = isColumnFormat ? 0 : 15;

    return (
        <main 
            id="main-content"
            tabIndex="-1"
            className="page-content page-20" 
            role="main"
            aria-label={chartTitle}
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
                .wb-inv {
                    clip: rect(1px, 1px, 1px, 1px);
                    height: 1px;
                    margin: 0;
                    overflow: hidden;
                    position: absolute;
                    width: 1px;
                    white-space: nowrap;
                }

                .page-20 {
                    width: 100%;
                    max-width: 100%;
                    overflow-x: hidden;
                    box-sizing: border-box;
                }

                .page20-chart-wrapper {
                    position: relative;
                    width: calc(100% + 30px);
                    margin-left: 0px;
                }

                @media (max-width: 1400px) {
                    .page20-chart-wrapper {
                        width: 100%;
                        margin-left: 0;
                    }
                }

                .page20-chart-wrapper div[role="button"]:focus {
                    outline: none !important;
                    box-shadow: none !important;
                }

                .chart-title-wrapper {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    width: 100%;
                    box-sizing: border-box;
                    margin-bottom: 10px;
                }

                .page20-legend {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 15px;
                    margin-top: 15px;
                    cursor: default;
                    justify-content: center;
                    width: 100%;
                    box-sizing: border-box;
                }

                .page20-table-btn-wrapper {
                    width: 100%;
                    position: relative;
                    z-index: 50;
                }

                .page20-container { width: 100%; display: flex; flex-direction: column; min-height: 100%; padding-top: 20px; }

                .page20-content-row { 
                    display: flex; 
                    flex-direction: row; 
                    flex: 1; 
                    width: 100%; 
                    overflow: visible;
                    gap: 40px;
                }

                .page20-chart-column { 
                    width: 55%; 
                }

                .page20-text-column {
                    width: 45%;
                    padding-top: 30px;
                    padding-left: 30px; 
                    padding-right: 0;
                    box-sizing: border-box;
                    min-width: 300px; 
                }

                .page20-chart-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 29px;
                    font-weight: bold;
                    color: var(--gc-text);
                    line-height: 1.2;
                    max-width: 100%;
                    text-align: center;
                }

                .page20-legend-item {
                    display: flex;
                    align-items: center;
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 18px;
                    color: var(--gc-text);
                    cursor: default;
                    user-select: none;
                }
                .page20-legend-color { width: 15px; height: 15px; margin-right: 8px; display: inline-block; }

                .page20-bullet {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                }

                .page20-source {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 16px;
                    color: #666;
                    margin-top: 20px;
                }

                .js-plotly-plot .plotly .modebar {
                    right: 20px !important;
                    top: 2px !important;
                }

                .page20-chart-wrapper button:focus {
                    outline: 4px solid #ffbf47 !important;
                    outline-offset: 2px !important;
                }

                .page20-chart { width: 100%; height: 350px; }

                .layout-stacked {
                    flex-direction: column !important;
                    height: auto !important;
                    align-items: center !important;
                }
                .layout-stacked .page20-chart-column {
                    width: 100% !important;
                    height: auto !important;
                    max-height: none !important;
                    margin-bottom: 30px !important;
                    overflow: visible !important;
                }
                .layout-stacked .page20-text-column {
                    width: 100% !important;
                    padding-left: 0 !important;
                    padding-right: 0 !important;
                    padding-top: 0 !important;
                    margin-top: 20px !important;
                }

                @media (max-width: 1400px) {
                    .page20-content-row { flex-direction: column; }
                    .page20-chart-column { width: 100%; margin-bottom: 30px; }
                    .page20-text-column { width: 100%; padding-top: 0; padding-left: 0; }
                }

                @media (max-width: 768px) {
                    .page20-chart-title {
                        font-size: 26px;
                    }
                    .page20-legend-item {
                        font-size: 16px;
                    }
                    .page20-bullet {
                        font-size: 18px;
                    }
                }

                @media (max-width: 640px) {
                    .page-20 { 
                        border-left: none !important; 
                        margin-left: 0;
                        width: 100%;
                        padding-left: 0;
                    }
                    .page20-legend {
                        flex-direction: column !important;
                        align-items: flex-start !important;
                    }
                }

                @media (max-width: 480px) {
                    .page20-chart { height: 300px; }
                }

                .page20-chart-frame {
                    background-color: #f5f5f5;
                    padding: 20px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                    box-sizing: border-box;
                }

                .page20-table-wrapper {
                    display: block;
                    width: 100%;
                    margin: 0;
                }

                .page20-data-table {
                    width: 100%;
                    margin-top: 20px;
                    margin-bottom: 0;
                    position: relative;
                    z-index: 100;
                }

                .page20-data-table > summary {
                    display: block;
                    width: 100%;
                    padding: 12px 15px;
                    background-color: #8C8C8C;
                    border: 1px solid #404040;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: bold;
                    color: #ffffff;
                    box-sizing: border-box;
                    list-style: none;
                }

                .page20-data-table > summary:hover {
                    background-color: #404040 !important;
                }

                .page20-data-table button[type="button"]:hover,
                .page20-data-table button:hover,
                .page20-chart-frame button[type="button"]:hover,
                .page20-chart-frame button:hover,
                .page20-chart-wrapper button[type="button"]:hover,
                .page20-chart-wrapper button:hover {
                    background-color: #404040 !important;
                }

                .page20-data-table > summary::-webkit-details-marker {
                    display: none;
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

            <div className="page20-container">
                <div className={`page20-content-row ${isTableOpen ? 'layout-stacked' : ''}`}>
                    <div className="page20-chart-column">
                        <div className="page20-chart-frame">
                            <h2 id="page20-chart-title" className="page20-chart-title" tabIndex="0">
                                {chartTitle}
                            </h2>

                            <div role="region" aria-label={getChartSummary()} tabIndex="0">
                                <figure ref={chartRef} className="page20-chart-wrapper">
                                    {selectedPoints !== null && (
                                        <div style={{ marginBottom: 8 }}>
                                            <button type="button" onClick={() => setSelectedPoints(null)} style={{ padding: '6px 12px', backgroundColor: '#8C8C8C', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontSize: 14, color: '#fff' }}>{lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}</button>
                                        </div>
                                    )}
                                    <Plot
                                        data={seriesConfig.map((series, idx) => ({
                                            name: getText(series.labelKey, lang),
                                            x: years,
                                            y: getSeriesValues(series.key),
                                            type: 'bar',
                                            marker: {
                                                color: colors[series.id],
                                                opacity: selectedPoints === null ? 1 : years.map((_, i) => selectedPoints[idx]?.includes(i) ? 1 : 0.3)
                                            },
                                            hovertext: hoverTemplate(series.labelKey, getSeriesValues(series.key)),
                                            hoverinfo: 'text',
                                            visible: hiddenSeries.includes(series.id) ? 'legendonly' : true
                                        }))}
                                        layout={{
                                            barmode: 'stack',
                                            hoverlabel: { bgcolor: '#ffffff' },
                                            showlegend: false,
                                            clickmode: 'event',
                                            dragmode: windowWidth <= 768 ? false : 'zoom',
                                            xaxis: {
                                                tickvals: tickVals,
                                                automargin: true,
                                                tickangle: windowWidth <= 400 ? +90 : 'auto'
                                            },
                                            yaxis: {
                                                title: { text: getText('page20_yaxis', lang) },
                                                automargin: true,
                                            },
                                            margin: { l: chartMarginLeft, r: chartMarginRight, t: 30, b: 10 },
                                            autosize: true,
                                            bargap: 0.2,
                                            paper_bgcolor: 'rgba(0,0,0,0)',
                                            plot_bgcolor: 'rgba(0,0,0,0)'
                                        }}
                                        className="page20-chart"
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
                                                    return;
                                                }
                                            }

                                            setSelectedPoints(prev => {
                                                if (prev === null) {
                                                    const newSelection = seriesConfig.map(() => []);
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
                                </figure>
                            </div>

                            <div className="page20-legend" aria-hidden="true">
                                {legendItems.map((item) => (
                                    <div
                                        key={item.id}
                                        className="page20-legend-item"
                                    >
                                        <span className="page20-legend-color" style={{ backgroundColor: item.color }}></span>
                                        <span>{item.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="page20-table-wrapper">
                            {getAccessibleDataTable()}
                        </div>
                    </div>

                    <aside className="page20-text-column">
                        <ul style={{ listStyleType: 'disc', paddingLeft: '20px', margin: '0', color: '#333' }}>
                            <li 
                                className="page20-bullet" 
                                style={{ marginBottom: '20px', lineHeight: '1.4', marginTop: '20px' }}
                                aria-label={bullet1Text}
                            >
                                <span aria-hidden="true">
                                    {bullet1Prefix}
                                    <strong>{bullet1Highlight}</strong>
                                    {getText('page20_bullet1_part3', lang)}
                                </span>
                            </li>

                            <li 
                                className="page20-bullet" 
                                style={{ marginBottom: '20px', lineHeight: '1.4' }}
                                aria-label={bullet2Text}
                            >
                                <span aria-hidden="true">
                                    {getText('page20_bullet2_part1', lang)}
                                    <strong>{bullet2Highlight}</strong>
                                    {bullet2ProductionPct != null ? (
                                        <>
                                            {getText('page20_bullet2_part3a', lang)}
                                            <strong>{bullet2ProductionPct}</strong>
                                            {getText('page20_bullet2_part3b', lang)}
                                        </>
                                    ) : (
                                        getText('page20_bullet2_part3', lang)
                                    )}
                                </span>
                            </li>

                            <li 
                                className="page20-bullet" 
                                style={{ marginBottom: '2px', lineHeight: '1.4' }}
                                aria-label={bullet3Text}
                            >
                                <span aria-hidden="true">
                                    {getText('page20_bullet3_part1', lang)}
                                    <strong>{bullet3Highlight}</strong>
                                    {getText('page20_bullet3_part3', lang)}
                                </span>
                            </li>
                        </ul>
                    </aside>
                </div>
            </div>
        </main>
    );
};

export default Page20;
