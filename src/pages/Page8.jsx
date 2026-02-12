import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { getProvincialGdpData } from '../utils/dataLoader';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

const Page8 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [year, setYear] = useState(null);
    const [allData, setAllData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [isChartInteractive, setIsChartInteractive] = useState(typeof window !== 'undefined' ? window.innerWidth > 768 : true);
    const [selectedProvinces, setSelectedProvinces] = useState(null);
    const chartRef = useRef(null);
    const lastClickRef = useRef({ time: 0, index: null });
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);
    
    // Year dropdown state
    const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
    const yearDropdownRef = useRef(null);
    const yearButtonRef = useRef(null);

    const scrollToFootnote = (e) => {
        e.preventDefault();
        document.getElementById('fn-asterisk-page8')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const scrollToRef = (e) => {
        e.preventDefault();
        document.getElementById('fn-asterisk-rf-page8')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

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

    const provinceInfo = {
        'nl': { nameEn: 'Newfoundland and Labrador', nameFr: 'Terre-Neuve-et-Labrador', abbrevEn: 'N.L.', abbrevFr: 'T.-N.-L.', geoJsonName: 'Newfoundland and Labrador' },
        'pe': { nameEn: 'Prince Edward Island', nameFr: 'Île-du-Prince-Édouard', abbrevEn: 'P.E.I.', abbrevFr: 'Î.-P.-É.', geoJsonName: 'Prince Edward Island' },
        'ns': { nameEn: 'Nova Scotia', nameFr: 'Nouvelle-Écosse', abbrevEn: 'N.S.', abbrevFr: 'N.-É.', geoJsonName: 'Nova Scotia' },
        'nb': { nameEn: 'New Brunswick', nameFr: 'Nouveau-Brunswick', abbrevEn: 'N.B.', abbrevFr: 'N.-B.', geoJsonName: 'New Brunswick' },
        'qc': { nameEn: 'Quebec', nameFr: 'Québec', abbrevEn: 'Que.', abbrevFr: 'Qc', geoJsonName: 'Quebec' },
        'on': { nameEn: 'Ontario', nameFr: 'Ontario', abbrevEn: 'Ont.', abbrevFr: 'Ont.', geoJsonName: 'Ontario' },
        'mb': { nameEn: 'Manitoba', nameFr: 'Manitoba', abbrevEn: 'Man.', abbrevFr: 'Man.', geoJsonName: 'Manitoba' },
        'sk': { nameEn: 'Saskatchewan', nameFr: 'Saskatchewan', abbrevEn: 'Sask.', abbrevFr: 'Sask.', geoJsonName: 'Saskatchewan' },
        'ab': { nameEn: 'Alberta', nameFr: 'Alberta', abbrevEn: 'Alta.', abbrevFr: 'Alb.', geoJsonName: 'Alberta' },
        'bc': { nameEn: 'British Columbia', nameFr: 'Colombie-Britannique', abbrevEn: 'B.C.', abbrevFr: 'C.-B.', geoJsonName: 'British Columbia' },
        'yt': { nameEn: 'Yukon', nameFr: 'Yukon', abbrevEn: 'Y.T.', abbrevFr: 'Yn', geoJsonName: 'Yukon Territory' },
        'nt': { nameEn: 'Northwest Territories', nameFr: 'Territoires du Nord-Ouest', abbrevEn: 'N.W.T.', abbrevFr: 'T.N.-O.', geoJsonName: 'Northwest Territories' },
        'nu': { nameEn: 'Nunavut', nameFr: 'Nunavut', abbrevEn: 'Nunavut', abbrevFr: 'Nt', geoJsonName: 'Nunavut' },
    };

    const provinceCodes = ['bc', 'ab', 'sk', 'mb', 'on', 'qc', 'nb', 'ns', 'pe', 'nl', 'yt', 'nt', 'nu'];

    const provinceCentroids = {
        'nl': { lat: 53.5, lon: -57.0 },
        'pe': { lat: 47.5, lon: -63.0 },  
        'ns': { lat: 43.5, lon: -61.5 },  
        'nb': { lat: 44.5, lon: -68.5 },
        'qc': { lat: 52.5, lon: -72.0 },
        'on': { lat: 50.5, lon: -86.0 },
        'mb': { lat: 55.5, lon: -98.0 },
        'sk': { lat: 54.5, lon: -106.0 },
        'ab': { lat: 54.5, lon: -115.5 },
        'bc': { lat: 54.0, lon: -125.0 },
        'yt': { lat: 64.5, lon: -135.5 },
        'nt': { lat: 65.5, lon: -120.0 },
        'nu': { lat: 67.0, lon: -95.0 }
    };

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

    const downloadChartWithTitle = async (plotEl = null) => {
        const plotElement = plotEl || document.querySelector('.page8-map-container .js-plotly-plot') || chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement) {
            console.error('Plot element not found');
            alert('Could not find chart element. Please try again.');
            return;
        }

        const title = lang === 'en' 
            ? `Energy sector direct nominal GDP* ($ millions) (${year})`
            : `PIB nominal direct du secteur de l'énergie* (en millions de dollars) (${year})`;

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
                link.download = lang === 'en' ? `provincial_gdp_map_${year}.png` : `carte_pib_provincial_${year}.png`;
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
    useEffect(() => {
        getProvincialGdpData()
            .then(data => {
                setAllData(data);
                if (data && data.length > 0) {
                    setYear(data[data.length - 1].year);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error('Error loading Page 8 data:', err);
                setError(err.message);
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
    }, [allData, lang]);

    const minYear = useMemo(() => allData.length > 0 ? allData[0].year : 2019, [allData]);
    const maxYear = useMemo(() => allData.length > 0 ? allData[allData.length - 1].year : 2024, [allData]);
    const currentYearData = useMemo(() => {
        if (!year || allData.length === 0) return null;
        return allData.find(d => d.year === year) || allData[allData.length - 1];
    }, [year, allData]);

    const formatNumber = (num) => {
        if (num === undefined || num === null) return '—';
        return Math.round(num).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA');
    };
    const downloadTableAsCSV = () => {
        if (!allData || allData.length === 0) return;

        const unitHeader = lang === 'en' ? '($ millions)' : '(millions $)';
        const headers = [
            lang === 'en' ? 'Province/Territory' : 'Province/Territoire',
            ...allData.map(yearData => `${yearData.year} ${unitHeader}`)
        ];
        const rows = provinceCodes.map(code => {
            const info = provinceInfo[code];
            const name = lang === 'en' ? info.nameEn : info.nameFr;
            return [name, ...allData.map(yearData => yearData[code] || 0)];
        });
        rows.push([
            lang === 'en' ? 'Canada Total' : 'Total Canada',
            ...allData.map(yearData => yearData.national_total || 0)
        ]);
        const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = lang === 'en' ? 'provincial_gdp_data.csv' : 'pib_provincial_donnees.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };
    const downloadTableAsDocx = async () => {
        if (!allData || allData.length === 0) return;

        const unitHeader = lang === 'en' ? '($ millions)' : '(millions $)';
        const title = getText('page8_title', lang);
        const headers = [
            lang === 'en' ? 'Province/Territory' : 'Province/Territoire',
            ...allData.map(yearData => `${yearData.year} ${unitHeader}`)
        ];

        const headerRow = new TableRow({
            children: headers.map(header => new TableCell({
                children: [new Paragraph({
                    children: [new TextRun({ text: header, bold: true, size: 20 })],
                    alignment: AlignmentType.CENTER
                })],
                shading: { fill: 'E6E6E6' }
            }))
        });
        const dataRows = provinceCodes.map(code => {
            const info = provinceInfo[code];
            const name = lang === 'en' ? info.nameEn : info.nameFr;
            return new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: name, size: 20 })], alignment: AlignmentType.LEFT })] }),
                    ...allData.map(yearData => new TableCell({ 
                        children: [new Paragraph({ children: [new TextRun({ text: formatNumber(yearData[code] || 0), size: 20 })], alignment: AlignmentType.RIGHT })] 
                    }))
                ]
            });
        });
        const totalRow = new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: lang === 'en' ? 'Canada Total' : 'Total Canada', bold: true, size: 20 })], alignment: AlignmentType.LEFT })] }),
                ...allData.map(yearData => new TableCell({ 
                    children: [new Paragraph({ children: [new TextRun({ text: formatNumber(yearData.national_total || 0), bold: true, size: 20 })], alignment: AlignmentType.RIGHT })] 
                }))
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
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: [2500, ...allData.map(() => 1100)],
                        rows: [headerRow, ...dataRows, totalRow]
                    })
                ]
            }]
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'provincial_gdp_table.docx' : 'pib_provincial_tableau.docx');
    };
    const getSRSummary = () => {
        if (!currentYearData) return '';
        const total = currentYearData.national_total || 0;
        const topProvince = lang === 'en' ? 'Alberta' : 'l\'Alberta';
        const topValue = currentYearData.ab || 0;

        if (lang === 'en') {
            return `Energy's nominal GDP contribution by province and territory for ${year}. ` +
                   `The national total is ${formatNumber(total)} million dollars. ` +
                   `${topProvince} has the highest contribution at ${formatNumber(topValue)} million dollars.`;
        } else {
            return `Contribution de l'énergie au PIB nominal par province et territoire pour ${year}. ` +
                   `Le total national est de ${formatNumber(total)} millions de dollars. ` +
                   `${topProvince} a la contribution la plus élevée à ${formatNumber(topValue)} millions de dollars.`;
        }
    };
    const chartData = useMemo(() => {
        if (!currentYearData) return null;

        const values = [];
        const hoverTexts = [];
        const labelLats = [];
        const labelLons = [];
        const labelTexts = [];
        const geoJsonNames = [];
        const highZoomOffsets = {
            'bc': 4,
            'ab': -3,
            'sk': 4,
            'mb': -3,
            'on': -4,
            'qc': 3,
            'nb': -2,
            'ns': -3,
            'pe': 0,
            'nl': 0,
            'yt': 0,
            'nt': 0,
            'nu': 0
        };

        provinceCodes.forEach(code => {
            const value = currentYearData[code] || 0;
            const info = provinceInfo[code];
            const name = lang === 'en' ? info.nameEn : info.nameFr;
            const abbrev = lang === 'en' ? info.abbrevEn : info.abbrevFr;

            values.push(value);
            hoverTexts.push(`<b>${name}</b><br>$${formatNumber(value)}M`);
            geoJsonNames.push(info.geoJsonName);
            const centroid = provinceCentroids[code];
            const latOffset = windowWidth <= 480 ? (highZoomOffsets[code] || 0) : 0;
            labelLats.push(centroid.lat + latOffset);
            labelLons.push(centroid.lon);
            labelTexts.push(`${abbrev}\n${formatNumber(value)}`);
        });

        return { values, hoverTexts, labelLats, labelLons, labelTexts, geoJsonNames };
    }, [currentYearData, lang, windowWidth]);
    const { mapScale, mapCenter } = useMemo(() => {
        const scale = (windowWidth > 960 && windowWidth <= 1097) ? 2 : 2.2;
        return { 
            mapScale: scale, 
            mapCenter: { lon: -96, lat: 64 } 
        };
    }, [windowWidth]);

    if (loading) {
        return (
            <main className="page-content page-8" role="main">
                <div style={{ padding: '40px', textAlign: 'center' }}>
                    {lang === 'en' ? 'Loading...' : 'Chargement...'}
                </div>
            </main>
        );
    }

    if (error) {
        return (
            <main className="page-content page-8" role="main">
                <div style={{ padding: '40px', color: 'red' }}>
                    Error: {error}
                </div>
            </main>
        );
    }

    return (
        <main 
            id="main-content"
            tabIndex="-1"
            className="page-content page-8" 
            role="main"
            aria-label={getText('page8_title', lang)}
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

                .page-8 {
                    margin-left: -${layoutPadding?.left || 55}px;
                    width: calc(100% + ${layoutPadding?.left || 55}px);
                    padding-left: ${layoutPadding?.left || 55}px; 
                }

                .page8-container {
                    width: 100%;
                    padding: 20px 0;
                    display: flex;
                    flex-direction: column;
                }

                .page8-header {
                    margin-bottom: 20px;
                }

                .page8-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 41px;
                    font-weight: bold;
                    color: var(--gc-text);
                    margin-top: 0;
                    margin-bottom: 25px;
                    position: relative;
                    padding-bottom: 0.5em;
                }

                .page8-title::after {
                    content: '';
                    position: absolute;
                    left: 0;
                    bottom: 0.2em;
                    width: 72px;
                    height: 6px;
                    background-color: var(--gc-red);
                }

                .page8-subtitle {
                    font-family: 'Lato', sans-serif;
                    font-size: 29px;
                    font-weight: bold;
                    color: var(--gc-text);
                    margin-top: 0;
                    margin-bottom: 20px;
                    white-space: pre-line;
                }

                .page8-chart-frame {
                    background-color: #f5f5f5;
                    padding: 20px;
                    border-radius: 8px;
                    margin-top: 0;
                    margin-bottom: 20px;
                    box-sizing: border-box;
                }

                .page8-year-selector {
                    display: flex;
                    align-items: center;
                    margin: 10px 0;
                    padding: 2px 0;
                    position: relative;
                    z-index: 10;
                }

                .page8-year-label {
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

                .page8-map-container {
                    position: relative;
                    width: 100%;
                    min-width: 600px;
                    height: 650px;
                    margin-left: auto;
                    margin-right: auto;
                    margin-top: 0;
                    margin-bottom: 0;
                    overflow: visible;
                    z-index: 1;
                    pointer-events: none;
                }

                .page8-map-container .js-plotly-plot,
                .page8-map-container button,
                .page8-map-container div[role="button"] {
                    pointer-events: auto;
                }

                .page8-data-table {
                    width: 100%;
                    margin-bottom: 0;
                    position: relative;
                    z-index: 10;
                }

                .page8-data-table summary {
                    cursor: pointer;
                    padding: 10px 15px;
                    background-color: #fff;
                    color: var(--gc-text);
                    font-weight: bold;
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    list-style: none;
                    position: relative;
                    z-index: 100;
                }

                .page8-data-table summary:hover {
                    background-color: #f5f5f5;
                }

                .page8-data-table summary:focus {
                    outline: none;
                }

                .page8-data-table[open] summary {
                    border-radius: 4px 4px 0 0;
                    border-bottom: none;
                }

                .page8-data-table table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 0;
                    border: 1px solid #ccc;
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                }

                .page8-data-table th,
                .page8-data-table td {
                    padding: 10px;
                    text-align: left;
                    border: 1px solid #ddd;
                }

                .page8-data-table th {
                    background-color: #f5f5f5;
                    font-weight: bold;
                }

                .page8-data-table td:last-child {
                    text-align: right;
                }

                @media (max-width: 1100px) {
                    .page8-map-container {
                        width: 100%;
                        min-width: 0;
                        height: 700px;
                        margin-bottom: 0;
                    }
                }

                @media (max-width: 768px) {
                    .page8-map-container {
                        margin-bottom: 0;
                        margin-top: 0;
                    }
                
                    .page8-title {
                        font-size: 37px;
                    }
                    .page8-subtitle {
                        font-size: 26px;
                    }
                    .page8-year-label {
                        font-size: 18px;
                    }
                    .dropdown-button {
                        font-size: 18px;
                    }
                    .page8-data-table summary {
                        font-size: 18px;
                    }
                    .page8-data-table table {
                        font-size: 18px;
                    }

                    .page8-data-table {
                        margin-top: 100px;
                    }
                }
                

                @media (max-width: 640px) {
                    .page-8 { 
                        border-left: none !important; 
                        margin-left: 0;
                        width: 100%;
                        padding-left: 0;
                    }
                    .page8-map-container {
                        width: 100%;
                        min-width: 0;
                        height: 450px;
                        margin-top: 0;
                        margin-bottom: 0;
                    }
                    .page8-year-selector {
                        flex-direction: column;
                        align-items: flex-start;
                    }
                    .page8-year-label {
                        margin-bottom: 10px;
                        margin-right: 0;
                    }
                }

                @media (max-width: 480px) {
                    .page8-map-container {
                        width: 140%;
                        margin-top: 0;
                        margin-left: -20% !important;
                        height: 400px;
                    }
                    .page8-table-wrapper {
                        margin-top: 120px;
                    }
                }

                @media (max-width: 384px) {
                    .page8-table-wrapper {
                        margin-top: 150px;
                    }
                }

                @media (max-width: 320px) {
                    .page8-table-wrapper {
                        margin-top: 180px;
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

                .page8-table-wrapper {
                    display: block;
                    width: 100%;
                    margin: 0;
                    margin-top: 20px;
                    position: relative;
                    z-index: 10;
                }

                .page8-table-wrapper details > summary {
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

                .page8-table-wrapper details > summary::-webkit-details-marker {
                    display: none;
                }

                .page8-table-wrapper details > summary:hover {
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

                .table-responsive table th,
                .table-responsive table td {
                    white-space: nowrap;
                    padding: 8px 12px;
                }
            `}</style>
            <div className="page8-container">
                <header 
                    className="page8-header"
                    role="region"
                    aria-label={lang === 'en' 
                        ? `${stripHtml(getText('page8_title', lang))} - Energy sector direct nominal GDP (millions of dollars)`
                        : `${stripHtml(getText('page8_title', lang))} - PIB nominal direct du secteur de l'énergie (millions de dollars)`
                    }
                    tabIndex="0"
                >
                    <h1 className="page8-title" aria-hidden="true">
                        {getText('page8_title', lang)}
                    </h1>
                    <p className="page8-subtitle" aria-hidden="true">
                        {getText('page8_subtitle', lang).split('*')[0]}
                        {getText('page8_subtitle', lang).split('*').slice(1).join('*')}
                    </p>
                    <span id="fn-asterisk-rf-page8" style={{ verticalAlign: 'super', fontSize: '0.75em', lineHeight: '0' }}>
                        <a href="#fn-asterisk-page8" onClick={scrollToFootnote} className="fn-lnk">
                            <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span><span aria-hidden="true">*</span>
                        </a>
                    </span>
                </header>
                {/* Chart Frame with Year Selector and Chart */}
                <div className="page8-chart-frame">
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
                            {[...allData].sort((a, b) => b.year - a.year).map((yearData) => {
                                const isSelected = year === yearData.year;
                                return (
                                    <button
                                        key={yearData.year}
                                        type="button"
                                        aria-pressed={isSelected}
                                        aria-label={yearData.year.toString()}
                                        onClick={() => {
                                            setYear(yearData.year);
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
                                            {yearData.year}
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
                <div 
                    role="region" 
                    aria-label={getSRSummary()}
                    tabIndex="0"
                >
                    <figure ref={chartRef} className="page8-map-container" style={{ margin: 0, position: 'relative' }}>
                    {selectedProvinces !== null && (
                        <button onClick={() => setSelectedProvinces(null)} style={{ position: 'absolute', top: 0, right: 295, zIndex: 20 }}>{lang === 'en' ? 'Clear' : 'Effacer'}</button>
                    )}
                    {chartData && (
                        <Plot
                            key={`map-${selectedProvinces ? selectedProvinces.join('-') : 'none'}`}
                            data={[
                                {
                                    type: 'choropleth',
                                    locationmode: 'geojson-id',
                                    geojson: 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/canada.geojson',
                                    featureidkey: 'properties.name',
                                    locations: chartData.geoJsonNames,
                                    z: chartData.values,
                                    text: provinceCodes.map((code, i) => {
                                        const info = provinceInfo[code];
                                        const name = lang === 'en' ? info.nameEn : info.nameFr;
                                        return `<b>${name}</b><br>${year}<br>$${formatNumber(chartData.values[i])}M`;
                                    }),
                                    hoverinfo: 'text',
                                    hoverlabel: {
                                        bgcolor: '#ffffff',
                                        bordercolor: '#000000',
                                        font: { color: '#000000', size: windowWidth <= 640 ? 12 : 14, family: 'Arial, sans-serif' }
                                    },
                                    colorscale: [[0, '#AA9255'], [1, '#AA9255']],
                                    zmin: 0,
                                    zmax: 1,
                                    showscale: false,
                                    marker: {
                                        line: {
                                            color: 'white',
                                            width: 1.5
                                        }
                                    },
                                    selectedpoints: selectedProvinces,
                                    selected: {
                                        marker: {
                                            opacity: 1
                                        }
                                    },
                                    unselected: {
                                        marker: {
                                            opacity: 0.3
                                        }
                                    }
                                },
                                {
                                    type: 'scattergeo',
                                    mode: 'text',
                                    lat: chartData.labelLats,
                                    lon: chartData.labelLons,
                                    text: provinceCodes.map((code, i) => {
                                        const info = provinceInfo[code];
                                        const abbrev = lang === 'en' ? info.abbrevEn : info.abbrevFr;
                                        if (windowWidth <= 480) {
                                            return `${abbrev}<br>${formatNumber(chartData.values[i])}`;
                                        }
                                        return `<b>${abbrev}</b><br><b>${formatNumber(chartData.values[i])}</b>`;
                                    }),
                                    textfont: {
                                        family: 'Arial, sans-serif',
                                        size: windowWidth <= 640 ? 12 : 14,
                                        color: selectedProvinces === null 
                                            ? '#000000' 
                                            : provinceCodes.map((_, i) => selectedProvinces.includes(i) ? '#333333' : hexToRgba('#333333', 0.3))
                                    },
                                    hoverinfo: 'text',
                                    hovertext: provinceCodes.map((code, i) => {
                                        const info = provinceInfo[code];
                                        const name = lang === 'en' ? info.nameEn : info.nameFr;
                                        return `<b>${name}</b><br>${year}<br>$${formatNumber(chartData.values[i])}M`;
                                    }),
                                    hoverlabel: {
                                        bgcolor: '#ffffff',
                                        bordercolor: '#000000',
                                        font: { color: '#000000', size: windowWidth <= 640 ? 12 : 14, family: 'Arial, sans-serif' }
                                    },
                                    showlegend: false
                                }
                            ]}
                            layout={{
                                geo: {
                                    scope: 'north america',
                                    projection: {
                                        type: 'conic conformal',
                                        parallels: [50, 70],
                                        rotation: { lon: -96 },
                                        scale: mapScale
                                    },
                                    center: mapCenter,
                                    showframe: false,
                                    showland: false,
                                    showcountries: false,
                                    showcoastlines: false,
                                    showsubunits: false,
                                    showlakes: true,
                                    lakecolor: '#f5f5f5',
                                    bgcolor: 'rgba(0,0,0,0)'
                                },
                                margin: { l: 0, r: 0, t: 0, b: 0 },
                                height: 650,
                                clickmode: 'event',
                                dragmode: windowWidth <= 768 ? false : 'zoom',
                                paper_bgcolor: 'rgba(0,0,0,0)',
                                plot_bgcolor: 'rgba(0,0,0,0)'
                            }}
                            onClick={(data) => {
                                if (!data.points || data.points.length === 0) return;
                                const clickedPoint = data.points[0];
                                const provinceIndex = clickedPoint.pointNumber !== undefined ? clickedPoint.pointNumber : clickedPoint.pointIndex;

                                if (provinceIndex === undefined) return;
                                if (windowWidth <= 768) {
                                    const currentTime = new Date().getTime();
                                    const lastClick = lastClickRef.current;
                                    const isSamePoint = (provinceIndex === lastClick.index);
                                    const isDoubleTap = isSamePoint && (currentTime - lastClick.time < 300);
                                    
                                    lastClickRef.current = { time: currentTime, index: provinceIndex };
                                    
                                    if (!isDoubleTap) {
                                        return; // Single tap: show hover label only
                                    }
                                }

                                setSelectedProvinces(prev => {
                                    if (prev === null) {
                                        return [provinceIndex];
                                    }

                                    const isSelected = prev.includes(provinceIndex);

                                    if (isSelected) {
                                        const newSelection = prev.filter(p => p !== provinceIndex);
                                        if (newSelection.length === 0) {
                                            return null;
                                        }
                                        return newSelection;
                                    } else {
                                        return [...prev, provinceIndex];
                                    }
                                });
                            }}
                            config={{
                                displayModeBar: true,
                                displaylogo: false,
                                responsive: true,
                                scrollZoom: false,
                                staticPlot: false,
                                modeBarButtonsToRemove: ['toImage', 'select2d', 'lasso2d', 'zoom2d', 'pan2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d'],
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
                            style={{ width: '100%', height: '100%' }}
                        />
                    )}
                    </figure>
                </div>

                <div className="page8-table-wrapper">
                <details 
                    className="page8-data-table"
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
                                    ? `Energy sector direct nominal GDP by province/territory, ${minYear}-${maxYear} (millions of dollars)`
                                    : `PIB nominal direct du secteur de l'énergie par province/territoire, ${minYear}-${maxYear} (millions de dollars)`
                                }
                            </caption>
                            <thead>
                                <tr>
                                    <td style={{ borderBottom: 'none' }} aria-hidden="true"></td>
                                    <th scope="colgroup" colSpan={allData.length} style={{ textAlign: 'center', borderBottom: 'none' }}>
                                        <span aria-hidden="true">{lang === 'en' ? '($ millions)' : '(millions $)'}</span>
                                        <span className="wb-inv">{lang === 'en' ? '(millions of dollars)' : '(millions de dollars)'}</span>
                                    </th>
                                </tr>
                                <tr>
                                    <th scope="col" style={{ fontWeight: 'bold', borderTop: 'none' }}>
                                        {lang === 'en' ? 'Province/Territory' : 'Province/Territoire'}
                                    </th>
                                    {allData.map(yearData => (
                                        <th key={yearData.year} scope="col" style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                            {yearData.year}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {provinceCodes.map((code, idx) => {
                                    const info = provinceInfo[code];
                                    const name = lang === 'en' ? info.nameEn : info.nameFr;
                                    const cellUnitSR = lang === 'en' ? ' million dollars' : ' millions de dollars';
                                    return (
                                        <tr key={code}>
                                            <th scope="row" style={{ fontWeight: 'bold' }}>{name}</th>
                                            {allData.map(yearData => (
                                                <td 
                                                    key={yearData.year} 
                                                    style={{ textAlign: 'right' }}
                                                    aria-label={`${name}, ${yearData.year}: ${formatNumber(yearData[code])}${cellUnitSR}`}
                                                >
                                                    {formatNumber(yearData[code])}
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                                <tr style={{ fontWeight: 'bold' }}>
                                    <th scope="row">{lang === 'en' ? 'Canada Total' : 'Total Canada'}</th>
                                    {allData.map(yearData => {
                                        const totalLabel = lang === 'en' ? 'Canada Total' : 'Total Canada';
                                        const cellUnitSR = lang === 'en' ? ' million dollars' : ' millions de dollars';
                                        return (
                                            <td 
                                                key={yearData.year} 
                                                style={{ textAlign: 'right' }}
                                                aria-label={`${totalLabel}, ${yearData.year}: ${formatNumber(yearData.national_total)}${cellUnitSR}`}
                                            >
                                                {formatNumber(yearData.national_total)}
                                            </td>
                                        );
                                    })}
                                </tr>
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
                </div> {/* End chart-frame */}
                <aside className="wb-fnote" role="note">
                    <h2 id="fn">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt>{lang === 'en' ? 'Footnote *' : 'Note de bas de page *'}</dt>
                        <dd id="fn-asterisk-page8">
                            <a href="#fn-asterisk-rf-page8" onClick={scrollToRef} className="fn-num" title={lang === 'en' ? 'Return to footnote * referrer' : 'Retour à la référence de la note de bas de page *'}>
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>*
                            </a>
                            <p>
                                {getText('page8_footnote', lang)}
                                {year === 2024 && getText('page8_footnote_2024', lang)}
                            </p>
                        </dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default Page8;
