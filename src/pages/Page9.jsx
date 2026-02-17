import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

const Page9 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [year, setYear] = useState(2024);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [selectedProvinces, setSelectedProvinces] = useState(null);
    const mapChartRef = useRef(null);
    const pieChartRef = useRef(null);
    const lastClickRef = useRef({ time: 0, index: null });
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);
    
    const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
    const yearDropdownRef = useRef(null);
    const yearButtonRef = useRef(null);

    const scrollToFootnote = (e) => {
        e.preventDefault();
        document.getElementById('fn-asterisk-page9')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const scrollToRef = (e) => {
        e.preventDefault();
        document.getElementById('fn-asterisk-rf-page9')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

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

    const indirectRatio = 428300 / 316200;
    
    const employmentData = {
        bc: { direct: 29873, indirect: Math.round(29873 * indirectRatio) },
        ab: { direct: 159826, indirect: Math.round(159826 * indirectRatio) },
        sk: { direct: 17168, indirect: Math.round(17168 * indirectRatio) },
        mb: { direct: 6679, indirect: Math.round(6679 * indirectRatio) },
        on: { direct: 53834, indirect: Math.round(53834 * indirectRatio) },
        qc: { direct: 33109, indirect: Math.round(33109 * indirectRatio) },
        nb: { direct: 5491, indirect: Math.round(5491 * indirectRatio) },
        ns: { direct: 3128, indirect: Math.round(3128 * indirectRatio) },
        pe: { direct: 348, indirect: Math.round(348 * indirectRatio) },
        nl: { direct: 6155, indirect: Math.round(6155 * indirectRatio) },
        yt: { direct: 149, indirect: Math.round(149 * indirectRatio) },
        nt: { direct: 254, indirect: Math.round(254 * indirectRatio) },
        nu: { direct: 229, indirect: Math.round(229 * indirectRatio) },
        direct_total: 316200,
        indirect_total: 428300,
        total: 744500,
        indigenous_employed: 18200,
        share_total_pct: 3.6,
        energy_direct_pct: 1.5,
        petroleum_pct: 0.9,
        electricity_pct: 0.5,
        other_pct: 0.1,
        energy_indirect_pct: 2.1
    };
    
    const getProvinceTotal = (code) => employmentData[code].direct + employmentData[code].indirect;
    const getProvinceEnergyShare = (code) => ((getProvinceTotal(code) / employmentData.total) * 100).toFixed(1);
    const getProvinceNonEnergyShare = (code) => ((getProvinceTotal(code) / (employmentData.total / employmentData.share_total_pct * (100 - employmentData.share_total_pct))) * 100).toFixed(2);

    const years = Array.from({ length: 2024 - 2009 + 1 }, (_, i) => 2024 - i);

    // Yearly employment data by province for all years (currently same values - will be updated with real data later)
    // Each year contains direct employment values for each province
    const yearlyProvinceData = years.map(yr => ({
        year: yr,
        bc: 29873,
        ab: 159826,
        sk: 17168,
        mb: 6679,
        on: 53834,
        qc: 33109,
        nb: 5491,
        ns: 3128,
        pe: 348,
        nl: 6155,
        yt: 149,
        nt: 254,
        nu: 229,
        national_total: 316200
    }));

    const COLORS = {
        'energy_sector': '#245e7f',
        'non_energy': '#9A9389',
        'map_fill': '#AA9255'
    };

    useEffect(() => {
        const handleResize = () => {
            setWindowWidth(window.innerWidth);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!mapChartRef.current) return;
        
        const setupChartAccessibility = () => {
            const plotContainer = mapChartRef.current;
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
        observer.observe(mapChartRef.current, { childList: true, subtree: true });
        setupChartAccessibility();

        return () => observer.disconnect();
    }, [lang]);

    useEffect(() => {
        if (!pieChartRef.current) return;
        
        const setupChartAccessibility = () => {
            const plotContainer = pieChartRef.current;
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
        observer.observe(pieChartRef.current, { childList: true, subtree: true });
        setupChartAccessibility();

        return () => observer.disconnect();
    }, [lang]);

    const formatNumber = (num) => {
        if (num === undefined || num === null) return '—';
        return Math.round(num).toLocaleString(lang === 'en' ? 'en-CA' : 'fr-CA');
    };

    const formatPercent = (num) => {
        if (num === undefined || num === null) return '—';
        return lang === 'en' ? `${num}%` : `${num.toString().replace('.', ',')} %`;
    };

    const downloadMapWithTitle = async (plotEl = null) => {
        const plotElement = plotEl || mapChartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement) {
            alert('Could not find chart element.');
            return;
        }

        const title = getText('page9_map_title', lang);

        try {
            if (!window.Plotly) {
                alert('Plotly library not loaded.');
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
                link.download = lang === 'en' ? `employment_map_${year}.png` : `emploi_carte_${year}.png`;
                link.href = canvas.toDataURL('image/png');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            };

            img.src = imgData;
        } catch (error) {
            alert('Error downloading chart: ' + error.message);
        }
    };

    const downloadPieWithTitle = async (plotEl = null) => {
        const plotElement = plotEl || pieChartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement) {
            alert('Could not find chart element.');
            return;
        }

        const title = lang === 'en' 
            ? `Share of total employment, ${year}`
            : `Pourcentage du total des emplois, ${year}`;

        try {
            if (!window.Plotly) {
                alert('Plotly library not loaded.');
                return;
            }

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
                const legendWidth = 400;
                const legendHeight = 220;
                canvas.width = img.width + legendWidth;
                canvas.height = img.height + titleHeight;

                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                ctx.fillStyle = '#333333';
                ctx.font = 'bold 36px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(title, (img.width) / 2, 50);

                ctx.drawImage(img, 0, titleHeight);

                const legendX = img.width + 20;
                let legendY = titleHeight + 80;
                const lineHeight = 30;

                ctx.textAlign = 'left';
                ctx.font = 'bold 24px Arial';
                ctx.fillStyle = '#000000';
                ctx.fillText(lang === 'en' ? 'Total employment' : 'Total des emplois', legendX, legendY);
                legendY += lineHeight + 10;

                ctx.font = 'bold 22px Arial';
                ctx.fillStyle = '#245e7f';
                ctx.fillText(`${lang === 'en' ? 'Energy direct' : 'Énergie (emplois directs)'} ${formatPercent(employmentData.energy_direct_pct)}`, legendX, legendY);
                legendY += lineHeight;

                ctx.font = 'bold 20px Arial';
                ctx.fillStyle = '#58585a';
                ctx.fillText(`   ${lang === 'en' ? 'Petroleum' : 'Pétrole'} ${formatPercent(employmentData.petroleum_pct)}`, legendX, legendY);
                legendY += lineHeight;
                ctx.fillText(`   ${lang === 'en' ? 'Electricity' : 'Électricité'} ${formatPercent(employmentData.electricity_pct)}`, legendX, legendY);
                legendY += lineHeight;
                ctx.fillText(`   ${lang === 'en' ? 'Other' : 'Autres'} ${formatPercent(employmentData.other_pct)}`, legendX, legendY);
                legendY += lineHeight + 10;

                ctx.font = 'bold 22px Arial';
                ctx.fillStyle = '#245e7f';
                ctx.fillText(`${lang === 'en' ? 'Energy indirect' : 'Énergie (emplois indirects)'} ${formatPercent(employmentData.energy_indirect_pct)}`, legendX, legendY);

                const link = document.createElement('a');
                link.download = lang === 'en' ? `employment_share_${year}.png` : `part_emploi_${year}.png`;
                link.href = canvas.toDataURL('image/png');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            };

            img.src = imgData;
        } catch (error) {
            alert('Error downloading chart: ' + error.message);
        }
    };

    const downloadTableAsCSV = () => {
        const headers = [
            lang === 'en' ? 'Province/Territory' : 'Province/Territoire',
            ...yearlyProvinceData.map(d => String(d.year))
        ];

        const rows = provinceCodes.map(code => {
            const info = provinceInfo[code];
            const name = lang === 'en' ? info.nameEn : info.nameFr;
            return [name, ...yearlyProvinceData.map(yearData => yearData[code])];
        });

        // Add Canada Total row
        rows.push([
            lang === 'en' ? 'Canada Total (Direct)' : 'Total Canada (direct)',
            ...yearlyProvinceData.map(yearData => yearData.national_total)
        ]);

        // Add share rows
        rows.push([
            lang === 'en' ? 'Share of total employment (Direct)' : "Part de l'emploi total (direct)",
            ...yearlyProvinceData.map(() => `${employmentData.energy_direct_pct}%`)
        ]);
        rows.push([
            lang === 'en' ? 'Share of total employment (Indirect)' : "Part de l'emploi total (indirect)",
            ...yearlyProvinceData.map(() => `${employmentData.energy_indirect_pct}%`)
        ]);
        rows.push([
            lang === 'en' ? 'Share of total employment (Total)' : "Part de l'emploi total (total)",
            ...yearlyProvinceData.map(() => `${employmentData.share_total_pct}%`)
        ]);

        const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = lang === 'en' ? 'employment_data.csv' : 'donnees_emploi.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const downloadTableAsDocx = async () => {
        const title = getText('page9_title', lang);
        const headers = [
            lang === 'en' ? 'Province/Territory' : 'Province/Territoire',
            ...yearlyProvinceData.map(d => String(d.year))
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

        const dataRows = provinceCodes.map(code => {
            const info = provinceInfo[code];
            const name = lang === 'en' ? info.nameEn : info.nameFr;
            return new TableRow({
                children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: name, size: 18 })], alignment: AlignmentType.LEFT })] }),
                    ...yearlyProvinceData.map(yearData => new TableCell({ 
                        children: [new Paragraph({ children: [new TextRun({ text: formatNumber(yearData[code]), size: 18 })], alignment: AlignmentType.RIGHT })] 
                    }))
                ]
            });
        });

        // Add Canada Total row
        const totalRow = new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: lang === 'en' ? 'Canada Total (Direct)' : 'Total Canada (direct)', bold: true, size: 18 })], alignment: AlignmentType.LEFT })] }),
                ...yearlyProvinceData.map(yearData => new TableCell({ 
                    children: [new Paragraph({ children: [new TextRun({ text: formatNumber(yearData.national_total), bold: true, size: 18 })], alignment: AlignmentType.RIGHT })] 
                }))
            ]
        });

        // Add share rows
        const shareDirectRow = new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: lang === 'en' ? 'Share of total employment (Direct)' : "Part de l'emploi total (direct)", bold: true, size: 18 })], alignment: AlignmentType.LEFT })] }),
                ...yearlyProvinceData.map(() => new TableCell({ 
                    children: [new Paragraph({ children: [new TextRun({ text: `${employmentData.energy_direct_pct}%`, size: 18 })], alignment: AlignmentType.RIGHT })] 
                }))
            ]
        });

        const shareIndirectRow = new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: lang === 'en' ? 'Share of total employment (Indirect)' : "Part de l'emploi total (indirect)", bold: true, size: 18 })], alignment: AlignmentType.LEFT })] }),
                ...yearlyProvinceData.map(() => new TableCell({ 
                    children: [new Paragraph({ children: [new TextRun({ text: `${employmentData.energy_indirect_pct}%`, size: 18 })], alignment: AlignmentType.RIGHT })] 
                }))
            ]
        });

        const shareTotalRow = new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: lang === 'en' ? 'Share of total employment (Total)' : "Part de l'emploi total (total)", bold: true, size: 18 })], alignment: AlignmentType.LEFT })] }),
                ...yearlyProvinceData.map(() => new TableCell({ 
                    children: [new Paragraph({ children: [new TextRun({ text: `${employmentData.share_total_pct}%`, bold: true, size: 18 })], alignment: AlignmentType.RIGHT })] 
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
                        rows: [headerRow, ...dataRows, totalRow, shareDirectRow, shareIndirectRow, shareTotalRow]
                    })
                ]
            }]
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'employment_data.docx' : 'donnees_emploi.docx');
    };

    const getMapSRSummary = () => {
        if (lang === 'en') {
            return `Map showing energy sector direct employment by province and territory for ${year}. Alberta has the highest employment at ${formatNumber(employmentData.ab.direct)} jobs. Total direct employment is ${formatNumber(employmentData.direct_total)} jobs.`;
        } else {
            return `Carte montrant les emplois directs du secteur de l'énergie par province et territoire pour ${year}. L'Alberta a le plus grand nombre d'emplois avec ${formatNumber(employmentData.ab.direct)} emplois. Le total des emplois directs est de ${formatNumber(employmentData.direct_total)} emplois.`;
        }
    };

    const getPieSRSummary = () => {
        if (lang === 'en') {
            return `Pie chart showing energy sector's share of total employment in ${year}. Energy sector represents ${employmentData.share_total_pct}% of total employment, with Energy Direct at ${employmentData.energy_direct_pct}% and Energy Indirect at ${employmentData.energy_indirect_pct}%.`;
        } else {
            return `Graphique circulaire montrant la part du secteur de l'énergie dans l'emploi total en ${year}. Le secteur de l'énergie représente ${employmentData.share_total_pct} % de l'emploi total, avec l'énergie directe à ${employmentData.energy_direct_pct} % et l'énergie indirecte à ${employmentData.energy_indirect_pct} %.`;
        }
    };

    const getLegendText = () => {
        if (lang === 'en') {
            return `Total employment breakdown. Energy Direct: ${employmentData.energy_direct_pct}%, including Petroleum at ${employmentData.petroleum_pct}%, Electricity at ${employmentData.electricity_pct}%, and Other at ${employmentData.other_pct}%. Energy Indirect: ${employmentData.energy_indirect_pct}%.`;
        } else {
            return `Répartition de l'emploi total. Énergie directe : ${employmentData.energy_direct_pct} %, incluant le Pétrole à ${employmentData.petroleum_pct} %, l'Électricité à ${employmentData.electricity_pct} % et Autres à ${employmentData.other_pct} %. Énergie indirecte : ${employmentData.energy_indirect_pct} %.`;
        }
    };

    // Responsive map height based on window width
    const mapHeight = useMemo(() => {
        if (windowWidth <= 384) return 400; 
        if (windowWidth <= 640) return 400;
        if (windowWidth <= 768) return 550;
        if (windowWidth <= 1280) return 650; 
        return 750;                         
    }, [windowWidth]);

    const mapChartData = useMemo(() => {
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
            const value = employmentData[code]?.direct || 0;
            const info = provinceInfo[code];
            const name = lang === 'en' ? info.nameEn : info.nameFr;
            const abbrev = lang === 'en' ? info.abbrevEn : info.abbrevFr;

            values.push(value);
            hoverTexts.push(`<b>${name}</b><br>${formatNumber(value)} ${lang === 'en' ? 'jobs' : 'emplois'}`);
            geoJsonNames.push(info.geoJsonName);
            const centroid = provinceCentroids[code];
            const latOffset = windowWidth <= 480 ? (highZoomOffsets[code] || 0) : 0;
            labelLats.push(centroid.lat + latOffset);
            labelLons.push(centroid.lon);
            labelTexts.push(`${abbrev}\n${formatNumber(value)}`);
        });

        return { values, hoverTexts, labelLats, labelLons, labelTexts, geoJsonNames };
    }, [lang, windowWidth]);

    const pieChartData = useMemo(() => {
        const energyPct = employmentData.share_total_pct;
        const nonEnergyPct = 100 - energyPct;

        const energyLabel = `<b>${lang === 'fr' ? energyPct.toString().replace('.', ',') : energyPct}${lang === 'fr' ? ' %' : '%'}</b>`;

        return [{
            type: 'pie',
            values: [energyPct, nonEnergyPct],
            labels: [
                getText('page9_energy_sector', lang),
                getText('page9_non_energy', lang)
            ],
            text: [energyLabel, ''],
            texttemplate: windowWidth <= 768 ? '%{percent:.1%}' : '%{text}',
            textinfo: windowWidth <= 768 ? 'percent' : 'text',
            textposition: windowWidth <= 768 ? 'inside' : 'outside',
            textfont: { 
                size: windowWidth <= 480 ? 14 : windowWidth <= 768 ? 16 : 24, 
                family: 'Arial, sans-serif',
                color: windowWidth <= 768 ? '#ffffff' : '#221e1f'
            },
            outsidetextfont: { 
                color: '#221e1f',
                size: windowWidth <= 768 ? 16 : 24,
                family: 'Arial, sans-serif'
            },
            hoverinfo: 'text',
            hovertext: [
                `<b>${getText('page9_energy_sector', lang)}</b><br>${energyPct}%`,
                `<b>${getText('page9_non_energy', lang)}</b><br>${nonEnergyPct.toFixed(1)}%`
            ],
            hoverlabel: {
                bgcolor: '#ffffff',
                bordercolor: '#000000',
                font: { color: '#000000', size: windowWidth <= 640 ? 12 : 14, family: 'Arial, sans-serif' }
            },
            marker: {
                colors: [COLORS.energy_sector, COLORS.non_energy],
                line: { color: '#ffffff', width: 2 }
            },
            hole: 0.0,
            direction: 'clockwise',
            rotation: 45,
            sort: false,
            pull: [0.02, 0],
        }];
    }, [lang, windowWidth]);

    const { mapScale, mapCenter } = useMemo(() => {
        const scale = (windowWidth > 960 && windowWidth <= 1097) ? 2 : 2.2;
        return { 
            mapScale: scale, 
            mapCenter: { lon: -96, lat: 64 } 
        };
    }, [windowWidth]);

    return (
        <main 
            id="main-content"
            tabIndex="-1"
            className="page-content page-9" 
            role="main"
            aria-label={getText('page9_title', lang)}
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

                .page-9 {
                    margin-left: -${layoutPadding?.left || 55}px;
                    width: calc(100% + ${layoutPadding?.left || 55}px);
                    padding-left: ${layoutPadding?.left || 55}px; 
                }

                .page9-container {
                    width: 100%;
                    padding: 20px 0;
                    display: flex;
                    flex-direction: column;
                }

                .page9-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 50px;
                    font-weight: bold;
                    color: #245e7f;
                    margin-top: 0;
                    margin-bottom: 25px;
                    position: relative;
                    padding-bottom: 0.5em;
                }

                .page9-title::after {
                    content: '';
                    position: absolute;
                    left: 0;
                    bottom: 0.2em;
                    width: 72px;
                    height: 6px;
                    background-color: var(--gc-red);
                }

                .page9-stats {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                    color: #332f30;
                    margin-bottom: 15px;
                    line-height: 1.6;
                }

                .page9-stats-line {
                    margin-bottom: 4px;
                }

                .page9-stats-total {
                    font-weight: bold;
                    font-size: 22px;
                }

                .page9-chart-frame {
                    background-color: #f5f5f5;
                    padding: 20px;
                    border-radius: 8px;
                    margin-top: 0;
                    margin-bottom: 20px;
                    box-sizing: border-box;
                }

                .page9-content-row {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 30px;
                }

                .page9-left-column {
                    flex: 1;
                    min-width: 300px;
                }

                .page9-right-column {
                    flex: 1;
                    min-width: 300px;
                    padding-left: 50px;
                }

                .page9-map-section-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 20px;
                    font-weight: bold;
                    color: #463825;
                    margin-bottom: 10px;
                }

                .page9-map-container {
                    position: relative;
                    width: 200%;
                    min-width: 600px;
                    height: 100%;
                    margin-left: -45% !important;
                    overflow: visible;
                    z-index: 100;
                    pointer-events: none;
                }

                .page9-map-container .js-plotly-plot,
                .page9-map-container button,
                .page9-map-container div[role="button"] {
                    pointer-events: auto;
                }

                .page9-map-container .js-plotly-plot .plotly .modebar {
                    right: 20% !important;
                    top: 100px !important;
                }

                .page9-indigenous-bullet {
                    font-family: 'Noto Sans', sans-serif;
                    font-size: 20px;
                    color: #000000;
                    margin-top: 20px;
                    margin-bottom: 20px;
                    line-height: 1.6;
                }

                .page9-pie-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 20px;
                    font-weight: bold;
                    color: #000000;
                    margin-bottom: 10px;
                    margin-top: 20px !important;
                    margin-left: 40% !important;
                }

                .page9-pie-container {
                    width: 100%;
                    max-width: 350px;
                    height: 300px;
                    margin-bottom: 20px;
                }

                .page9-legend {
                    font-family: 'Noto Sans', sans-serif;
                    padding-top: 10px;
                    margin-left: 300px;
                }

                .page9-legend-header {
                    font-weight: bold;
                    font-size: 20px;
                    margin-bottom: 8px;
                }

                .page9-legend-main {
                    font-weight: bold;
                    color: #245e7f;
                    font-size: 20px;
                    margin-bottom: 6px;
                }

                .page9-legend-sub {
                    margin-left: 25px;
                    color: #58585a;
                    font-size: 20px;
                    margin-bottom: 4px;
                    font-weight: bold;
                }

                .page9-legend-indirect {
                    font-weight: bold;
                    color: #245e7f;
                    font-size: 20px;
                    margin-top: 12px;
                }

                .page9-table-wrapper {
                    display: block;
                    width: 100%;
                    margin: 0;
                    margin-top: 20px;
                    position: relative;
                    z-index: 10;
                }

                .page9-table-wrapper details > summary {
                    display: block;
                    width: 100%;
                    padding: 12px 15px;
                    background-color: #26374a;
                    border: 1px solid #26374a;
                    color: #ffffff;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: bold;
                    box-sizing: border-box;
                    list-style: none;
                }

                .page9-table-wrapper details > summary::-webkit-details-marker {
                    display: none;
                }

                .page9-table-wrapper details > summary:hover {
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

                .table-responsive table th,
                .table-responsive table td {
                    white-space: nowrap;
                    padding: 8px 12px;
                    border: 1px solid #ddd;
                }

                details summary::-webkit-details-marker,
                details summary::marker {
                    display: none;
                }

                @media (max-width: 1280px) {
                    .page9-content-row {
                        flex-direction: column;
                    }
                    .page9-left-column,
                    .page9-right-column {
                        width: 100%;
                    }
                    .page9-right-column {
                        padding-left: 0;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        text-align: center;
                    }
                    
                    .page9-pie-container {
                        margin-left: -160px !important;
                        margin-right: auto !important;
                        margin-bottom: 0px !important;
                        margin-top: 0px !important;
                        max-width: 550px; /* Increased from 350px */
                        height: 350px;
                    }

                    .page9-pie-title {
                        margin-top: 100px !important;
                        margin-left: 0% !important;
                    }

                    .page9-legend {
                        text-align: center;
                        margin-left: 0px !important;
                        width: 100%;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                    }
                    
                    .page9-legend-sub {
                        margin-left: 0;
                    }
                    .page9-indigenous-bullet {
                        text-align: left;
                        align-self: center;
                        max-width: 600px;
                    }

                    .page9-map-container {
                        margin-left: -50% !important;
                    }

                    .page9-pie-container .js-plotly-plot .plotly .modebar {
                        right: -400px !important;
                    }

                    .page9-map-container .js-plotly-plot .plotly .modebar {
                        right: 30% !important;
                    }
                }

                @media (max-width: 768px) {
                    .page9-title {
                        font-size: 37px;
                    }
                    .page9-stats,
                    .page9-indigenous-bullet,
                    .page9-legend-header,
                    .page9-legend-main,
                    .page9-legend-sub,
                    .page9-legend-indirect {
                        font-size: 18px;
                    }
                    .page9-map-container {
                        min-width: 0;
                        height: 550px; /* Matches JS tablet height */
                    }

                    .page9-map-container .js-plotly-plot .plotly .modebar {
                        right: 25% !important;
                    }
                }

                @media (max-width: 640px) {
                    .page-9 { 
                        border-left: none !important; 
                        margin-left: 0;
                        width: 100%;
                        padding-left: 0;
                    }
                    .page9-map-container {
                        height: 550px; /* Matches JS tablet height (640 > 480) */
                    }
                }

                @media (max-width: 480px) {
                    .page9-map-container {
                        width: 140%;
                        margin-left: -15% !important;
                        height: 400px; /* Matches JS mobile height */
                    }
                    .page9-map-container .js-plotly-plot .plotly .modebar {
                        right: 15% !important;
                    }

                    .page9-pie-container .js-plotly-plot .plotly .modebar {
                        right: -350px !important;
                    }
                }                        

                @media (max-width: 384px) {
                    .page9-map-container {
                        margin-left: -25% !important;
                    }

                    .page9-map-container .js-plotly-plot .plotly .modebar {
                        right: 6.5% !important;
                    }

                    .page9-pie-container .js-plotly-plot .plotly .modebar {
                        right: -325px !important;
                    }
                }
            `}</style>

            <div className="page9-container">
                <header>
                    <h1 className="page9-title">
                        {getText('page9_title', lang)}
                    </h1>
                </header>

                <div className="page9-chart-frame">
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
                            <span>{year}</span>
                            <span aria-hidden="true" style={{ fontSize: '12px' }}>{isYearDropdownOpen ? '▲' : '▼'}</span>
                        </button>

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
                                {years.map((yr) => {
                                    const isSelected = year === yr;
                                    return (
                                        <button
                                            key={yr}
                                            type="button"
                                            aria-pressed={isSelected}
                                            aria-label={yr.toString()}
                                            onClick={() => {
                                                setYear(yr);
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
                                                {yr}
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

                    <div className="page9-content-row">
                        <div className="page9-left-column">
                            <div className="page9-stats">
                                <div className="page9-stats-line">
                                    {getText('page9_direct', lang)}: {formatNumber(employmentData.direct_total)} {getText('page9_jobs', lang)}
                                </div>
                                <div className="page9-stats-line">
                                    {getText('page9_indirect', lang)}: {formatNumber(employmentData.indirect_total)} {getText('page9_jobs', lang)}
                                </div>
                                <div className="page9-stats-line page9-stats-total">
                                    {getText('page9_total_label', lang)}: {formatNumber(employmentData.total)} {getText('page9_jobs', lang)}
                                </div>
                            </div>

                            <div className="page9-map-section-title">
                                {getText('page9_map_title', lang)}
                                <span id="fn-asterisk-rf-page9" style={{ verticalAlign: 'super', fontSize: '0.75em', lineHeight: '0' }}>
                                    <a href="#fn-asterisk-page9" onClick={scrollToFootnote} className="fn-lnk">
                                        <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span><span aria-hidden="true">*</span>
                                    </a>
                                </span>
                            </div>

                            <div 
                                role="region" 
                                aria-label={getMapSRSummary()}
                                tabIndex="0"
                            >
                                <figure ref={mapChartRef} className="page9-map-container" style={{ margin: 0, position: 'relative' }}>
                                    {selectedProvinces !== null && (
                                        <button onClick={() => setSelectedProvinces(null)} style={{ position: 'absolute', top: 0, right: 295, zIndex: 20 }}>{lang === 'en' ? 'Clear' : 'Effacer'}</button>
                                    )}
                                    <Plot
                                        key={`map-${selectedProvinces ? selectedProvinces.join('-') : 'none'}`}
                                        data={[
                                            {
                                                type: 'choropleth',
                                                locationmode: 'geojson-id',
                                                geojson: 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/canada.geojson',
                                                featureidkey: 'properties.name',
                                                locations: mapChartData.geoJsonNames,
                                                z: mapChartData.values,
                                                text: mapChartData.hoverTexts,
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
                                                lat: mapChartData.labelLats,
                                                lon: mapChartData.labelLons,
                                                text: provinceCodes.map((code, i) => {
                                                    const info = provinceInfo[code];
                                                    const abbrev = lang === 'en' ? info.abbrevEn : info.abbrevFr;
                                                    if (windowWidth <= 480) {
                                                        return `${abbrev}<br>${formatNumber(mapChartData.values[i])}`;
                                                    }
                                                    return `<b>${abbrev}</b><br><b>${formatNumber(mapChartData.values[i])}</b>`;
                                                }),
                                                textfont: {
                                                    family: 'Arial, sans-serif',
                                                    size: windowWidth <= 640 ? 12 : 14,
                                                    color: selectedProvinces === null 
                                                        ? '#000000' 
                                                        : provinceCodes.map((_, i) => selectedProvinces.includes(i) ? '#333333' : hexToRgba('#333333', 0.3))
                                                },
                                                hoverinfo: 'text',
                                                hovertext: mapChartData.hoverTexts,
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
                                            height: mapHeight,
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
                                                    return;
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
                                                click: (gd) => downloadMapWithTitle(gd)
                                            }]
                                        }}
                                        style={{ width: '100%', height: '100%' }}
                                    />
                                </figure>
                            </div>
                        </div>

                        <div className="page9-right-column">
                            <ul className="page9-indigenous-bullet" style={{ listStyle: 'disc', paddingLeft: '20px', margin: 0 }}>
                                <li aria-label={lang === 'en' 
                                    ? `About ${formatNumber(employmentData.indigenous_employed)} Indigenous people were directly employed in the energy sector in 2023.`
                                    : `Le secteur de l'énergie employait directement environ ${formatNumber(employmentData.indigenous_employed)} Autochtones en 2023.`
                                }>
                                    <span aria-hidden="true">
                                        {getText('page9_indigenous_bullet', lang).replace('18,200', formatNumber(employmentData.indigenous_employed)).replace('18 200', formatNumber(employmentData.indigenous_employed))}
                                    </span>
                                </li>
                            </ul>

                            <div className="page9-pie-title">
                                {lang === 'en' 
                                    ? `Share of total employment, ${year}`
                                    : `Pourcentage du total des emplois, ${year}`
                                }
                            </div>

                            <div 
                                role="region" 
                                aria-label={getPieSRSummary()}
                                tabIndex="0"
                            >
                                <figure ref={pieChartRef} className="page9-pie-container" style={{ marginLeft: 'auto', marginRight: 0}}>
                                    <Plot
                                        data={pieChartData}
                                        layout={{
                                            autosize: true,
                                            clickmode: 'event',
                                            dragmode: false,
                                            showlegend: false,
                                            margin: { t: 30, r: 80, b: 30, l: 30 },
                                            paper_bgcolor: 'rgba(0,0,0,0)',
                                            plot_bgcolor: 'rgba(0,0,0,0)',
                                        }}
                                        config={{
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
                                                click: () => downloadPieWithTitle()
                                            }]
                                        }}
                                        style={{ width: '100%', height: '100%' }}
                                    />
                                </figure>
                            </div>

                            <aside 
                                className="page9-legend"
                                role="region"
                                aria-label={getLegendText()}
                            >
                                <div aria-hidden="true">
                                    <div className="page9-legend-header">
                                        {getText('page9_total_employment', lang)}
                                    </div>
                                    
                                    <div className="page9-legend-main">
                                        {getText('page9_energy_direct_label', lang)} {formatPercent(employmentData.energy_direct_pct)}
                                    </div>
                                    <div className="page9-legend-sub">
                                        {getText('page9_petroleum', lang)} {formatPercent(employmentData.petroleum_pct)}
                                    </div>
                                    <div className="page9-legend-sub">
                                        {getText('page9_electricity', lang)} {formatPercent(employmentData.electricity_pct)}
                                    </div>
                                    <div className="page9-legend-sub">
                                        {getText('page9_other', lang)} {formatPercent(employmentData.other_pct)}
                                    </div>
                                    
                                    <div className="page9-legend-indirect">
                                        {getText('page9_energy_indirect_label', lang)} {formatPercent(employmentData.energy_indirect_pct)}
                                    </div>
                                </div>
                            </aside>
                        </div>
                    </div>

                    <div className="page9-table-wrapper">
                        <details 
                            className="page9-data-table"
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
                                            ? 'Energy sector direct employment by province/territory, 2009-2024'
                                            : "Emplois directs du secteur de l'énergie par province/territoire, 2009-2024"
                                        }
                                    </caption>
                                    <thead>
                                        <tr>
                                            <td style={{ borderBottom: 'none' }} aria-hidden="true"></td>
                                            <th scope="colgroup" colSpan={yearlyProvinceData.length} style={{ textAlign: 'center', borderBottom: 'none' }}>
                                                <span aria-hidden="true">{lang === 'en' ? '(jobs)' : '(emplois)'}</span>
                                                <span className="wb-inv">{lang === 'en' ? '(number of jobs)' : "(nombre d'emplois)"}</span>
                                            </th>
                                        </tr>
                                        <tr>
                                            <th scope="col" style={{ fontWeight: 'bold', borderTop: 'none' }}>
                                                {lang === 'en' ? 'Province/Territory' : 'Province/Territoire'}
                                            </th>
                                            {yearlyProvinceData.map(yearData => (
                                                <th key={yearData.year} scope="col" style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                                    {yearData.year}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {provinceCodes.map((code) => {
                                            const info = provinceInfo[code];
                                            const name = lang === 'en' ? info.nameEn : info.nameFr;
                                            const cellUnitSR = lang === 'en' ? ' jobs' : ' emplois';
                                            return (
                                                <tr key={code}>
                                                    <th scope="row" style={{ fontWeight: 'bold' }}>{name}</th>
                                                    {yearlyProvinceData.map(yearData => (
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
                                            <th scope="row">{lang === 'en' ? 'Canada Total (Direct)' : 'Total Canada (direct)'}</th>
                                            {yearlyProvinceData.map(yearData => {
                                                const totalLabel = lang === 'en' ? 'Canada Total (Direct)' : 'Total Canada (direct)';
                                                const cellUnitSR = lang === 'en' ? ' jobs' : ' emplois';
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
                                        <tr style={{ fontWeight: 'bold', backgroundColor: '#e8e8e8' }}>
                                            <th scope="row">{lang === 'en' ? 'Share of total employment (Direct)' : "Part de l'emploi total (direct)"}</th>
                                            {yearlyProvinceData.map(yearData => (
                                                <td 
                                                    key={yearData.year} 
                                                    style={{ textAlign: 'right' }}
                                                    aria-label={`${lang === 'en' ? 'Share of total employment (Direct)' : "Part de l'emploi total (direct)"}, ${yearData.year}: ${employmentData.energy_direct_pct}%`}
                                                >
                                                    {employmentData.energy_direct_pct}%
                                                </td>
                                            ))}
                                        </tr>
                                        <tr style={{ fontWeight: 'bold', backgroundColor: '#e8e8e8' }}>
                                            <th scope="row">{lang === 'en' ? 'Share of total employment (Indirect)' : "Part de l'emploi total (indirect)"}</th>
                                            {yearlyProvinceData.map(yearData => (
                                                <td 
                                                    key={yearData.year} 
                                                    style={{ textAlign: 'right' }}
                                                    aria-label={`${lang === 'en' ? 'Share of total employment (Indirect)' : "Part de l'emploi total (indirect)"}, ${yearData.year}: ${employmentData.energy_indirect_pct}%`}
                                                >
                                                    {employmentData.energy_indirect_pct}%
                                                </td>
                                            ))}
                                        </tr>
                                        <tr style={{ fontWeight: 'bold', backgroundColor: '#d8d8d8' }}>
                                            <th scope="row">{lang === 'en' ? 'Share of total employment (Total)' : "Part de l'emploi total (total)"}</th>
                                            {yearlyProvinceData.map(yearData => (
                                                <td 
                                                    key={yearData.year} 
                                                    style={{ textAlign: 'right' }}
                                                    aria-label={`${lang === 'en' ? 'Share of total employment (Total)' : "Part de l'emploi total (total)"}, ${yearData.year}: ${employmentData.share_total_pct}%`}
                                                >
                                                    {employmentData.share_total_pct}%
                                                </td>
                                            ))}
                                        </tr>
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
                    </div>
                </div>

                <aside className="wb-fnote" role="note">
                    <h2 id="fn">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt>{lang === 'en' ? 'Footnote *' : 'Note de bas de page *'}</dt>
                        <dd id="fn-asterisk-page9">
                            <a href="#fn-asterisk-rf-page9" onClick={scrollToRef} className="fn-num" title={lang === 'en' ? 'Return to footnote * referrer' : 'Retour à la référence de la note de bas de page *'}>
                                <span className="wb-inv">{lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}</span>*
                            </a>
                            <p>
                                {getText('page9_footnote', lang)}
                            </p>
                        </dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default Page9;
