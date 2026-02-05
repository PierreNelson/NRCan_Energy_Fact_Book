import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { getMajorProjectsData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
const Page28 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [pageData, setPageData] = useState({ yearlyData: [], summary: {} });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [isChartInteractive, setIsChartInteractive] = useState(typeof window !== 'undefined' ? window.innerWidth > 768 : true);
    const [selectedPoints, setSelectedPoints] = useState(null);
    const chartRef = useRef(null);
    const lastClickRef = useRef({ time: 0, seriesIndex: null, pointIndex: null });
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
            if (windowWidth <= 768 && isChartInteractive && chartRef.current && !chartRef.current.contains(event.target)) {
                setIsChartInteractive(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isChartInteractive, windowWidth]);

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
        getMajorProjectsData()
            .then(data => {
                setPageData(data);
            })
            .catch(err => {
                console.error("Failed to load major projects data:", err);
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

    const COLORS = {
        'oil_gas_value': '#857550',
        'electricity_value': '#224397',
        'other_value': '#2B9FAB',
        'oil_gas_projects': '#AC9316',
        'electricity_projects': '#8E9195',
        'other_projects': '#EE6F2B',
    };

    const formatBillion = (val) => {
        if (lang === 'en') {
            return `$${Math.round(val)}B`;
        } else {
            return `${Math.round(val)} G$`;
        }
    };

    const formatBillionSR = (val) => {
        return lang === 'en' 
            ? `${Math.round(val)} billion dollars` 
            : `${Math.round(val)} milliards de dollars`;
    };

    const formatNumber = (num) => {
        if (num === undefined || num === null) return '—';
        return Math.round(num).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA');
    };

    const getChartSummary = () => {
        if (!pageData.yearlyData || pageData.yearlyData.length === 0) return '';
        const yrs = pageData.yearlyData.map(d => d.year);
        const minYr = yrs.length > 0 ? Math.min(...yrs) : 2021;
        const maxYr = yrs.length > 0 ? Math.max(...yrs) : 2024;
        const latestYr = maxYr;
        const latestD = pageData.yearlyData.find(d => d.year === latestYr) || {};
        
        if (lang === 'en') {
            return `Combo chart showing trends in major energy projects from ${minYr} to ${maxYr}. Stacked bars show project value in billions of dollars, lines show number of projects. In ${latestYr}, oil and gas projects were valued at ${formatBillionSR(latestD.oil_gas_value)}, electricity at ${formatBillionSR(latestD.electricity_value)}, and other at ${formatBillionSR(latestD.other_value)}. Expand the data table below for detailed values.`;
        } else {
            return `Graphique combiné montrant les tendances des grands projets énergétiques de ${minYr} à ${maxYr}. Les barres empilées montrent la valeur des projets en milliards de dollars, les lignes montrent le nombre de projets. En ${latestYr}, les projets de pétrole et gaz étaient évalués à ${formatBillionSR(latestD.oil_gas_value)}, l'électricité à ${formatBillionSR(latestD.electricity_value)}, et autres à ${formatBillionSR(latestD.other_value)}. Développez le tableau de données ci-dessous pour les valeurs détaillées.`;
        }
    };

    const downloadChartWithTitle = async (plotEl = null) => {
        const plotElement = plotEl || document.querySelector('.page28-chart .js-plotly-plot') || chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement) {
            alert('Could not find chart element. Please try again.');
            return;
        }

        try {
            if (!window.Plotly) {
                alert('Plotly library not loaded. Please refresh the page and try again.');
                return;
            }

            const imgData = await window.Plotly.toImage(plotElement, {
                format: 'png',
                width: 1200,
                height: 700,
                scale: 2
            });

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                const legendHeight = 120;
                canvas.width = img.width;
                canvas.height = img.height + legendHeight;

                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                ctx.drawImage(img, 0, 0);

                const legendY = img.height + 20;
                const legendCenterX = canvas.width / 2;
                const legendSpacing = 300;

                ctx.font = 'bold 24px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(lang === 'en' ? 'Project value' : 'Valeur des projets', legendCenterX - legendSpacing, legendY);

                ctx.fillText(lang === 'en' ? 'Number of projects' : 'Nombre de projets', legendCenterX + legendSpacing, legendY);

                const barColors = [COLORS.oil_gas_value, COLORS.electricity_value, COLORS.other_value];
                const barLabels = [oilGasLabel, electricityLabel, otherLabel];
                ctx.font = '20px Arial';
                ctx.textAlign = 'left';
                barLabels.forEach((label, i) => {
                    const itemY = legendY + 35 + (i * 28);
                    const itemX = legendCenterX - legendSpacing - 100;
                    ctx.fillStyle = barColors[i];
                    ctx.fillRect(itemX, itemY - 14, 24, 14);
                    ctx.fillStyle = '#333333';
                    ctx.fillText(label, itemX + 32, itemY);
                });

                const lineColors = [COLORS.oil_gas_projects, COLORS.electricity_projects, COLORS.other_projects];
                barLabels.forEach((label, i) => {
                    const itemY = legendY + 35 + (i * 28);
                    const itemX = legendCenterX + legendSpacing - 100;
                    ctx.strokeStyle = lineColors[i];
                    ctx.lineWidth = 3;
                    ctx.setLineDash([6, 4]);
                    ctx.beginPath();
                    ctx.moveTo(itemX, itemY - 7);
                    ctx.lineTo(itemX + 24, itemY - 7);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.fillStyle = '#333333';
                    ctx.fillText(label, itemX + 32, itemY);
                });

                const link = document.createElement('a');
                link.download = lang === 'en' ? 'major_energy_projects_chart.png' : 'grands_projets_energetiques_graphique.png';
                link.href = canvas.toDataURL('image/png');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            };

            img.src = imgData;
        } catch (error) {
            console.error('Error downloading chart:', error);
            alert('Error downloading chart: ' + error.message);
        }
    };

    const downloadTableAsCSV = () => {
        if (!pageData.yearlyData || pageData.yearlyData.length === 0) return;

        const headers = [
            lang === 'en' ? 'Year' : 'Année',
            lang === 'en' ? 'Oil and gas value ($ billions)' : 'Valeur pétrole et gaz (milliards $)',
            lang === 'en' ? 'Oil and gas projects' : 'Projets pétrole et gaz',
            lang === 'en' ? 'Electricity value ($ billions)' : 'Valeur électricité (milliards $)',
            lang === 'en' ? 'Electricity projects' : 'Projets électricité',
            lang === 'en' ? 'Other value ($ billions)' : 'Valeur autres (milliards $)',
            lang === 'en' ? 'Other projects' : 'Projets autres',
            lang === 'en' ? 'Total value ($ billions)' : 'Valeur totale (milliards $)',
            lang === 'en' ? 'Total projects' : 'Total projets',
        ];

        const rows = pageData.yearlyData.map(d => [
            d.year,
            d.oil_gas_value,
            d.oil_gas_projects,
            d.electricity_value,
            d.electricity_projects,
            d.other_value,
            d.other_projects,
            d.total_value,
            d.total_projects
        ]);

        const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = lang === 'en' ? 'major_energy_projects_data.csv' : 'grands_projets_energetiques_donnees.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const downloadTableAsDocx = async () => {
        if (!pageData.yearlyData || pageData.yearlyData.length === 0) return;

        const yrs = pageData.yearlyData.map(d => d.year);
        const minYr = yrs.length > 0 ? Math.min(...yrs) : 2021;
        const maxYr = yrs.length > 0 ? Math.max(...yrs) : 2024;
        const title = `${getText('page28_chart_title_prefix', lang)}${minYr} ${lang === 'en' ? 'to' : 'à'} ${maxYr}`;

        const headers = [
            lang === 'en' ? 'Year' : 'Année',
            lang === 'en' ? 'Oil & gas ($B)' : 'Pétrole et gaz (G$)',
            lang === 'en' ? 'Oil & gas (#)' : 'Pétrole et gaz (#)',
            lang === 'en' ? 'Electricity ($B)' : 'Électricité (G$)',
            lang === 'en' ? 'Electricity (#)' : 'Électricité (#)',
            lang === 'en' ? 'Other ($B)' : 'Autres (G$)',
            lang === 'en' ? 'Other (#)' : 'Autres (#)',
            lang === 'en' ? 'Total ($B)' : 'Total (G$)',
            lang === 'en' ? 'Total (#)' : 'Total (#)',
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

        const dataRows = pageData.yearlyData.map(d => new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(d.year), size: 22 })], alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(d.oil_gas_value), size: 22 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(d.oil_gas_projects), size: 22 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(d.electricity_value), size: 22 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(d.electricity_projects), size: 22 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(d.other_value), size: 22 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(d.other_projects), size: 22 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(d.total_value), size: 22, bold: true })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(d.total_projects), size: 22, bold: true })], alignment: AlignmentType.RIGHT })] }),
            ]
        }));

        const allRows = [headerRow, ...dataRows];

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
                        columnWidths: [1000, 1100, 1000, 1100, 1000, 1100, 1000, 1100, 1000],
                        rows: allRows
                    })
                ]
            }]
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'major_energy_projects_data.docx' : 'grands_projets_energetiques_donnees.docx');
    };

    if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>;
    if (error) return <div style={{ padding: '20px', color: 'red' }}>Error: {error}</div>;
    if (!pageData.yearlyData || pageData.yearlyData.length === 0) return <div style={{ padding: '20px' }}>No data available.</div>;

    const years = pageData.yearlyData.map(d => d.year);
    const minYear = years.length > 0 ? Math.min(...years) : 2021;
    const maxYear = years.length > 0 ? Math.max(...years) : 2024;
    const latestYear = maxYear;
    const latestData = pageData.yearlyData.find(d => d.year === latestYear) || {};
    const summary = pageData.summary || {};

    const chartTitle = `${getText('page28_chart_title_prefix', lang)}${minYear} ${lang === 'en' ? 'to' : 'à'} ${maxYear}`;

    const oilGasLabel = getText('page28_legend_oil_gas', lang);
    const electricityLabel = getText('page28_legend_electricity', lang);
    const otherLabel = getText('page28_legend_other', lang);

    const cellUnitValueSR = lang === 'en' ? ' billion dollars' : ' milliards de dollars';
    const cellUnitProjectsSR = lang === 'en' ? ' projects' : ' projets';
    const headerUnitValueVisual = lang === 'en' ? '($ billions)' : '(milliards $)';
    const headerUnitValueSR = lang === 'en' ? '(billions of dollars)' : '(milliards de dollars)';
    const headerUnitProjectsVisual = lang === 'en' ? '(# projects)' : '(# projets)';
    const headerUnitProjectsSR = lang === 'en' ? '(number of projects)' : '(nombre de projets)';

    const bullet1AriaLabel = lang === 'en'
        ? `In ${latestYear}, there were ${summary.planned_projects || 231} planned (announced, under review, or approved) energy projects worth ${formatBillionSR(summary.planned_value || 351)}, and ${summary.construction_projects || 109} energy projects under construction worth ${formatBillionSR(summary.construction_value || 159)}.`
        : `En ${latestYear}, il y avait ${summary.planned_projects || 231} projets énergétiques planifiés (annoncés, en cours d'examen ou approuvés) d'une valeur de ${formatBillionSR(summary.planned_value || 351)}, et ${summary.construction_projects || 109} projets énergétiques en construction d'une valeur de ${formatBillionSR(summary.construction_value || 159)}.`;

    const bullet2AriaLabel = lang === 'en'
        ? `Oil and gas projects accounted for the largest portion of project value at ${formatBillionSR(latestData.oil_gas_value || 296)}, while there were more electricity projects overall at ${latestData.electricity_projects || 188}.`
        : `Les projets de pétrole et gaz représentaient la plus grande part de la valeur des projets à ${formatBillionSR(latestData.oil_gas_value || 296)}, tandis qu'il y avait plus de projets d'électricité au total à ${latestData.electricity_projects || 188}.`;

    const bullet3AriaLabel = lang === 'en'
        ? `There were ${summary.clean_tech_projects || 215} clean technology projects valued at ${formatBillionSR(summary.clean_tech_value || 194)}.`
        : `Il y avait ${summary.clean_tech_projects || 215} projets de technologies propres d'une valeur de ${formatBillionSR(summary.clean_tech_value || 194)}.`;

    return (
        <main
            id="page-28"
            tabIndex="-1"
            className="page-content page-28"
            role="main"
            aria-labelledby="page28-title"
            style={{ backgroundColor: '#ffffff' }}
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

    .page-28 {
        width: calc(100% + ${layoutPadding?.left || 55}px + ${layoutPadding?.right || 15}px);
        margin-left: -${layoutPadding?.left || 55}px;
        margin-right: -${layoutPadding?.right || 15}px;
    }

    .page28-container {
        padding-left: ${layoutPadding?.left || 55}px;
        padding-right: ${layoutPadding?.right || 15}px;
        padding-top: 30px;
        padding-bottom: 40px;
        width: 100%;
        box-sizing: border-box;
    }

                .page28-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 41px;
                    font-weight: bold;
                    color: #8e7e52;
                    margin: 0 0 20px 0;
                    position: relative;
                    padding-bottom: 0.5em;
                }

                .page28-title::after {
                    content: '';
                    position: absolute;
                    left: 0;
                    bottom: 0.2em;
                    width: 72px;
                    height: 6px;
                    background-color: var(--gc-red);
                }

    .page28-content-row {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        gap: 40px;
        align-items: flex-start;
    }

    .page28-left-column {
        flex: 2;
        min-width: 0;
        order: 0;
    }

    .page28-right-column {
        flex: 1;
        min-width: 280px;
        max-width: 350px;
        order: 1;
    }

    .page28-data-table-section {
        width: 100%;
        order: 2;
    }

    .page28-bullets {
        margin: 0 0 20px 0;
        padding-left: 20px;
    }

                .page28-bullets li {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                    line-height: 1.6;
                    margin-bottom: 12px;
                    color: var(--gc-text);
                    max-width: 65ch;
                }

                .page28-sidebar {
                    background-color: #aa9c7a;
                    padding: 20px;
                    border-radius: 3px;
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                    line-height: 1.6;
                    color: var(--gc-text);
                    max-width: 65ch;
                }

                .page28-sidebar-title {
                    font-family: 'Lato', sans-serif;
                    font-weight: bold;
                    font-size: 29px;
                    margin-bottom: 10px;
                }

    .page28-sidebar p {
        margin: 0 0 10px 0;
    }

    .page28-chart {
        position: relative;
        width: 100%;
        margin-top: 20px;
    }

    .page28-chart .js-plotly-plot {
        height: 500px !important;
    }

                .page28-chart-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 29px;
                    font-weight: bold;
                    text-align: center;
                    margin: 0 60px 10px 60px;
                    color: var(--gc-text);
                }

    .page28-custom-legend {
        display: flex;
        justify-content: center;
        gap: 40px;
        margin-top: 15px;
        flex-wrap: wrap;
    }

    .page28-legend-group {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
    }

    .page28-legend-group-title {
        font-family: Arial, sans-serif;
        font-size: 0.85rem;
        font-weight: bold;
        margin-bottom: 5px;
        color: var(--gc-text);
    }

    .page28-legend-items {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .page28-legend-item {
        display: flex;
        align-items: center;
        font-family: Arial, sans-serif;
        font-size: 0.8rem;
        color: var(--gc-text);
    }

    .page28-legend-color {
        width: 20px;
        height: 12px;
        margin-right: 6px;
        display: inline-block;
    }

    .page28-legend-line {
        width: 20px;
        height: 2px;
        margin-right: 6px;
        display: inline-block;
        border-top: 2px dotted;
    }

    .page28-table-wrapper {
        margin-top: 20px;
        width: 100%;
    }

    .page28-table-wrapper summary {
        cursor: pointer;
        font-weight: bold;
        padding: 10px;
        border: 1px solid #ccc;
        background-color: #f9f9f9;
        display: flex;
        align-items: center;
        list-style: none;
    }

    .page28-table-wrapper summary::-webkit-details-marker {
        display: none;
    }

    .page28-table-wrapper .table-responsive {
        width: 100%;
    }

    @media (max-width: 1280px) {
        .page28-content-row {
            flex-direction: column;
        }
        .page28-left-column {
            order: 0;
            width: 100%;
        }
        .page28-data-table-section {
            order: 1;
        }
        .page28-right-column {
            max-width: 100%;
            width: 100%;
            order: 2;
        }
        .page28-chart .js-plotly-plot {
            height: 450px !important;
        }
    }

    @media (max-width: 960px) {
        .page28-chart .js-plotly-plot {
            height: 400px !important;
        }
    }
                @media (max-width: 768px) {
                    .page28-title {
                        font-size: 37px;
                    }
                    .page28-bullets li {
                        font-size: 18px;
                    }
                    .page28-sidebar {
                        font-size: 18px;
                    }
                    .page28-sidebar-title {
                        font-size: 26px;
                    }
                    .page28-chart-title {
                        font-size: 26px;
                    }
                    .page28-custom-legend {
                        flex-direction: column;
                        gap: 15px;
                        align-items: flex-start;
                    }
                       .page28-chart .js-plotly-plot {
                        height: 350px !important;
                    }
                }

    @media (max-width: 480px) {
        .page28-title {
            font-size: 1.4rem;
        }
        .page28-chart .js-plotly-plot {
            height: 300px !important;
        }
    }

    /* FIXED: Grid layout with minmax(0, 1fr) forces scrollbar to appear */
    .page28-table-wrapper {
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

            <div className="page28-container">
                <h1 id="page28-title" className="page28-title">
                    {getText('page28_title', lang)}
                </h1>

                <div className="page28-content-row">
                    <div className="page28-left-column">
                        <ul className="page28-bullets">
                            <li aria-label={bullet1AriaLabel}>
                                <span aria-hidden="true">
                                    {getText('page28_bullet1_part1', lang)}
                                    <strong>{latestYear}</strong>
                                    {getText('page28_bullet1_part2', lang)}
                                    <strong>{summary.planned_projects || 231}</strong>
                                    {getText('page28_bullet1_part3', lang)}
                                    <strong>{formatBillion(summary.planned_value || 351)}</strong>
                                    {getText('page28_bullet1_part4', lang)}
                                    <strong>{summary.construction_projects || 109}</strong>
                                    {getText('page28_bullet1_part5', lang)}
                                    <strong>{formatBillion(summary.construction_value || 159)}</strong>
                                    {getText('page28_bullet1_part6', lang)}
                                </span>
                            </li>
                            <li aria-label={bullet2AriaLabel}>
                                <span aria-hidden="true">
                                    {getText('page28_bullet2_part1', lang)}
                                    <strong>{formatBillion(latestData.oil_gas_value || 296)}</strong>
                                    {getText('page28_bullet2_part2', lang)}
                                    <strong>{latestData.electricity_projects || 188}</strong>
                                    {getText('page28_bullet2_part3', lang)}
                                </span>
                            </li>
                            <li aria-label={bullet3AriaLabel}>
                                <span aria-hidden="true">
                                    {getText('page28_bullet3_part1', lang)}
                                    <strong>{summary.clean_tech_projects || 215}</strong>
                                    {getText('page28_bullet3_part2', lang)}
                                    <strong>{formatBillion(summary.clean_tech_value || 194)}</strong>
                                    {getText('page28_bullet3_part3', lang)}
                                </span>
                            </li>
                        </ul>

                        <div className="page28-chart" style={{ position: 'relative' }}>
                            <h2 className="wb-inv">{chartTitle}</h2>

                            <div role="region" aria-label={getChartSummary()}>
                                <figure ref={chartRef} style={{ margin: 0, position: 'relative' }}>
                                    {selectedPoints !== null && (
                                        <button onClick={() => setSelectedPoints(null)} style={{ position: 'absolute', top: 0, right: 295, zIndex: 20 }}>{lang === 'en' ? 'Clear' : 'Effacer'}</button>
                                    )}

                                    <Plot
                                        data={[
                                            {
                                                name: oilGasLabel,
                                                x: years,
                                                y: pageData.yearlyData.map(d => d.oil_gas_value),
                                                type: 'bar',
                                                marker: {
                                                    color: COLORS.oil_gas_value,
                                                    opacity: selectedPoints === null ? 1 : years.map((_, i) => selectedPoints[0]?.includes(i) ? 1 : 0.3)
                                                },
                                                customdata: pageData.yearlyData.map(d => d.total_value),
                                                hovertemplate: `<b>${oilGasLabel}</b><br>%{x}: $%{y:.1f}B<br>${lang === 'en' ? 'Total value' : 'Valeur totale'}: $%{customdata:.1f}B<extra></extra>`,
                                                yaxis: 'y',
                                                legendgroup: 'value'
                                            },
                                            {
                                                name: electricityLabel,
                                                x: years,
                                                y: pageData.yearlyData.map(d => d.electricity_value),
                                                type: 'bar',
                                                marker: {
                                                    color: COLORS.electricity_value,
                                                    opacity: selectedPoints === null ? 1 : years.map((_, i) => selectedPoints[1]?.includes(i) ? 1 : 0.3)
                                                },
                                                customdata: pageData.yearlyData.map(d => d.total_value),
                                                hovertemplate: `<b>${electricityLabel}</b><br>%{x}: $%{y:.1f}B<br>${lang === 'en' ? 'Total value' : 'Valeur totale'}: $%{customdata:.1f}B<extra></extra>`,
                                                yaxis: 'y',
                                                legendgroup: 'value'
                                            },
                                            {
                                                name: otherLabel,
                                                x: years,
                                                y: pageData.yearlyData.map(d => d.other_value),
                                                type: 'bar',
                                                marker: {
                                                    color: COLORS.other_value,
                                                    opacity: selectedPoints === null ? 1 : years.map((_, i) => selectedPoints[2]?.includes(i) ? 1 : 0.3)
                                                },
                                                customdata: pageData.yearlyData.map(d => d.total_value),
                                                hovertemplate: `<b>${otherLabel}</b><br>%{x}: $%{y:.1f}B<br>${lang === 'en' ? 'Total value' : 'Valeur totale'}: $%{customdata:.1f}B<extra></extra>`,
                                                yaxis: 'y',
                                                legendgroup: 'value'
                                            },
                                            {
                                                name: `${oilGasLabel} (${lang === 'en' ? 'projects' : 'projets'})`,
                                                x: years,
                                                y: pageData.yearlyData.map(d => d.oil_gas_projects),
                                                type: 'scatter',
                                                mode: 'lines+markers',
                                                line: { color: COLORS.oil_gas_projects, width: 2, dash: 'dot' },
                                                marker: { color: COLORS.oil_gas_projects, size: 6 },
                                                customdata: pageData.yearlyData.map(d => d.total_projects),
                                                hovertemplate: `<b>${oilGasLabel}</b><br>%{x}: %{y} ${lang === 'en' ? 'projects' : 'projets'}<br>${lang === 'en' ? 'Total projects' : 'Projets totaux'}: %{customdata}<extra></extra>`,
                                                yaxis: 'y2',
                                                legendgroup: 'projects'
                                            },
                                            {
                                                name: `${electricityLabel} (${lang === 'en' ? 'projects' : 'projets'})`,
                                                x: years,
                                                y: pageData.yearlyData.map(d => d.electricity_projects),
                                                type: 'scatter',
                                                mode: 'lines+markers',
                                                line: { color: COLORS.electricity_projects, width: 2, dash: 'dot' },
                                                marker: { color: COLORS.electricity_projects, size: 6 },
                                                customdata: pageData.yearlyData.map(d => d.total_projects),
                                                hovertemplate: `<b>${electricityLabel}</b><br>%{x}: %{y} ${lang === 'en' ? 'projects' : 'projets'}<br>${lang === 'en' ? 'Total projects' : 'Projets totaux'}: %{customdata}<extra></extra>`,
                                                yaxis: 'y2',
                                                legendgroup: 'projects'
                                            },
                                            {
                                                name: `${otherLabel} (${lang === 'en' ? 'projects' : 'projets'})`,
                                                x: years,
                                                y: pageData.yearlyData.map(d => d.other_projects),
                                                type: 'scatter',
                                                mode: 'lines+markers',
                                                line: { color: COLORS.other_projects, width: 2, dash: 'dot' },
                                                marker: { color: COLORS.other_projects, size: 6 },
                                                customdata: pageData.yearlyData.map(d => d.total_projects),
                                                hovertemplate: `<b>${otherLabel}</b><br>%{x}: %{y} ${lang === 'en' ? 'projects' : 'projets'}<br>${lang === 'en' ? 'Total projects' : 'Projets totaux'}: %{customdata}<extra></extra>`,
                                                yaxis: 'y2',
                                                legendgroup: 'projects'
                                            }
                                        ]}
                                        layout={{
                                            barmode: 'stack',
                                            showlegend: false,
                                            clickmode: 'event',
                                            dragmode: windowWidth <= 768 ? false : 'zoom',
                                            title: {
                                                text: `<b>${chartTitle}</b>`,
                                                font: { size: 18, family: 'Arial, sans-serif', color: '#333' },
                                                x: 0.5,
                                                xanchor: 'center'
                                            },
                                            margin: { l: 60, r: 60, t: 50, b: 40 },
                                            xaxis: {
                                                tickvals: years,
                                                tickangle: 0,
                                                title: ''
                                            },
                                            yaxis: {
                                                title: {
                                                    text: `<b>${getText('page28_yaxis_left', lang)}</b>`,
                                                    font: { size: 16, family: 'Arial, sans-serif', color: '#333' }
                                                },
                                                side: 'left',
                                                rangemode: 'tozero'
                                            },
                                            yaxis2: {
                                                title: {
                                                    text: `<b>${getText('page28_yaxis_right', lang)}</b>`,
                                                    font: { size: 16, family: 'Arial, sans-serif', color: '#333' }
                                                },
                                                side: 'right',
                                                overlaying: 'y',
                                                rangemode: 'tozero'
                                            },
                                            hoverlabel: { 
                                                bgcolor: '#ffffff',
                                                bordercolor: '#333333',
                                                font: { color: '#333333', family: 'Arial, sans-serif' }
                                            },
                                            font: { family: 'Arial, sans-serif' }
                                        }}
                                        config={{
                                            displayModeBar: true,
                                            displaylogo: false,
                                            responsive: true,
                                            modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d', 'zoom2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d', 'toImage'],
                                            modeBarButtonsToAdd: [{
                                                name: lang === 'en' ? 'Download chart as PNG' : 'Télécharger le graphique en PNG',
                                                icon: {
                                                    width: 24,
                                                    height: 24,
                                                    path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z'
                                                },
                                                click: () => downloadChartWithTitle()
                                            }]
                                        }}
                                        onClick={(data) => {
                                            if (data.points && data.points.length > 0) {
                                                const clickedPoint = data.points[0];
                                                const seriesIndex = clickedPoint.curveNumber;
                                                const pointIndex = clickedPoint.pointIndex;

                                                if (windowWidth <= 768) {
                                                    const currentTime = new Date().getTime();
                                                    const lastClick = lastClickRef.current;
                                                    const isSamePoint = (seriesIndex === lastClick.seriesIndex && pointIndex === lastClick.pointIndex);
                                                    const isDoubleTap = isSamePoint && (currentTime - lastClick.time < 300);
                                                    
                                                    lastClickRef.current = { time: currentTime, seriesIndex, pointIndex };
                                                    
                                                    if (!isDoubleTap) {
                                                        return; // Single tap: show hover label only
                                                    }
                                                }

                                                if (seriesIndex < 3) {
                                                    setSelectedPoints(prev => {
                                                        if (prev === null) {
                                                            const newSelection = Array(6).fill(null).map(() => []);
                                                            newSelection[seriesIndex] = [pointIndex];
                                                            return newSelection;
                                                        }
                                                        const newSelection = prev.map(arr => arr ? [...arr] : []);
                                                        const currentSeriesSelection = newSelection[seriesIndex] || [];
                                                        if (currentSeriesSelection.includes(pointIndex)) {
                                                            newSelection[seriesIndex] = currentSeriesSelection.filter(i => i !== pointIndex);
                                                        } else {
                                                            newSelection[seriesIndex] = [...currentSeriesSelection, pointIndex];
                                                        }
                                                        const allEmpty = newSelection.every(arr => !arr || arr.length === 0);
                                                        return allEmpty ? null : newSelection;
                                                    });
                                                }
                                            }
                                        }}
                                        useResizeHandler={true}
                                        style={{ width: '100%', height: windowWidth <= 480 ? '400px' : '500px' }}
                                    />
                                </figure>
                            </div>

                            <div className="page28-custom-legend" aria-hidden="true">
                                <div className="page28-legend-group">
                                    <div className="page28-legend-group-title">{lang === 'en' ? 'Project value' : 'Valeur des projets'}</div>
                                    <div className="page28-legend-items">
                                        <div className="page28-legend-item">
                                            <span className="page28-legend-color" style={{ backgroundColor: COLORS.oil_gas_value }}></span>
                                            <span>{oilGasLabel}</span>
                                        </div>
                                        <div className="page28-legend-item">
                                            <span className="page28-legend-color" style={{ backgroundColor: COLORS.electricity_value }}></span>
                                            <span>{electricityLabel}</span>
                                        </div>
                                        <div className="page28-legend-item">
                                            <span className="page28-legend-color" style={{ backgroundColor: COLORS.other_value }}></span>
                                            <span>{otherLabel}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="page28-legend-group">
                                    <div className="page28-legend-group-title">{lang === 'en' ? 'Number of projects' : 'Nombre de projets'}</div>
                                    <div className="page28-legend-items">
                                        <div className="page28-legend-item">
                                            <span className="page28-legend-line" style={{ borderColor: COLORS.oil_gas_projects }}></span>
                                            <span>{oilGasLabel}</span>
                                        </div>
                                        <div className="page28-legend-item">
                                            <span className="page28-legend-line" style={{ borderColor: COLORS.electricity_projects }}></span>
                                            <span>{electricityLabel}</span>
                                        </div>
                                        <div className="page28-legend-item">
                                            <span className="page28-legend-line" style={{ borderColor: COLORS.other_projects }}></span>
                                            <span>{otherLabel}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <aside className="page28-right-column">
                        <div className="page28-sidebar">
                            <h3 className="page28-sidebar-title">{getText('page28_sidebar_title', lang)}</h3>
                            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                {getText('page28_sidebar_content', lang).split(/<br\s*\/?>/i).map((para, idx) => {
                                    if (!para.trim()) return null;
                                    let audioLabel = stripHtml(para);
                                    if (lang === 'en') {
                                        audioLabel = audioLabel.replace(/\$(\d+) million/g, '$1 million dollars');
                                    }
                                    let visualHtml = para;
                                    if (lang === 'en') {
                                        visualHtml = visualHtml.replace(/(\$\d+ million)/g, '<strong>$1</strong>');
                                    } else {
                                        visualHtml = visualHtml.replace(/(\d+ millions de dollars)/g, '<strong>$1</strong>');
                                    }

                                    return (
                                        <li 
                                            key={idx} 
                                            style={{ marginBottom: '10px', lineHeight: '1.6', fontFamily: 'Arial, sans-serif', color: '#333' }}
                                            aria-label={audioLabel}
                                        >
                                            <span 
                                                aria-hidden="true" 
                                                dangerouslySetInnerHTML={{ __html: visualHtml }} 
                                            />
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    </aside>

                    <div className="page28-data-table-section">
                        <details
                            className="page28-table-wrapper"
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
                                tabIndex="0"
                            >
                                <table className="table table-striped table-hover">
                                    <caption className="wb-inv">
                                        {lang === 'en'
                                            ? 'Major energy projects data by year (values in billions of dollars, project counts)'
                                            : 'Données des grands projets énergétiques par année (valeurs en milliards de dollars, nombre de projets)'}
                                    </caption>
                                    <thead>
                                        <tr>
                                            <td style={{ borderBottom: 'none', border: '1px solid #ddd' }} aria-hidden="true"></td>
                                            <th scope="colgroup" colSpan={2} className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{oilGasLabel}</th>
                                            <th scope="colgroup" colSpan={2} className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{electricityLabel}</th>
                                            <th scope="colgroup" colSpan={2} className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{otherLabel}</th>
                                            <th scope="colgroup" colSpan={2} className="text-center" style={{ fontWeight: 'bold', border: '1px solid #ddd' }}>{lang === 'en' ? 'Total' : 'Total'}</th>
                                        </tr>
                                        <tr>
                                            <th scope="col" className="text-center" style={{ fontWeight: 'bold', verticalAlign: 'top', borderTop: 'none', border: '1px solid #ddd' }}>
                                                {lang === 'en' ? 'Year' : 'Année'}
                                            </th>
                                            <th scope="col" className="text-right" style={{ fontWeight: 'bold', textAlign: 'right', border: '1px solid #ddd' }}>
                                                <span aria-hidden="true">{headerUnitValueVisual}</span>
                                                <span className="wb-inv">{headerUnitValueSR}</span>
                                            </th>
                                            <th scope="col" className="text-right" style={{ fontWeight: 'bold', textAlign: 'right', border: '1px solid #ddd' }}>
                                                <span aria-hidden="true">{headerUnitProjectsVisual}</span>
                                                <span className="wb-inv">{headerUnitProjectsSR}</span>
                                            </th>
                                            <th scope="col" className="text-right" style={{ fontWeight: 'bold', textAlign: 'right', border: '1px solid #ddd' }}>
                                                <span aria-hidden="true">{headerUnitValueVisual}</span>
                                                <span className="wb-inv">{headerUnitValueSR}</span>
                                            </th>
                                            <th scope="col" className="text-right" style={{ fontWeight: 'bold', textAlign: 'right', border: '1px solid #ddd' }}>
                                                <span aria-hidden="true">{headerUnitProjectsVisual}</span>
                                                <span className="wb-inv">{headerUnitProjectsSR}</span>
                                            </th>
                                            <th scope="col" className="text-right" style={{ fontWeight: 'bold', textAlign: 'right', border: '1px solid #ddd' }}>
                                                <span aria-hidden="true">{headerUnitValueVisual}</span>
                                                <span className="wb-inv">{headerUnitValueSR}</span>
                                            </th>
                                            <th scope="col" className="text-right" style={{ fontWeight: 'bold', textAlign: 'right', border: '1px solid #ddd' }}>
                                                <span aria-hidden="true">{headerUnitProjectsVisual}</span>
                                                <span className="wb-inv">{headerUnitProjectsSR}</span>
                                            </th>
                                            <th scope="col" className="text-right" style={{ fontWeight: 'bold', textAlign: 'right', border: '1px solid #ddd' }}>
                                                <span aria-hidden="true">{headerUnitValueVisual}</span>
                                                <span className="wb-inv">{headerUnitValueSR}</span>
                                            </th>
                                            <th scope="col" className="text-right" style={{ fontWeight: 'bold', textAlign: 'right', border: '1px solid #ddd' }}>
                                                <span aria-hidden="true">{headerUnitProjectsVisual}</span>
                                                <span className="wb-inv">{headerUnitProjectsSR}</span>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pageData.yearlyData.map(d => (
                                            <tr key={d.year}>
                                                <th scope="row" className="text-center" style={{ verticalAlign: 'middle', fontWeight: 'bold', border: '1px solid #ddd' }}>{d.year}</th>
                                                <td className="text-right" style={{ textAlign: 'right', border: '1px solid #ddd' }} aria-label={`${d.year}, ${oilGasLabel}, ${lang === 'en' ? 'value' : 'valeur'}: ${d.oil_gas_value} ${cellUnitValueSR}`}>
                                                    {d.oil_gas_value}
                                                </td>
                                                <td className="text-right" style={{ textAlign: 'right', border: '1px solid #ddd' }} aria-label={`${d.year}, ${oilGasLabel}, ${lang === 'en' ? 'count' : 'nombre'}: ${d.oil_gas_projects} ${cellUnitProjectsSR}`}>
                                                    {d.oil_gas_projects}
                                                </td>
                                                <td className="text-right" style={{ textAlign: 'right', border: '1px solid #ddd' }} aria-label={`${d.year}, ${electricityLabel}, ${lang === 'en' ? 'value' : 'valeur'}: ${d.electricity_value} ${cellUnitValueSR}`}>
                                                    {d.electricity_value}
                                                </td>
                                                <td className="text-right" style={{ textAlign: 'right', border: '1px solid #ddd' }} aria-label={`${d.year}, ${electricityLabel}, ${lang === 'en' ? 'count' : 'nombre'}: ${d.electricity_projects} ${cellUnitProjectsSR}`}>
                                                    {d.electricity_projects}
                                                </td>
                                                <td className="text-right" style={{ textAlign: 'right', border: '1px solid #ddd' }} aria-label={`${d.year}, ${otherLabel}, ${lang === 'en' ? 'value' : 'valeur'}: ${d.other_value} ${cellUnitValueSR}`}>
                                                    {d.other_value}
                                                </td>
                                                <td className="text-right" style={{ textAlign: 'right', border: '1px solid #ddd' }} aria-label={`${d.year}, ${otherLabel}, ${lang === 'en' ? 'count' : 'nombre'}: ${d.other_projects} ${cellUnitProjectsSR}`}>
                                                    {d.other_projects}
                                                </td>
                                                <td className="text-right" style={{ textAlign: 'right', fontWeight: 'bold', border: '1px solid #ddd' }} aria-label={`${d.year}, ${lang === 'en' ? 'Total' : 'Total'}, ${lang === 'en' ? 'value' : 'valeur'}: ${d.total_value} ${cellUnitValueSR}`}>
                                                    {d.total_value}
                                                </td>
                                                <td className="text-right" style={{ textAlign: 'right', fontWeight: 'bold', border: '1px solid #ddd' }} aria-label={`${d.year}, ${lang === 'en' ? 'Total' : 'Total'}, ${lang === 'en' ? 'count' : 'nombre'}: ${d.total_projects} ${cellUnitProjectsSR}`}>
                                                    {d.total_projects}
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
                    </div>
                </div>
            </div>
        </main>
    );
};

export default Page28;
