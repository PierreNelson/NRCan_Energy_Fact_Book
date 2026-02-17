import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

const Page4 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [selectedSlices1, setSelectedSlices1] = useState(null);
    const [selectedSlices2, setSelectedSlices2] = useState(null);
    const chartRef1 = useRef(null);
    const chartRef2 = useRef(null);
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);
    const lastClickRef1 = useRef({ time: 0, index: null });
    const lastClickRef2 = useRef({ time: 0, index: null });

    const stripHtml = (text) => text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';

    const formatNumber = (num) => {
        if (num === undefined || num === null) return '—';
        return Math.round(num).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA');
    };

    const hexToRgba = (hex, opacity = 1) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
        }
        return hex;
    };

    const scrollToRef = (e) => {
        e.preventDefault();
        document.getElementById('fn-asterisk-rf-page4')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

    useEffect(() => {
        const setupChartAccessibility = (chartRef) => {
            if (!chartRef.current) return;
            const plotContainer = chartRef.current;

            const svgElements = plotContainer.querySelectorAll('.main-svg, .svg-container svg');
            svgElements.forEach(svg => svg.setAttribute('aria-hidden', 'true'));

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

        const timer1 = setTimeout(() => setupChartAccessibility(chartRef1), 500);
        const timer2 = setTimeout(() => setupChartAccessibility(chartRef2), 500);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
        };
    }, [lang]);

    const COLORS = {
        natural_gas: '#3A9FC8',
        hydro: '#245e7f',
        coal: '#7A7A7A',
        other_renewables: '#8CC9E0',
        ngls: '#9A9389',
        crude_oil: '#9b8a42',
        uranium: '#1C6B7E',
        nuclear: '#1C6B7E'
    };

    const dataIncludingUranium = {
        total: 29341,
        sources: [
            { key: 'crude_oil', value: 38 },
            { key: 'natural_gas', value: 26 },
            { key: 'uranium', value: 21 },
            { key: 'hydro', value: 4 },
            { key: 'coal', value: 4 },
            { key: 'ngls', value: 3 },
            { key: 'other_renewables', value: 2 }
        ]
    };

    const dataExcludingUranium = {
        total: 23448,
        sources: [
            { key: 'crude_oil', value: 48 },
            { key: 'natural_gas', value: 33 },
            { key: 'hydro', value: 6 },
            { key: 'coal', value: 5 },
            { key: 'ngls', value: 4 },
            { key: 'other_renewables', value: 3 },
            { key: 'nuclear', value: 1 }
        ]
    };

    const getLabelKey = (key) => {
        const keyMap = {
            natural_gas: 'page4_natural_gas',
            hydro: 'page4_hydro',
            coal: 'page4_coal',
            other_renewables: 'page4_other_renewables',
            ngls: 'page4_ngls',
            crude_oil: 'page4_crude_oil',
            uranium: 'page4_uranium',
            nuclear: 'page4_nuclear'
        };
        return keyMap[key] || key;
    };

    const createChartData = (data, selectedSlices) => {
        const labels = data.sources.map(s => getText(getLabelKey(s.key), lang).toUpperCase());
        const values = data.sources.map(s => s.value);
        const baseColors = data.sources.map(s => COLORS[s.key]);

        const colors = selectedSlices === null
            ? baseColors
            : baseColors.map((color, i) => selectedSlices.includes(i) ? color : hexToRgba(color, 0.3));

        const textColors = selectedSlices === null
            ? baseColors
            : baseColors.map((color, i) => selectedSlices.includes(i) ? color : hexToRgba(color, 0.3));

        const hoverTexts = data.sources.map(s => {
            const label = getText(getLabelKey(s.key), lang);
            const pjValue = Math.round(data.total * s.value / 100);
            return `<b>${label}</b><br>${formatNumber(pjValue)} PJ<br>${s.value}%`;
        });

        const pullValues = selectedSlices === null
            ? data.sources.map(() => 0.02)
            : data.sources.map((_, i) => selectedSlices.includes(i) ? 0.08 : 0.02);

        return [{
            type: 'pie',
            values: values,
            labels: labels,
            texttemplate: '%{label}<br><b>%{percent:.0%}</b>',
            textinfo: 'label+percent',
            textposition: 'outside',
            textfont: {
                size: windowWidth <= 480 ? 11 : windowWidth <= 768 ? 12 : windowWidth <= 1280 ? 15 : 18,
                family: 'Arial, sans-serif',
                color: textColors
            },
            outsidetextfont: {
                color: textColors,
                size: windowWidth <= 480 ? 11 : windowWidth <= 768 ? 12 : windowWidth <= 1280 ? 15 : 18,
                family: 'Arial, sans-serif'
            },
            hovertext: hoverTexts,
            hoverinfo: 'text',
            hoverlabel: {
                bgcolor: '#ffffff',
                font: { color: '#000000', size: 14, family: 'Arial, sans-serif' }
            },
            marker: {
                colors: colors,
                line: { color: '#ffffff', width: 2 }
            },
            hole: 0.55,
            direction: 'clockwise',
            rotation: 90,
            sort: false,
            pull: pullValues
        }];
    };

    const chart1Data = useMemo(() => createChartData(dataIncludingUranium, selectedSlices1), [lang, windowWidth, selectedSlices1]);
    const chart2Data = useMemo(() => createChartData(dataExcludingUranium, selectedSlices2), [lang, windowWidth, selectedSlices2]);

    const getChartSummary = (data, title) => {
        const sources = data.sources.map(s => `${getText(getLabelKey(s.key), lang)}: ${s.value}%`).join(', ');
        return `${stripHtml(title)}. Total: ${formatNumber(data.total)} PJ. ${sources}`;
    };

    const downloadChartWithTitle = async (chartRef, title, data) => {
        const plotElement = chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement) return;

        try {
            if (!window.Plotly) return;

            const imgData = await window.Plotly.toImage(plotElement, {
                format: 'png',
                width: 800,
                height: 600,
                scale: 2
            });

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
                const titleHeight = 80;
                const legendHeight = 150;
                canvas.width = img.width;
                canvas.height = img.height + titleHeight + legendHeight;

                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                ctx.fillStyle = '#333333';
                ctx.font = 'bold 36px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(stripHtml(title), canvas.width / 2, 50);

                ctx.drawImage(img, 0, titleHeight);

                const legendY = img.height + titleHeight + 30;
                const legendItems = data.sources;
                const itemWidth = 200;
                const itemsPerRow = Math.floor(canvas.width / itemWidth);

                legendItems.forEach((item, i) => {
                    const row = Math.floor(i / itemsPerRow);
                    const col = i % itemsPerRow;
                    const x = (canvas.width - (Math.min(itemsPerRow, legendItems.length) * itemWidth)) / 2 + col * itemWidth + 20;
                    const y = legendY + row * 30;

                    ctx.fillStyle = COLORS[item.key];
                    ctx.fillRect(x, y - 12, 16, 16);

                    ctx.fillStyle = '#333333';
                    ctx.font = '16px Arial';
                    ctx.textAlign = 'left';
                    ctx.fillText(`${getText(getLabelKey(item.key), lang)} ${item.value}%`, x + 22, y);
                });

                const link = document.createElement('a');
                link.download = lang === 'en' ? 'primary_energy_production.png' : 'production_energie_primaire.png';
                link.href = canvas.toDataURL('image/png');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            };

            img.src = imgData;
        } catch (error) {
            console.error('Error downloading chart:', error);
        }
    };

    const downloadTableAsCSV = () => {
        const headers = [
            lang === 'en' ? 'Source' : 'Source',
            lang === 'en' ? 'Including Uranium (%)' : "Incluant l'uranium (%)",
            lang === 'en' ? 'Excluding Uranium (%)' : "Excluant l'uranium (%)"
        ];

        const allKeys = ['crude_oil', 'natural_gas', 'uranium', 'hydro', 'coal', 'ngls', 'other_renewables', 'nuclear'];
        const rows = allKeys.map(key => {
            const includingVal = dataIncludingUranium.sources.find(s => s.key === key)?.value || '-';
            const excludingVal = dataExcludingUranium.sources.find(s => s.key === key)?.value || '-';
            return [getText(getLabelKey(key), lang), includingVal, excludingVal];
        });

        rows.push([
            lang === 'en' ? 'Total (PJ)' : 'Total (PJ)',
            formatNumber(dataIncludingUranium.total),
            formatNumber(dataExcludingUranium.total)
        ]);

        const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, lang === 'en' ? 'primary_energy_production.csv' : 'production_energie_primaire.csv');
    };

    const downloadTableAsDocx = async () => {
        const title = stripHtml(getText('page4_title', lang));
        const headers = [
            lang === 'en' ? 'Source' : 'Source',
            lang === 'en' ? 'Including Uranium (%)' : "Incluant l'uranium (%)",
            lang === 'en' ? 'Excluding Uranium (%)' : "Excluant l'uranium (%)"
        ];

        const headerRow = new TableRow({
            children: headers.map(header => new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: header, bold: true, size: 22 })], alignment: AlignmentType.CENTER })],
                shading: { fill: 'E6E6E6' }
            }))
        });

        const allKeys = ['crude_oil', 'natural_gas', 'uranium', 'hydro', 'coal', 'ngls', 'other_renewables', 'nuclear'];
        const dataRows = allKeys.map(key => {
            const includingVal = dataIncludingUranium.sources.find(s => s.key === key)?.value;
            const excludingVal = dataExcludingUranium.sources.find(s => s.key === key)?.value;
            return new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: getText(getLabelKey(key), lang), size: 22 })], alignment: AlignmentType.LEFT })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: includingVal ? `${includingVal}%` : '-', size: 22 })], alignment: AlignmentType.CENTER })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: excludingVal ? `${excludingVal}%` : '-', size: 22 })], alignment: AlignmentType.CENTER })] })
                ]
            });
        });

        const totalRow = new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Total (PJ)', bold: true, size: 22 })], alignment: AlignmentType.LEFT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatNumber(dataIncludingUranium.total), bold: true, size: 22 })], alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatNumber(dataExcludingUranium.total), bold: true, size: 22 })], alignment: AlignmentType.CENTER })] })
            ]
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
                        rows: [headerRow, ...dataRows, totalRow],
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: [4000, 2500, 2500]
                    })
                ]
            }]
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'primary_energy_production.docx' : 'production_energie_primaire.docx');
    };

    const createChartLayout = (data) => ({
        autosize: true,
        showlegend: false,
        margin: {
            t: 50,
            r: windowWidth <= 480 ? 20 : windowWidth <= 768 ? 50 : 100,
            b: 50,
            l: windowWidth <= 480 ? 20 : windowWidth <= 768 ? 50 : 100
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        clickmode: 'event',
        dragmode: false,
        annotations: [
            {
                text: `<b>${getText('page4_total', lang)}</b>`,
                x: 0.5,
                y: 0.55,
                font: { size: windowWidth <= 480 ? 14 : 16, family: 'Lato, sans-serif', color: '#333' },
                showarrow: false,
                xanchor: 'center',
                yanchor: 'middle'
            },
            {
                text: `<b>${formatNumber(data.total)}</b>`,
                x: 0.5,
                y: 0.5,
                font: { size: windowWidth <= 480 ? 24 : 32, family: 'Lato, sans-serif', color: '#333' },
                showarrow: false,
                xanchor: 'center',
                yanchor: 'middle'
            },
            {
                text: getText('page4_pj', lang),
                x: 0.5,
                y: 0.42,
                font: { size: windowWidth <= 480 ? 14 : 16, family: 'Lato, sans-serif', color: '#333' },
                showarrow: false,
                xanchor: 'center',
                yanchor: 'middle'
            }
        ]
    });

    const chartConfig = (chartRef, title, data) => ({
        displayModeBar: true,
        displaylogo: false,
        responsive: true,
        scrollZoom: false,
        staticPlot: false,
        modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d', 'zoom2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d', 'toImage'],
        modeBarButtonsToAdd: [{
            name: lang === 'en' ? 'Download chart as PNG' : 'Télécharger le graphique en PNG',
            icon: {
                width: 24,
                height: 24,
                path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z'
            },
            click: () => downloadChartWithTitle(chartRef, title, data)
        }]
    });


    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-4"
            role="main"
            aria-labelledby="page4-title"
            style={{ backgroundColor: '#ffffff' }}
        >
            <style>{`
                .page-4 {
                    margin-right: -${layoutPadding?.right || 15}px;
                    width: calc(100% + ${layoutPadding?.right || 15}px);
                    padding-right: ${layoutPadding?.right || 15}px;
                }

                .page4-container {
                    width: 100%;
                    padding: 15px 0 0 0;
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                    flex: 1;
                    overflow: visible;
                }

                .page4-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 41px;
                    font-weight: bold;
                    color: var(--gc-text);
                    margin-top: 0;
                    margin-bottom: 25px;
                    line-height: 1.2;
                    position: relative;
                    padding-bottom: 0.5em;
                }

                .page4-title::after {
                    content: '';
                    position: absolute;
                    left: 0;
                    bottom: 0.2em;
                    width: 72px;
                    height: 6px;
                    background-color: var(--gc-red);
                }

                .page4-chart-frame {
                    background-color: #f5f5f5;
                    padding: 20px;
                    border-radius: 8px;
                    margin-top: 0;
                    margin-bottom: 20px;
                    box-sizing: border-box;
                    overflow: visible;
                }

                .page4-charts-row {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 60px;
                    width: 100%;
                }

                .page4-chart-column {
                    width: 100%;
                    max-width: 700px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }

                .page4-chart-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 20px;
                    font-weight: bold;
                    color: var(--gc-text);
                    text-align: center;
                    margin: 0 0 10px 0;
                    width: 100%;
                }

                .page4-chart-wrapper {
                    position: relative;
                    width: 100%;
                    height: 400px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }

                .page4-chart-wrapper figure {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    margin: 0;
                }

                .page4-chart-wrapper .js-plotly-plot {
                    width: 100% !important;
                }

                .page4-table-wrapper {
                    display: block;
                    width: 100%;
                    margin: 20px 0 0 0;
                }

                .page4-table-wrapper details > summary {
                    display: block;
                    width: 100%;
                    padding: 12px 15px;
                    background-color: #26374a;
                    border: 1px solid #26374a;
                    border-radius: 4px;
                    cursor: pointer;
                    font-family: Arial, sans-serif;
                    font-weight: bold;
                    color: #ffffff;
                    list-style: none;
                }

                .page4-table-wrapper details > summary::-webkit-details-marker {
                    display: none;
                }

                .page4-table-wrapper details > summary:hover {
                    background-color: #1e2a3a;
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

                .wb-inv {
                    clip: rect(1px, 1px, 1px, 1px);
                    height: 1px;
                    margin: 0;
                    overflow: hidden;
                    position: absolute;
                    width: 1px;
                    white-space: nowrap;
                }

                @container (max-width: 768px) {
                    .page-4 { border-right: none !important; }
                    .page4-title {
                        font-size: 37px;
                    }
                    .page4-chart-title {
                        font-size: 16px;
                    }
                    .page4-chart-wrapper {
                        height: 350px;
                    }
                    .page4-chart-column {
                        max-width: 100%;
                    }
                }

                @container (max-width: 480px) {
                    .page4-chart-wrapper {
                        height: 320px;
                    }
                }
            `}</style>

            <div className="page4-container">
                <header role="region" aria-label={getText('page4_title', lang)}>
                    <h1 id="page4-title" className="page4-title" aria-hidden="true">
                        {getText('page4_title', lang)}
                    </h1>
                    <h1 className="wb-inv">{stripHtml(getText('page4_title', lang))}</h1>
                </header>

                <div className="page4-chart-frame">
                    <div className="page4-charts-row">
                        <div className="page4-chart-column">
                            <h2 className="page4-chart-title">
                                {getText('page4_chart1_title', lang)}
                            </h2>
                            <div
                                role="region"
                                aria-label={getChartSummary(dataIncludingUranium, getText('page4_chart1_title', lang))}
                                tabIndex="0"
                            >
                                <div className="page4-chart-wrapper">
                                    <figure ref={chartRef1} style={{ margin: 0, width: '100%', height: '100%', position: 'relative' }}>
                                        {selectedSlices1 !== null && (
                                            <button
                                                onClick={() => setSelectedSlices1(null)}
                                                style={{ position: 'absolute', top: 0, right: 10, zIndex: 20, padding: '4px 8px', cursor: 'pointer' }}
                                            >
                                                {lang === 'en' ? 'Clear' : 'Effacer'}
                                            </button>
                                        )}
                                        <div aria-hidden="true">
                                            <Plot
                                                key={`pie1-${selectedSlices1 ? selectedSlices1.join('-') : 'none'}`}
                                                data={chart1Data}
                                                layout={createChartLayout(dataIncludingUranium)}
                                                config={chartConfig(chartRef1, getText('page4_chart1_title', lang), dataIncludingUranium)}
                                                style={{ width: '100%', height: '100%' }}
                                                useResizeHandler={true}
                                                onClick={(data) => {
                                                    if (!data.points || data.points.length === 0) return;
                                                    const sliceIndex = data.points[0].pointNumber !== undefined ? data.points[0].pointNumber : data.points[0].pointIndex;
                                                    if (sliceIndex === undefined) return;

                                                    if (windowWidth <= 768) {
                                                        const currentTime = new Date().getTime();
                                                        const lastClick = lastClickRef1.current;
                                                        const isSamePoint = (sliceIndex === lastClick.index);
                                                        const isDoubleTap = isSamePoint && (currentTime - lastClick.time < 300);
                                                        lastClickRef1.current = { time: currentTime, index: sliceIndex };
                                                        if (!isDoubleTap) return;
                                                    }

                                                    setSelectedSlices1(prev => {
                                                        if (prev === null) return [sliceIndex];
                                                        const isSelected = prev.includes(sliceIndex);
                                                        if (isSelected) {
                                                            const newSelection = prev.filter(p => p !== sliceIndex);
                                                            return newSelection.length === 0 ? null : newSelection;
                                                        }
                                                        return [...prev, sliceIndex];
                                                    });
                                                }}
                                            />
                                        </div>
                                    </figure>
                                </div>
                            </div>
                        </div>

                        <div className="page4-chart-column">
                            <h2 className="page4-chart-title">
                                {getText('page4_chart2_title', lang)}
                            </h2>
                            <div
                                role="region"
                                aria-label={getChartSummary(dataExcludingUranium, getText('page4_chart2_title', lang))}
                                tabIndex="0"
                            >
                                <div className="page4-chart-wrapper">
                                    <figure ref={chartRef2} style={{ margin: 0, width: '100%', height: '100%', position: 'relative' }}>
                                        {selectedSlices2 !== null && (
                                            <button
                                                onClick={() => setSelectedSlices2(null)}
                                                style={{ position: 'absolute', top: 0, right: 10, zIndex: 20, padding: '4px 8px', cursor: 'pointer' }}
                                            >
                                                {lang === 'en' ? 'Clear' : 'Effacer'}
                                            </button>
                                        )}
                                        <div aria-hidden="true">
                                            <Plot
                                                key={`pie2-${selectedSlices2 ? selectedSlices2.join('-') : 'none'}`}
                                                data={chart2Data}
                                                layout={createChartLayout(dataExcludingUranium)}
                                                config={chartConfig(chartRef2, getText('page4_chart2_title', lang), dataExcludingUranium)}
                                                style={{ width: '100%', height: '100%' }}
                                                useResizeHandler={true}
                                                onClick={(data) => {
                                                    if (!data.points || data.points.length === 0) return;
                                                    const sliceIndex = data.points[0].pointNumber !== undefined ? data.points[0].pointNumber : data.points[0].pointIndex;
                                                    if (sliceIndex === undefined) return;

                                                    if (windowWidth <= 768) {
                                                        const currentTime = new Date().getTime();
                                                        const lastClick = lastClickRef2.current;
                                                        const isSamePoint = (sliceIndex === lastClick.index);
                                                        const isDoubleTap = isSamePoint && (currentTime - lastClick.time < 300);
                                                        lastClickRef2.current = { time: currentTime, index: sliceIndex };
                                                        if (!isDoubleTap) return;
                                                    }

                                                    setSelectedSlices2(prev => {
                                                        if (prev === null) return [sliceIndex];
                                                        const isSelected = prev.includes(sliceIndex);
                                                        if (isSelected) {
                                                            const newSelection = prev.filter(p => p !== sliceIndex);
                                                            return newSelection.length === 0 ? null : newSelection;
                                                        }
                                                        return [...prev, sliceIndex];
                                                    });
                                                }}
                                            />
                                        </div>
                                    </figure>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="page4-table-wrapper">
                        <details onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
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
                                role="region"
                                style={{ borderTop: 'none', padding: '15px' }}
                                tabIndex="0"
                            >
                                <table className="table table-striped table-hover">
                                    <caption className="wb-inv">
                                        {lang === 'en'
                                            ? 'Primary energy production by source, comparing methods including and excluding uranium.'
                                            : "Production d'énergie primaire par source, comparant les méthodes incluant et excluant l'uranium."}
                                    </caption>
                                    <thead>
                                        <tr>
                                            <th scope="col" style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #ddd' }}>
                                                {lang === 'en' ? 'Source' : 'Source'}
                                            </th>
                                            <th scope="col" style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #ddd' }}>
                                                {lang === 'en' ? 'Including Uranium (%)' : "Incluant l'uranium (%)"}
                                            </th>
                                            <th scope="col" style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #ddd' }}>
                                                {lang === 'en' ? 'Excluding Uranium (%)' : "Excluant l'uranium (%)"}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {['crude_oil', 'natural_gas', 'uranium', 'hydro', 'coal', 'ngls', 'other_renewables', 'nuclear'].map(key => {
                                            const includingVal = dataIncludingUranium.sources.find(s => s.key === key)?.value;
                                            const excludingVal = dataExcludingUranium.sources.find(s => s.key === key)?.value;
                                            return (
                                                <tr key={key}>
                                                    <th scope="row" style={{ fontWeight: 'bold', padding: '8px', border: '1px solid #ddd' }}>
                                                        {getText(getLabelKey(key), lang)}
                                                    </th>
                                                    <td style={{ textAlign: 'center', padding: '8px', border: '1px solid #ddd' }}>
                                                        {includingVal ? `${includingVal}%` : '-'}
                                                    </td>
                                                    <td style={{ textAlign: 'center', padding: '8px', border: '1px solid #ddd' }}>
                                                        {excludingVal ? `${excludingVal}%` : '-'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        <tr style={{ backgroundColor: '#f0f0f0' }}>
                                            <th scope="row" style={{ fontWeight: 'bold', padding: '8px', border: '1px solid #ddd' }}>
                                                Total (PJ)
                                            </th>
                                            <td style={{ textAlign: 'center', padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>
                                                {formatNumber(dataIncludingUranium.total)}
                                            </td>
                                            <td style={{ textAlign: 'center', padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>
                                                {formatNumber(dataExcludingUranium.total)}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>

                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '15px' }}>
                                    <button
                                        onClick={downloadTableAsCSV}
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
                                        onClick={downloadTableAsDocx}
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
                            </div>
                        </details>
                    </div>
                </div>

                <aside className="wb-fnote" role="note" style={{ marginTop: '20px', marginBottom: 0 }}>
                    <h2 id="fn-page4">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt>{lang === 'en' ? 'Footnote *' : 'Note de bas de page *'}</dt>
                        <dd id="fn-asterisk-page4" style={{ marginBottom: 0 }}>
                            <p>
                                {getText('page4_footnote', lang)}
                            </p>
                        </dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default Page4;
