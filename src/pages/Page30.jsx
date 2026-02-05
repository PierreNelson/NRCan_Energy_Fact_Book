import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
const Page30 = () => {
    const { lang, layoutPadding } = useOutletContext();
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [mapData, setMapData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isTableOpen, setIsTableOpen] = useState(false);
    const [isChartInteractive, setIsChartInteractive] = useState(typeof window !== 'undefined' ? window.innerWidth > 768 : true);
    const [selectedProvinces, setSelectedProvinces] = useState(null);
    const chartRef = useRef(null);
    const lastClickRef = useRef({ time: 0, index: null });

    const [sortColumn, setSortColumn] = useState('project_name');
    const [sortDirection, setSortDirection] = useState('asc');
    const [projectFilter, setProjectFilter] = useState([]);
    const [companyFilter, setCompanyFilter] = useState([]);
    const [provinceFilter, setProvinceFilter] = useState([]);
    const [typeFilter, setTypeFilter] = useState([]);
    const [locationFilter, setLocationFilter] = useState([]);
    const [capitalCostFilter, setCapitalCostFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [cleanTechFilter, setCleanTechFilter] = useState('all');
    const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
    const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
    const [provinceDropdownOpen, setProvinceDropdownOpen] = useState(false);
    const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
    const [locationDropdownOpen, setLocationDropdownOpen] = useState(false);
    const projectDropdownRef = useRef(null);
    const companyDropdownRef = useRef(null);
    const provinceDropdownRef = useRef(null);
    const typeDropdownRef = useRef(null);
    const locationDropdownRef = useRef(null);
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

    const hexToRgba = (hex, opacity = 1) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
        }
        return hex;
    };

    const provinceInfo = {
        'nl': { nameEn: 'Newfoundland and Labrador', nameFr: 'Terre-Neuve-et-Labrador', geoJsonName: 'Newfoundland and Labrador' },
        'pe': { nameEn: 'Prince Edward Island', nameFr: 'Île-du-Prince-Édouard', geoJsonName: 'Prince Edward Island' },
        'ns': { nameEn: 'Nova Scotia', nameFr: 'Nouvelle-Écosse', geoJsonName: 'Nova Scotia' },
        'nb': { nameEn: 'New Brunswick', nameFr: 'Nouveau-Brunswick', geoJsonName: 'New Brunswick' },
        'qc': { nameEn: 'Quebec', nameFr: 'Québec', geoJsonName: 'Quebec' },
        'on': { nameEn: 'Ontario', nameFr: 'Ontario', geoJsonName: 'Ontario' },
        'mb': { nameEn: 'Manitoba', nameFr: 'Manitoba', geoJsonName: 'Manitoba' },
        'sk': { nameEn: 'Saskatchewan', nameFr: 'Saskatchewan', geoJsonName: 'Saskatchewan' },
        'ab': { nameEn: 'Alberta', nameFr: 'Alberta', geoJsonName: 'Alberta' },
        'bc': { nameEn: 'British Columbia', nameFr: 'Colombie-Britannique', geoJsonName: 'British Columbia' },
        'yt': { nameEn: 'Yukon', nameFr: 'Yukon', geoJsonName: 'Yukon Territory' },
        'nt': { nameEn: 'Northwest Territories', nameFr: 'Territoires du Nord-Ouest', geoJsonName: 'Northwest Territories' },
        'nu': { nameEn: 'Nunavut', nameFr: 'Nunavut', geoJsonName: 'Nunavut' },
    };

    const provinceCodes = ['bc', 'ab', 'sk', 'mb', 'on', 'qc', 'nb', 'ns', 'pe', 'nl', 'yt', 'nt', 'nu'];

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
            if (projectDropdownRef.current && !projectDropdownRef.current.contains(event.target)) {
                setProjectDropdownOpen(false);
            }
            if (companyDropdownRef.current && !companyDropdownRef.current.contains(event.target)) {
                setCompanyDropdownOpen(false);
            }
            if (provinceDropdownRef.current && !provinceDropdownRef.current.contains(event.target)) {
                setProvinceDropdownOpen(false);
            }
            if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target)) {
                setTypeDropdownOpen(false);
            }
            if (locationDropdownRef.current && !locationDropdownRef.current.contains(event.target)) {
                setLocationDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isChartInteractive, windowWidth]);

    const toggleProjectFilter = (project) => {
        setProjectFilter(prev => 
            prev.includes(project) 
                ? prev.filter(p => p !== project)
                : [...prev, project]
        );
    };

    const toggleCompanyFilter = (company) => {
        setCompanyFilter(prev => 
            prev.includes(company) 
                ? prev.filter(c => c !== company)
                : [...prev, company]
        );
    };

    const toggleProvinceFilter = (province) => {
        setProvinceFilter(prev => 
            prev.includes(province) 
                ? prev.filter(p => p !== province)
                : [...prev, province]
        );
    };

    const toggleTypeFilter = (type) => {
        setTypeFilter(prev => 
            prev.includes(type) 
                ? prev.filter(t => t !== type)
                : [...prev, type]
        );
    };

    const toggleLocationFilter = (location) => {
        setLocationFilter(prev => 
            prev.includes(location) 
                ? prev.filter(l => l !== location)
                : [...prev, location]
        );
    };

    useEffect(() => {
        fetch(`${import.meta.env.BASE_URL}data/major_projects_map.csv`)
            .then(response => {
                if (!response.ok) throw new Error('Failed to load map data');
                return response.text();
            })
            .then(csvText => {
                const lines = csvText.split('\n');
                const headers = lines[0].split(',').map(h => h.trim());
                
                const parseCSVRow = (row) => {
                    const values = [];
                    let current = '';
                    let inQuotes = false;
                    for (let i = 0; i < row.length; i++) {
                        const char = row[i];
                        if (char === '"') {
                            if (inQuotes && row[i + 1] === '"') {
                                current += '"';
                                i++;
                            } else {
                                inQuotes = !inQuotes;
                            }
                        } else if (char === ',' && !inQuotes) {
                            values.push(current.trim());
                            current = '';
                        } else {
                            current += char;
                        }
                    }
                    values.push(current.trim());
                    return values;
                };
                
                const data = { en: { points: [], lines: [] }, fr: { points: [], lines: [] } };
                
                for (let i = 1; i < lines.length; i++) {
                    if (!lines[i].trim()) continue;
                    const values = parseCSVRow(lines[i]);
                    const row = {};
                    headers.forEach((header, idx) => {
                        row[header] = values[idx] || '';
                    });
                    
                    const langKey = row.lang === 'fr' ? 'fr' : 'en';
                    
                    if (row.type === 'line') {
                        const lineObj = {
                            id: row.id,
                            company: row.company,
                            project_name: row.project_name,
                            province: row.province,
                            location: row.location,
                            capital_cost: row.capital_cost,
                            capital_cost_range: row.capital_cost_range,
                            status: row.status,
                            clean_technology: row.clean_technology,
                            clean_technology_type: row.clean_technology_type,
                            line_type: row.line_type,
                            paths: row.paths ? JSON.parse(row.paths) : [],
                            type: 'line'
                        };
                        data[langKey].lines.push(lineObj);
                    } else {
                        const pointObj = {
                            id: row.id,
                            company: row.company,
                            project_name: row.project_name,
                            province: row.province,
                            location: row.location,
                            capital_cost: row.capital_cost,
                            capital_cost_range: row.capital_cost_range,
                            status: row.status,
                            clean_technology: row.clean_technology,
                            clean_technology_type: row.clean_technology_type,
                            lat: parseFloat(row.lat) || 0,
                            lon: parseFloat(row.lon) || 0,
                            type: 'point'
                        };
                        data[langKey].points.push(pointObj);
                    }
                }
                
                setMapData(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error loading map data:', err);
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
    }, [mapData, lang]);

    const downloadChartWithTitle = async () => {
        const plotElement = chartRef.current?.querySelector('.js-plotly-plot');
        if (!plotElement) {
            alert('Could not find chart element. Please try again.');
            return;
        }

        const title = stripHtml(`${getText('page30_title', lang)} - ${getText('page30_subtitle', lang)}`);

        try {
            if (!window.Plotly) {
                alert('Plotly library not loaded. Please refresh the page and try again.');
                return;
            }

            const imgData = await window.Plotly.toImage(plotElement, {
                format: 'png',
                width: 1400,
                height: 900,
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
                link.download = lang === 'en' ? 'major_energy_projects_map.png' : 'carte_grands_projets_energetiques.png';
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

    const langData = useMemo(() => {
        if (!mapData) return null;
        return mapData[lang] || mapData.en || mapData;
    }, [mapData, lang]);

    const tableData = useMemo(() => {
        if (!langData) return [];
        const allProjects = [
            ...(langData.points || []),
            ...(langData.lines || [])
        ];
        return allProjects.filter(project => 
            project.project_name && project.project_name.trim() !== ''
        );
    }, [langData]);

    const uniqueProjects = useMemo(() => {
        if (!tableData || tableData.length === 0) return [];
        const projects = [...new Set(tableData.map(p => p.project_name).filter(p => p && p.trim()))];
        return projects.sort((a, b) => a.localeCompare(b));
    }, [tableData]);

    const uniqueCompanies = useMemo(() => {
        if (!tableData || tableData.length === 0) return [];
        const companies = [...new Set(tableData.map(p => p.company).filter(c => c && c.trim()))];
        return companies.sort((a, b) => a.localeCompare(b));
    }, [tableData]);

    const uniqueProvinces = useMemo(() => {
        if (!tableData || tableData.length === 0) return [];
        const provinces = [...new Set(tableData.map(p => p.province).filter(p => 
            p && p.trim() && p.toLowerCase() !== 'multiple' && p.toLowerCase() !== 'multiples'
        ))];
        return provinces.sort((a, b) => a.localeCompare(b));
    }, [tableData]);

    const uniqueTypes = useMemo(() => {
        if (!tableData || tableData.length === 0) return [];
        const types = [...new Set(tableData.map(p => p.clean_technology_type).filter(t => t && t.trim()))];
        return types.sort((a, b) => a.localeCompare(b));
    }, [tableData]);

    const uniqueLocations = useMemo(() => {
        if (!tableData || tableData.length === 0) return [];
        const locations = [...new Set(tableData.map(p => p.location).filter(l => l && l.trim()))];
        return locations.sort((a, b) => a.localeCompare(b));
    }, [tableData]);

    const filteredTableData = useMemo(() => {
        let filtered = [...tableData];

        if (selectedProvinces !== null && selectedProvinces.length > 0) {
            const selectedProvNames = selectedProvinces.map(idx => {
                const code = provinceCodes[idx];
                const info = provinceInfo[code];
                return lang === 'en' ? info.nameEn : info.nameFr;
            });
            filtered = filtered.filter(project => {
                const projectProvince = project.province || '';
                return selectedProvNames.some(name => 
                    projectProvince.toLowerCase().includes(name.toLowerCase()) ||
                    name.toLowerCase().includes(projectProvince.toLowerCase())
                );
            });
        }

        if (projectFilter.length > 0) {
            filtered = filtered.filter(project => 
                projectFilter.includes(project.project_name)
            );
        }

        if (companyFilter.length > 0) {
            filtered = filtered.filter(project => 
                companyFilter.includes(project.company)
            );
        }

        if (provinceFilter.length > 0) {
            filtered = filtered.filter(project => 
                provinceFilter.includes(project.province)
            );
        }

        if (typeFilter.length > 0) {
            filtered = filtered.filter(project => 
                typeFilter.includes(project.clean_technology_type)
            );
        }

        if (locationFilter.length > 0) {
            filtered = filtered.filter(project => 
                locationFilter.includes(project.location)
            );
        }

        if (capitalCostFilter !== 'all') {
            filtered = filtered.filter(project => {
                const cost = parseFloat((project.capital_cost || '0').replace(/[^0-9.-]/g, '')) || 0;
                if (capitalCostFilter === '10_999') {
                    return cost >= 10 && cost < 1000;
                } else if (capitalCostFilter === '1000_5000') {
                    return cost >= 1000 && cost <= 5000;
                } else if (capitalCostFilter === '5000_plus') {
                    return cost > 5000;
                }
                return true;
            });
        }

        if (statusFilter !== 'all') {
            filtered = filtered.filter(project => {
                const status = (project.status || '').toLowerCase();
                if (statusFilter === 'planned') {
                    return status.includes('planned') || status.includes('prévu');
                } else if (statusFilter === 'under_construction') {
                    return status.includes('construction') || status.includes('en construction');
                }
                return true;
            });
        }

        if (cleanTechFilter !== 'all') {
            filtered = filtered.filter(project => {
                const cleanTech = (project.clean_technology || '').toLowerCase();
                if (cleanTechFilter === 'yes') {
                    return cleanTech === 'yes' || cleanTech === 'oui';
                } else if (cleanTechFilter === 'no') {
                    return cleanTech === 'no' || cleanTech === 'non' || cleanTech === '';
                }
                return true;
            });
        }

        filtered.sort((a, b) => {
            let valA, valB;
            
            if (sortColumn === 'capital_cost') {
                valA = parseFloat((a.capital_cost || '0').replace(/[^0-9.-]/g, '')) || 0;
                valB = parseFloat((b.capital_cost || '0').replace(/[^0-9.-]/g, '')) || 0;
            } else {
                valA = (a[sortColumn] || '').toLowerCase();
                valB = (b[sortColumn] || '').toLowerCase();
            }

            if (sortColumn === 'capital_cost') {
                return sortDirection === 'asc' ? valA - valB : valB - valA;
            } else {
                const comparison = valA.localeCompare(valB);
                return sortDirection === 'asc' ? comparison : -comparison;
            }
        });

        return filtered;
    }, [tableData, selectedProvinces, lang, projectFilter, companyFilter, provinceFilter, typeFilter, locationFilter, capitalCostFilter, statusFilter, cleanTechFilter, sortColumn, sortDirection]);

    const applyFiltersToData = (data) => {
        if (!data || data.length === 0) return [];
        let filtered = [...data];

        if (projectFilter.length > 0) {
            filtered = filtered.filter(project => 
                projectFilter.includes(project.project_name)
            );
        }

        if (companyFilter.length > 0) {
            filtered = filtered.filter(project => 
                companyFilter.includes(project.company)
            );
        }

        if (provinceFilter.length > 0) {
            filtered = filtered.filter(project => 
                provinceFilter.includes(project.province)
            );
        }

        if (typeFilter.length > 0) {
            filtered = filtered.filter(project => 
                typeFilter.includes(project.clean_technology_type)
            );
        }

        if (locationFilter.length > 0) {
            filtered = filtered.filter(project => 
                locationFilter.includes(project.location)
            );
        }

        if (capitalCostFilter !== 'all') {
            filtered = filtered.filter(project => {
                const cost = parseFloat((project.capital_cost || '0').replace(/[^0-9.-]/g, '')) || 0;
                if (capitalCostFilter === '10_999') {
                    return cost >= 10 && cost < 1000;
                } else if (capitalCostFilter === '1000_5000') {
                    return cost >= 1000 && cost <= 5000;
                } else if (capitalCostFilter === '5000_plus') {
                    return cost > 5000;
                }
                return true;
            });
        }

        if (statusFilter !== 'all') {
            filtered = filtered.filter(project => {
                const status = (project.status || '').toLowerCase();
                if (statusFilter === 'planned') {
                    return status.includes('planned') || status.includes('prévu');
                } else if (statusFilter === 'under_construction') {
                    return status.includes('construction') || status.includes('en construction');
                }
                return true;
            });
        }

        if (cleanTechFilter !== 'all') {
            filtered = filtered.filter(project => {
                const cleanTech = (project.clean_technology || '').toLowerCase();
                if (cleanTechFilter === 'yes') {
                    return cleanTech === 'yes' || cleanTech === 'oui';
                } else if (cleanTechFilter === 'no') {
                    return cleanTech === 'no' || cleanTech === 'non' || cleanTech === '';
                }
                return true;
            });
        }

        return filtered;
    };

    const filteredMapPoints = useMemo(() => {
        if (!langData || !langData.points) return [];
        return applyFiltersToData(langData.points);
    }, [langData, projectFilter, companyFilter, provinceFilter, typeFilter, locationFilter, capitalCostFilter, statusFilter, cleanTechFilter]);

    const filteredMapLines = useMemo(() => {
        if (!langData || !langData.lines) return [];
        return applyFiltersToData(langData.lines);
    }, [langData, projectFilter, companyFilter, provinceFilter, typeFilter, locationFilter, capitalCostFilter, statusFilter, cleanTechFilter]);

    const handleSort = (column) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const clearAllFilters = () => {
        setProjectFilter([]);
        setCompanyFilter([]);
        setProvinceFilter([]);
        setTypeFilter([]);
        setLocationFilter([]);
        setCapitalCostFilter('all');
        setStatusFilter('all');
        setCleanTechFilter('all');
        setSortColumn('project_name');
        setSortDirection('asc');
    };

    const downloadTableAsCSV = () => {
        if (!filteredTableData || filteredTableData.length === 0) return;

        const headers = lang === 'en' 
            ? ['Project Name', 'Company', 'Province', 'Location', 'Capital Cost ($M)', 'Status', 'Clean Technology', 'Type']
            : ['Nom du projet', 'Entreprise', 'Province', 'Emplacement', 'Coût en capital (M$)', 'Statut', 'Technologie propre', 'Type'];

        const rows = filteredTableData.map(project => [
            `"${(project.project_name || '').replace(/"/g, '""')}"`,
            `"${(project.company || '').replace(/"/g, '""')}"`,
            `"${(project.province || '').replace(/"/g, '""')}"`,
            `"${(project.location || '').replace(/"/g, '""')}"`,
            project.capital_cost || '',
            `"${(project.status || '').replace(/"/g, '""')}"`,
            project.clean_technology || '',
            project.type === 'line' ? (lang === 'en' ? 'Transmission Line' : 'Ligne de transmission') : (lang === 'en' ? 'Project' : 'Projet')
        ]);

        const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = lang === 'en' ? 'major_energy_projects.csv' : 'grands_projets_energetiques.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const downloadTableAsDocx = async () => {
        if (!filteredTableData || filteredTableData.length === 0) return;

        const title = stripHtml(`${getText('page30_title', lang)} - ${getText('page30_subtitle', lang)}`);

        const headers = lang === 'en' 
            ? ['Project Name', 'Company', 'Province', 'Capital Cost ($M)', 'Status', 'Clean Tech']
            : ['Nom du projet', 'Entreprise', 'Province', 'Coût (M$)', 'Statut', 'Tech. propre'];

        const headerRow = new TableRow({
            children: headers.map(header => new TableCell({
                children: [new Paragraph({
                    children: [new TextRun({ text: header, bold: true, size: 20 })],
                    alignment: AlignmentType.CENTER
                })],
                shading: { fill: 'E6E6E6' }
            }))
        });

        const dataRows = filteredTableData.map(project => new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: project.project_name || '', size: 18 })], alignment: AlignmentType.LEFT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: project.company || '', size: 18 })], alignment: AlignmentType.LEFT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: project.province || '', size: 18 })], alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: project.capital_cost || '', size: 18 })], alignment: AlignmentType.RIGHT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: project.status || '', size: 18 })], alignment: AlignmentType.CENTER })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: project.clean_technology || '', size: 18 })], alignment: AlignmentType.CENTER })] })
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
                        columnWidths: [2500, 2000, 1500, 1200, 1400, 1000],
                        rows: [headerRow, ...dataRows]
                    })
                ]
            }]
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'major_energy_projects.docx' : 'grands_projets_energetiques.docx');
    };

    const getMarkerSize = (costRange) => {
        if (!costRange) return 8;
        if (costRange.includes('10,000')) return 18;
        if (costRange.includes('5,000 - 10,000')) return 16;
        if (costRange.includes('2,500 - 5,000')) return 14;
        if (costRange.includes('1,000 - 2,500')) return 12;
        if (costRange.includes('750 - 1,000')) return 10;
        if (costRange.includes('500 - 750')) return 9;
        if (costRange.includes('250 - 500')) return 8;
        if (costRange.includes('100 - 250')) return 7;
        if (costRange.includes('50 - 100')) return 6;
        return 5;
    };

    const getMarkerProps = (project, isSelected = true) => {
        const isClean = project.clean_technology === 'Yes' || project.clean_technology === 'Oui';
        const isConstruction = project.status === 'Under Construction' || project.status === 'En construction';
        const size = getMarkerSize(project.capital_cost_range);
        const opacity = isSelected ? 1 : 0.3;
        
        const plannedColor = '#4196F6';
        const constructionColor = '#20B2AA';
        const color = isConstruction ? constructionColor : plannedColor;
        
        if (isClean) {
            return {
                symbol: 'triangle-down',
                color: hexToRgba(color, opacity),
                size: size,
                line: { color: hexToRgba(color, opacity), width: 1 }
            };
        } else {
            return {
                symbol: 'triangle-up',
                color: hexToRgba(color, opacity),
                size: size,
                line: { color: hexToRgba(color, opacity), width: 1 }
            };
        }
    };

    const getLineColor = (line, isSelected = true) => {
        const isClean = line.clean_technology === 'Yes' || line.clean_technology === 'Oui';
        const isConstruction = line.status === 'Under Construction' || line.status === 'En construction';
        const opacity = isSelected ? 1 : 0.3;
        const color = isClean 
            ? (isConstruction ? '#71a210' : '#a3f900')
            : (isConstruction ? '#B684B6' : '#FE3ED8');
        return hexToRgba(color, opacity);
    };

    const formatHoverText = (project, language) => {
        const costDisplay = project.capital_cost ? `$${project.capital_cost}M` : 'N/A';
        
        if (language === 'fr') {
            return `<b>${project.project_name}</b><br>` +
                   `<b>Entreprise :</b> ${project.company || 'N/D'}<br>` +
                   `<b>Province :</b> ${project.province || 'N/D'}<br>` +
                   `<b>Emplacement :</b> ${project.location || 'N/D'}<br>` +
                   `<b>Coût en capital :</b> ${costDisplay}<br>` +
                   `<b>Statut :</b> ${project.status || 'N/D'}<br>` +
                   `<b>Technologie propre :</b> ${project.clean_technology || 'N/D'}` +
                   (project.clean_technology === 'Oui' && project.clean_technology_type ? 
                       `<br><b>Type :</b> ${project.clean_technology_type}` : '');
        }
        
        return `<b>${project.project_name}</b><br>` +
               `<b>Company:</b> ${project.company || 'N/A'}<br>` +
               `<b>Province:</b> ${project.province || 'N/A'}<br>` +
               `<b>Location:</b> ${project.location || 'N/A'}<br>` +
               `<b>Capital cost:</b> ${costDisplay}<br>` +
               `<b>Status:</b> ${project.status || 'N/A'}<br>` +
               `<b>Clean technology:</b> ${project.clean_technology || 'N/A'}` +
               (project.clean_technology === 'Yes' && project.clean_technology_type ? 
                   `<br><b>Type:</b> ${project.clean_technology_type}` : '');
    };

    const isProjectInSelectedProvince = (project) => {
        if (selectedProvinces === null) return true;
        const projectProvince = (project.province || '').toLowerCase();
        return selectedProvinces.some(idx => {
            const code = provinceCodes[idx];
            const info = provinceInfo[code];
            const enName = info.nameEn.toLowerCase();
            const frName = info.nameFr.toLowerCase();
            return projectProvince.includes(enName) || enName.includes(projectProvince) ||
                   projectProvince.includes(frName) || frName.includes(projectProvince);
        });
    };

    const plotlyData = useMemo(() => {
        if (!langData) return [];
        
        const traces = [];
        
        const geoJsonNames = provinceCodes.map(code => provinceInfo[code].geoJsonName);
        const provinceColors = provinceCodes.map((_, idx) => {
            if (selectedProvinces === null) return '#474747';
            return selectedProvinces.includes(idx) ? '#474747' : hexToRgba('#474747', 0.3);
        });

        const choroplethTrace = {
            type: 'choropleth',
            locationmode: 'geojson-id',
            geojson: 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/canada.geojson',
            featureidkey: 'properties.name',
            locations: geoJsonNames,
            z: provinceCodes.map((_, idx) => idx),
            text: provinceCodes.map(code => {
                const info = provinceInfo[code];
                return lang === 'en' ? info.nameEn : info.nameFr;
            }),
            hoverinfo: 'text',
            hoverlabel: {
                bgcolor: '#ffffff',
                bordercolor: '#000000',
                font: { color: '#000000', size: 12, family: 'Arial, sans-serif' }
            },
            colorscale: provinceColors.map((color, idx) => [idx / (provinceColors.length - 1), color]),
            showscale: false,
            marker: { line: { color: 'white', width: 1 } },
            selectedpoints: selectedProvinces,
            selected: { marker: { opacity: 1 } },
            unselected: { marker: { opacity: 0.3 } }
        };
        traces.push(choroplethTrace);
        
        const isCleanTech = (project) => {
            return project.clean_technology === 'Yes' || project.clean_technology === 'Oui';
        };
        
        const isUnderConstruction = (project) => {
            return project.status === 'Under Construction' || project.status === 'En construction';
        };
        
        if (filteredMapLines && filteredMapLines.length > 0) {
            filteredMapLines.forEach((line, idx) => {
                if (line.paths && line.paths.length > 0) {
                    const isSelected = isProjectInSelectedProvince(line);
                    line.paths.forEach((path, pathIdx) => {
                        const lats = path.map(p => p.lat);
                        const lons = path.map(p => p.lon);
                        
                        traces.push({
                            type: 'scattergeo',
                            mode: 'lines',
                            lat: lats,
                            lon: lons,
                            line: {
                                color: getLineColor(line, isSelected),
                                width: 3
                            },
                            hoverinfo: 'text',
                            hovertext: formatHoverText(line, lang),
                            hoverlabel: {
                                bgcolor: '#ffffff',
                                bordercolor: '#333333',
                                font: { color: '#000000', size: 12, family: 'Arial, sans-serif' }
                            },
                            showlegend: false,
                            name: `line-${idx}-${pathIdx}`
                        });
                    });
                }
            });
        }
        
        if (filteredMapPoints && filteredMapPoints.length > 0) {
            const cleanConstruction = filteredMapPoints.filter(p => isCleanTech(p) && isUnderConstruction(p));
            const cleanPlanned = filteredMapPoints.filter(p => isCleanTech(p) && !isUnderConstruction(p));
            const regularConstruction = filteredMapPoints.filter(p => !isCleanTech(p) && isUnderConstruction(p));
            const regularPlanned = filteredMapPoints.filter(p => !isCleanTech(p) && !isUnderConstruction(p));
            
            const createPointTrace = (points, name) => {
                if (points.length === 0) return null;
                
                return {
                    type: 'scattergeo',
                    mode: 'markers',
                    lat: points.map(p => p.lat),
                    lon: points.map(p => p.lon),
                    marker: {
                        size: points.map(p => getMarkerProps(p, isProjectInSelectedProvince(p)).size),
                        color: points.map(p => getMarkerProps(p, isProjectInSelectedProvince(p)).color),
                        symbol: points.map(p => getMarkerProps(p, isProjectInSelectedProvince(p)).symbol),
                        line: {
                            color: points.map(p => getMarkerProps(p, isProjectInSelectedProvince(p)).line.color),
                            width: points.map(p => getMarkerProps(p, isProjectInSelectedProvince(p)).line.width)
                        }
                    },
                    hoverinfo: 'text',
                    hovertext: points.map(p => formatHoverText(p, lang)),
                    hoverlabel: {
                        bgcolor: '#ffffff',
                        bordercolor: '#333333',
                        font: { color: '#000000', size: 12, family: 'Arial, sans-serif' }
                    },
                    showlegend: false,
                    name: name
                };
            };
            
            const regularConstructionTrace = createPointTrace(regularConstruction, 'energy-construction');
            const regularPlannedTrace = createPointTrace(regularPlanned, 'energy-planned');
            const cleanConstructionTrace = createPointTrace(cleanConstruction, 'clean-construction');
            const cleanPlannedTrace = createPointTrace(cleanPlanned, 'clean-planned');
            
            if (regularPlannedTrace) traces.push(regularPlannedTrace);
            if (regularConstructionTrace) traces.push(regularConstructionTrace);
            if (cleanPlannedTrace) traces.push(cleanPlannedTrace);
            if (cleanConstructionTrace) traces.push(cleanConstructionTrace);
        }
        
        return traces;
    }, [langData, lang, selectedProvinces, filteredMapPoints, filteredMapLines]);

    const handleMapClick = (data) => {
        if (!data.points || data.points.length === 0) return;
        
        const clickedPoint = data.points[0];
        if (clickedPoint.curveNumber !== 0) return;
        
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
    };

    const mapScale = 2.5;
    const mapHeight = windowWidth <= 768 ? 500 : windowWidth <= 1100 ? 600 : 700;

    const LegendItem = ({ color, symbol, label, isLine, isOutline, size = 'medium' }) => {
        const sizeMap = { small: 8, medium: 12, large: 16 };
        const triangleSize = sizeMap[size] || 12;
        
        return (
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '3px', fontSize: windowWidth <= 768 ? '10px' : '11px' }}>
                {isLine ? (
                    <div style={{ 
                        width: '24px', 
                        height: '3px', 
                        backgroundColor: color,
                        marginRight: '6px',
                        flexShrink: 0
                    }} />
                ) : (
                    <div style={{ 
                        width: '0', 
                        height: '0', 
                        borderLeft: `${triangleSize/2}px solid transparent`,
                        borderRight: `${triangleSize/2}px solid transparent`,
                        borderBottom: symbol === 'up' ? `${triangleSize}px solid ${isOutline ? 'transparent' : color}` : 'none',
                        borderTop: symbol === 'down' ? `${triangleSize}px solid ${isOutline ? 'transparent' : color}` : 'none',
                        marginRight: '6px',
                        flexShrink: 0,
                        ...(isOutline && {
                            borderBottomColor: symbol === 'up' ? color : undefined,
                            borderTopColor: symbol === 'down' ? color : undefined,
                        })
                    }} />
                )}
                <span style={{ color: '#333', fontFamily: 'Arial, sans-serif', lineHeight: '1.2' }}>{label}</span>
            </div>
        );
    };

    if (loading) {
        return (
            <main className="page-content page-30" role="main">
                <div style={{ padding: '40px', textAlign: 'center' }}>
                    {lang === 'en' ? 'Loading map data...' : 'Chargement des données de la carte...'}
                </div>
            </main>
        );
    }

    if (error) {
        return (
            <main className="page-content page-30" role="main">
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
            className="page-content page-30" 
            role="main"
            aria-label={`${getText('page30_title', lang)} - ${getText('page30_subtitle', lang)}`}
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

                .page-30 {
                    margin-left: -${layoutPadding?.left || 55}px;
                    width: calc(100% + ${layoutPadding?.left || 55}px);
                    padding-left: ${layoutPadding?.left || 55}px; 
                }

                .page30-container {
                    width: 100%;
                    padding: 20px 0;
                    display: flex;
                    flex-direction: column;
                }

                .page30-header {
                    margin-bottom: 10px;
                }

                .page30-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 41px;
                    font-weight: bold;
                    color: #58585a;
                    margin: 0;
                    padding-bottom: 0.5em;
                    border-bottom: 2px solid #b6b7ba;
                    position: relative;
                }

                .page30-title::after {
                    content: '';
                    position: absolute;
                    left: 0;
                    bottom: 0.2em;
                    width: 72px;
                    height: 6px;
                    background-color: var(--gc-red);
                }

                .page30-subtitle {
                    font-family: 'Lato', sans-serif;
                    font-size: 39px;
                    font-weight: bold;
                    color: #58585a;
                    margin: 0;
                    padding-top: 5px;
                }

                .page30-content {
                    display: flex;
                    flex-direction: row;
                    gap: 15px;
                    margin-top: 10px;
                }

                .page30-map-wrapper {
                    flex: 1;
                    position: relative;
                }

                .page30-map-container {
                    position: relative;
                    width: 100%;
                    height: ${mapHeight}px;
                    overflow: visible;
                }

                .page30-legend {
                    width: 260px;
                    flex-shrink: 0;
                    padding: 12px;
                    background-color: #fafafa;
                    border: 1px solid #e0e0e0;
                    border-radius: 4px;
                    max-height: ${mapHeight}px;
                    overflow-y: auto;
                }

                .page30-legend-section {
                    margin-bottom: 12px;
                }

                .page30-legend-title {
                    font-family: Arial, sans-serif;
                    font-size: 11px;
                    font-weight: bold;
                    color: var(--gc-text);
                    margin-bottom: 6px;
                    padding-bottom: 3px;
                    border-bottom: 1px solid #ccc;
                }

                .page30-data-table {
                    margin-top: 20px;
                }

                .page30-data-table summary {
                    cursor: pointer;
                    padding: 10px 15px;
                    background-color: #f5f5f5;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-family: Arial, sans-serif;
                    font-weight: bold;
                    list-style: none;
                }

                .page30-data-table summary::-webkit-details-marker {
                    display: none;
                }

                .page30-data-table th,
                .page30-data-table td {
                    padding: 8px;
                    text-align: left;
                    border: 1px solid #ddd;
                }

                .page30-data-table th {
                    background-color: #f5f5f5;
                    font-weight: bold;
                }

                @media (max-width: 1100px) {
                    .page30-content {
                        flex-direction: column;
                    }
                    .page30-legend {
                        width: 100%;
                        max-height: none;
                        display: flex;
                        flex-wrap: wrap;
                        gap: 15px;
                    }
                    .page30-legend-section {
                        flex: 1;
                        min-width: 180px;
                    }

                        .page30-map-wrapper {
                            margin-left: -150px;
                        }
                }

                @media (max-width: 768px) {
                    .page30-title {
                        font-size: 37px;
                    }
                    .page30-subtitle {
                        font-size: 35px;
                    }
                }

               @media (max-width: 640px) {
                    .page-30 { 
                        border-left: none !important; 
                        margin-left: 0;
                        width: 100%;
                        padding-left: 15px;
                        padding-right: 15px;
                    }

                    .page30-map-wrapper {
                        margin-left: -140px;
                        margin-right: -105px;
                        width: calc(100% + 140px); 
                    }

                    .page30-map-container {
                        width: 100%;
                    }

                    .page30-title {
                        font-size: 1.4rem;
                    }
                    .page30-subtitle {
                        font-size: 1.1rem;
                    }
                    .page30-legend {
                        flex-direction: column;
                    }
                    .page30-legend-section {
                        min-width: 100%;
                    }

                    @media (max-width: 480px) {
                        .page30-map-wrapper {
                            margin-left: -70px;
                            margin-right: -100px;
                            width: calc(100% + 100px);
                        }
                    }

                    @media (max-width: 384px) {
                        .page30-map-wrapper {
                            margin-left: -45px;
                            margin-right: -90px;
                            width: calc(100% + 70px);
                        }
                    }
                }

                /* FIXED: Grid layout with minmax(0, 1fr) prevents the table from 
                   blowing out the width of the page, forcing the scrollbar to appear. */
                .page30-table-wrapper {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr);
                    width: 100%;
                    margin-top: 20px;
                }

                .page30-data-table {
                    width: 100%;
                }

                /* This is the actual scrolling box */
                .page30-table-wrapper .table-responsive {
                    display: block;
                    width: 100%;
                    overflow-x: auto !important;
                    -webkit-overflow-scrolling: touch;
                    border: 1px solid #ddd;
                    background: #fff;
                }

                /* FORCE SCROLLBARS TO APPEAR */
                .page30-table-wrapper .table-responsive table {
                    width: max-content !important;
                    min-width: 100%;
                    border-collapse: collapse;
                }
            `}</style>

            <div className="wb-inv" role="region" aria-label={lang === 'en' ? 'Page summary' : 'Résumé de la page'}>
                {getText('page30_sr_summary', lang)}
            </div>

            <div className="page30-container">
                <header className="page30-header">
                    <h1 className="page30-title">
                        {getText('page30_title', lang)}
                    </h1>
                    <p className="page30-subtitle">
                        {getText('page30_subtitle', lang)}
                    </p>
                </header>

                <div className="page30-content">
                    <div className="page30-map-wrapper">
                        <div ref={chartRef} className="page30-map-container" aria-hidden="true" style={{ position: 'relative' }}>
                            {selectedProvinces !== null && (
                                <button onClick={() => setSelectedProvinces(null)} style={{ position: 'absolute', top: 0, right: 295, zIndex: 20 }}>{lang === 'en' ? 'Clear' : 'Effacer'}</button>
                            )}
                            <Plot
                                key={`map-${selectedProvinces ? selectedProvinces.join('-') : 'none'}`}
                                data={plotlyData}
                                layout={{
                                    geo: {
                                        scope: 'north america',
                                        projection: {
                                            type: 'conic conformal',
                                            parallels: [50, 70],
                                            rotation: { lon: -96 },
                                            scale: mapScale
                                        },
                                        center: { lon: -96, lat: 62 },
                                        showframe: false,
                                        showland: false,
                                        showcountries: false,
                                        showcoastlines: false,
                                        showsubunits: false,
                                        showlakes: true,
                                        lakecolor: 'white',
                                        bgcolor: 'rgba(0,0,0,0)'
                                    },
                                    margin: { l: 0, r: 0, t: 0, b: 0 },
                                    height: mapHeight,
                                    clickmode: 'event',
                                    dragmode: windowWidth <= 768 ? false : 'zoom',
                                    paper_bgcolor: 'rgba(0,0,0,0)',
                                    plot_bgcolor: 'rgba(0,0,0,0)',
                                    showlegend: false
                                }}
                                onClick={handleMapClick}
                                config={{
                                    displayModeBar: true,
                                    displaylogo: false,
                                    responsive: true,
                                    scrollZoom: false,
                                    doubleClick: 'reset+autosize',
                                    modeBarButtonsToRemove: ['lasso2d', 'select2d', 'toImage'],
                                    modeBarButtonsToAdd: [{
                                        name: lang === 'en' ? 'Download chart as PNG' : 'Télécharger le graphique en PNG',
                                        icon: {
                                            width: 1000,
                                            height: 1000,
                                            path: 'm500 450c-83 0-150-67-150-150 0-83 67-150 150-150 83 0 150 67 150 150 0 83-67 150-150 150z m400 150h-120c-16 0-34 13-39 29l-31 93c-6 15-23 28-40 28h-340c-16 0-34-13-39-28l-31-94c-6-15-23-28-40-28h-120c-55 0-100-45-100-100v-450c0-55 45-100 100-100h800c55 0 100 45 100 100v450c0 55-45 100-100 100z m-400-550c-138 0-250 112-250 250 0 138 112 250 250 250 138 0 250-112 250-250 0-138-112-250-250-250z m365 380c-19 0-35 16-35 35 0 19 16 35 35 35 19 0 35-16 35-35 0-19-16-35-35-35z',
                                            transform: 'matrix(1 0 0 -1 0 850)'
                                        },
                                        click: () => downloadChartWithTitle()
                                    }]
                                }}
                                style={{ width: '100%', height: '100%' }}
                            />
                        </div>
                    </div>

                    <aside className="page30-legend" aria-label={lang === 'en' ? 'Map legend' : 'Légende de la carte'}>
                        <div className="page30-legend-section">
                            <div className="page30-legend-title">{getText('page30_legend_title_lines', lang)}</div>
                            <LegendItem isLine color="#FE3ED8" label={getText('page30_legend_transmission_planned', lang)} />
                            <LegendItem isLine color="#B684B6" label={getText('page30_legend_transmission_construction', lang)} />
                            <LegendItem isLine color="#a3f900" label={getText('page30_legend_transmission_clean_planned', lang)} />
                            <LegendItem isLine color="#71a210" label={getText('page30_legend_transmission_clean_construction', lang)} />
                        </div>

                        <div className="page30-legend-section">
                            <div className="page30-legend-title">{getText('page30_legend_title_energy', lang)}</div>
                            <LegendItem symbol="up" color="#4196F6" isOutline size="small" label={getText('page30_legend_energy_10_999m_planned', lang)} />
                            <LegendItem symbol="up" color="#4196F6" isOutline size="medium" label={getText('page30_legend_energy_1_5b_planned', lang)} />
                            <LegendItem symbol="up" color="#4196F6" isOutline size="large" label={getText('page30_legend_energy_5b_plus_planned', lang)} />
                            <LegendItem symbol="up" color="#20B2AA" size="small" label={getText('page30_legend_energy_10_999m_construction', lang)} />
                            <LegendItem symbol="up" color="#20B2AA" size="medium" label={getText('page30_legend_energy_1_5b_construction', lang)} />
                            <LegendItem symbol="up" color="#20B2AA" size="large" label={getText('page30_legend_energy_5b_plus_construction', lang)} />
                        </div>

                        <div className="page30-legend-section">
                            <div className="page30-legend-title">{getText('page30_legend_title_energy_clean', lang)}</div>
                            <LegendItem symbol="down" color="#4196F6" isOutline size="small" label={getText('page30_legend_clean_10_999m_planned', lang)} />
                            <LegendItem symbol="down" color="#4196F6" isOutline size="medium" label={getText('page30_legend_clean_1_5b_planned', lang)} />
                            <LegendItem symbol="down" color="#4196F6" isOutline size="large" label={getText('page30_legend_clean_5b_plus_planned', lang)} />
                            <LegendItem symbol="down" color="#20B2AA" size="small" label={getText('page30_legend_clean_10_999m_construction', lang)} />
                            <LegendItem symbol="down" color="#20B2AA" size="medium" label={getText('page30_legend_clean_1_5b_construction', lang)} />
                            <LegendItem symbol="down" color="#20B2AA" size="large" label={getText('page30_legend_clean_5b_plus_construction', lang)} />
                        </div>
                    </aside>
                </div>

                <div style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginTop: '20px', 
                    marginBottom: '5px',
                    padding: '8px 10px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '4px'
                }}>
                    <button
                        onClick={clearAllFilters}
                        style={{
                            padding: '6px 12px',
                            fontSize: '11px',
                            backgroundColor: '#fff',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {lang === 'en' ? 'Clear Filters' : 'Effacer filtres'}
                    </button>
                    <span style={{ fontSize: '11px', color: '#666', marginLeft: 'auto' }}>
                        {lang === 'en' 
                            ? `Showing ${filteredTableData.length} of ${tableData.length} projects`
                            : `Affichage de ${filteredTableData.length} sur ${tableData.length} projets`}
                    </span>
                </div>

                <div style={{ 
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '10px',
                    marginBottom: '15px',
                    padding: '10px',
                    backgroundColor: '#fafafa',
                    borderRadius: '4px',
                    border: '1px solid #e0e0e0'
                }}>
                    <div ref={projectDropdownRef} style={{ position: 'relative', minWidth: '180px', flex: '1 1 180px' }}>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>
                            {lang === 'en' ? 'Project' : 'Projet'}
                        </label>
                        <button
                            onClick={() => { setProjectDropdownOpen(!projectDropdownOpen); setCompanyDropdownOpen(false); setProvinceDropdownOpen(false); }}
                            style={{
                                width: '100%',
                                padding: '6px 8px',
                                fontSize: '11px',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                backgroundColor: '#fff',
                                cursor: 'pointer',
                                textAlign: 'left',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}
                        >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {projectFilter.length === 0 
                                    ? (lang === 'en' ? 'All' : 'Tous')
                                    : `${projectFilter.length} ${lang === 'en' ? 'selected' : 'sélectionné(s)'}`}
                            </span>
                            <span style={{ marginLeft: '4px' }}>{projectDropdownOpen ? '▲' : '▼'}</span>
                        </button>
                        {projectDropdownOpen && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                maxHeight: '250px',
                                overflowY: 'auto',
                                backgroundColor: '#fff',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                zIndex: 100,
                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                            }}>
                                <label 
                                    style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        padding: '6px 8px', 
                                        cursor: 'pointer',
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        borderBottom: '2px solid #ddd',
                                        backgroundColor: '#f9f9f9'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                                >
                                    <input
                                        type="checkbox"
                                        checked={projectFilter.length === 0}
                                        onChange={() => setProjectFilter([])}
                                        style={{ marginRight: '8px' }}
                                    />
                                    <span>{lang === 'en' ? 'All' : 'Tous'}</span>
                                </label>
                                {uniqueProjects.map(project => (
                                    <label 
                                        key={project} 
                                        style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            padding: '6px 8px', 
                                            cursor: 'pointer',
                                            fontSize: '11px',
                                            borderBottom: '1px solid #eee'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={projectFilter.includes(project)}
                                            onChange={() => toggleProjectFilter(project)}
                                            style={{ marginRight: '8px' }}
                                        />
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    <div ref={companyDropdownRef} style={{ position: 'relative', minWidth: '180px', flex: '1 1 180px' }}>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>
                            {lang === 'en' ? 'Company' : 'Entreprise'}
                        </label>
                        <button
                            onClick={() => { setCompanyDropdownOpen(!companyDropdownOpen); setProjectDropdownOpen(false); setProvinceDropdownOpen(false); }}
                            style={{
                                width: '100%',
                                padding: '6px 8px',
                                fontSize: '11px',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                backgroundColor: '#fff',
                                cursor: 'pointer',
                                textAlign: 'left',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}
                        >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {companyFilter.length === 0 
                                    ? (lang === 'en' ? 'All' : 'Tous')
                                    : `${companyFilter.length} ${lang === 'en' ? 'selected' : 'sélectionné(s)'}`}
                            </span>
                            <span style={{ marginLeft: '4px' }}>{companyDropdownOpen ? '▲' : '▼'}</span>
                        </button>
                        {companyDropdownOpen && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                maxHeight: '250px',
                                overflowY: 'auto',
                                backgroundColor: '#fff',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                zIndex: 100,
                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                            }}>
                                <label 
                                    style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        padding: '6px 8px', 
                                        cursor: 'pointer',
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        borderBottom: '2px solid #ddd',
                                        backgroundColor: '#f9f9f9'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                                >
                                    <input
                                        type="checkbox"
                                        checked={companyFilter.length === 0}
                                        onChange={() => setCompanyFilter([])}
                                        style={{ marginRight: '8px' }}
                                    />
                                    <span>{lang === 'en' ? 'All' : 'Tous'}</span>
                                </label>
                                {uniqueCompanies.map(company => (
                                    <label 
                                        key={company} 
                                        style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            padding: '6px 8px', 
                                            cursor: 'pointer',
                                            fontSize: '11px',
                                            borderBottom: '1px solid #eee'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={companyFilter.includes(company)}
                                            onChange={() => toggleCompanyFilter(company)}
                                            style={{ marginRight: '8px' }}
                                        />
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{company}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    <div ref={provinceDropdownRef} style={{ position: 'relative', minWidth: '150px', flex: '1 1 150px' }}>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>
                            {lang === 'en' ? 'Province' : 'Province'}
                        </label>
                        <button
                            onClick={() => { setProvinceDropdownOpen(!provinceDropdownOpen); setProjectDropdownOpen(false); setCompanyDropdownOpen(false); }}
                            style={{
                                width: '100%',
                                padding: '6px 8px',
                                fontSize: '11px',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                backgroundColor: '#fff',
                                cursor: 'pointer',
                                textAlign: 'left',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}
                        >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {provinceFilter.length === 0 
                                    ? (lang === 'en' ? 'All' : 'Tous')
                                    : `${provinceFilter.length} ${lang === 'en' ? 'selected' : 'sélectionné(s)'}`}
                            </span>
                            <span style={{ marginLeft: '4px' }}>{provinceDropdownOpen ? '▲' : '▼'}</span>
                        </button>
                        {provinceDropdownOpen && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                maxHeight: '250px',
                                overflowY: 'auto',
                                backgroundColor: '#fff',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                zIndex: 100,
                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                            }}>
                                <label 
                                    style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        padding: '6px 8px', 
                                        cursor: 'pointer',
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        borderBottom: '2px solid #ddd',
                                        backgroundColor: '#f9f9f9'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                                >
                                    <input
                                        type="checkbox"
                                        checked={provinceFilter.length === 0}
                                        onChange={() => setProvinceFilter([])}
                                        style={{ marginRight: '8px' }}
                                    />
                                    <span>{lang === 'en' ? 'All' : 'Tous'}</span>
                                </label>
                                {uniqueProvinces.map(province => (
                                    <label 
                                        key={province} 
                                        style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            padding: '6px 8px', 
                                            cursor: 'pointer',
                                            fontSize: '11px',
                                            borderBottom: '1px solid #eee'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={provinceFilter.includes(province)}
                                            onChange={() => toggleProvinceFilter(province)}
                                            style={{ marginRight: '8px' }}
                                        />
                                        <span>{province}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    <div ref={locationDropdownRef} style={{ position: 'relative', minWidth: '140px', flex: '1 1 140px' }}>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>
                            {lang === 'en' ? 'Location' : 'Emplacement'}
                        </label>
                        <button
                            onClick={() => { setLocationDropdownOpen(!locationDropdownOpen); setProjectDropdownOpen(false); setCompanyDropdownOpen(false); setProvinceDropdownOpen(false); setTypeDropdownOpen(false); }}
                            style={{
                                width: '100%',
                                padding: '6px 8px',
                                fontSize: '11px',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                backgroundColor: '#fff',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}
                        >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {locationFilter.length === 0 
                                    ? (lang === 'en' ? 'All' : 'Tous')
                                    : `${locationFilter.length} ${lang === 'en' ? 'selected' : 'sélectionné(s)'}`}
                            </span>
                            <span style={{ marginLeft: '4px' }}>{locationDropdownOpen ? '▲' : '▼'}</span>
                        </button>
                        {locationDropdownOpen && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                maxHeight: '200px',
                                overflowY: 'auto',
                                backgroundColor: '#fff',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                zIndex: 1000
                            }}>
                                <label 
                                    style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        padding: '6px 8px', 
                                        cursor: 'pointer',
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        borderBottom: '2px solid #ddd',
                                        backgroundColor: '#f9f9f9'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                                >
                                    <input
                                        type="checkbox"
                                        checked={locationFilter.length === 0}
                                        onChange={() => setLocationFilter([])}
                                        style={{ marginRight: '8px' }}
                                    />
                                    <span>{lang === 'en' ? 'All' : 'Tous'}</span>
                                </label>
                                {uniqueLocations.map(location => (
                                    <label 
                                        key={location} 
                                        style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            padding: '6px 8px', 
                                            cursor: 'pointer',
                                            fontSize: '11px',
                                            borderBottom: '1px solid #eee'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={locationFilter.includes(location)}
                                            onChange={() => toggleLocationFilter(location)}
                                            style={{ marginRight: '8px' }}
                                        />
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{location}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    <div ref={typeDropdownRef} style={{ position: 'relative', minWidth: '140px', flex: '1 1 140px' }}>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>
                            {lang === 'en' ? 'Type' : 'Type'}
                        </label>
                        <button
                            onClick={() => { setTypeDropdownOpen(!typeDropdownOpen); setProjectDropdownOpen(false); setCompanyDropdownOpen(false); setProvinceDropdownOpen(false); setLocationDropdownOpen(false); }}
                            style={{
                                width: '100%',
                                padding: '6px 8px',
                                fontSize: '11px',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                backgroundColor: '#fff',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}
                        >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {typeFilter.length === 0 
                                    ? (lang === 'en' ? 'All' : 'Tous')
                                    : `${typeFilter.length} ${lang === 'en' ? 'selected' : 'sélectionné(s)'}`}
                            </span>
                            <span style={{ marginLeft: '4px' }}>{typeDropdownOpen ? '▲' : '▼'}</span>
                        </button>
                        {typeDropdownOpen && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                maxHeight: '200px',
                                overflowY: 'auto',
                                backgroundColor: '#fff',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                zIndex: 1000
                            }}>
                                <label 
                                    style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        padding: '6px 8px', 
                                        cursor: 'pointer',
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        borderBottom: '2px solid #ddd',
                                        backgroundColor: '#f9f9f9'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                                >
                                    <input
                                        type="checkbox"
                                        checked={typeFilter.length === 0}
                                        onChange={() => setTypeFilter([])}
                                        style={{ marginRight: '8px' }}
                                    />
                                    <span>{lang === 'en' ? 'All' : 'Tous'}</span>
                                </label>
                                {uniqueTypes.map(type => (
                                    <label 
                                        key={type} 
                                        style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            padding: '6px 8px', 
                                            cursor: 'pointer',
                                            fontSize: '11px',
                                            borderBottom: '1px solid #eee'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={typeFilter.includes(type)}
                                            onChange={() => toggleTypeFilter(type)}
                                            style={{ marginRight: '8px' }}
                                        />
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{type}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    <div style={{ minWidth: '150px', flex: '1 1 150px' }}>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>
                            {lang === 'en' ? 'Capital Cost' : 'Coût en capital'}
                        </label>
                        <select
                            value={capitalCostFilter}
                            onChange={(e) => setCapitalCostFilter(e.target.value)}
                            style={{ 
                                padding: '6px 8px', 
                                fontSize: '11px',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                width: '100%',
                                backgroundColor: '#fff'
                            }}
                        >
                            <option value="all">{lang === 'en' ? 'All' : 'Tous'}</option>
                            <option value="10_999">{lang === 'en' ? '$10-999 million' : '10-999 millions $'}</option>
                            <option value="1000_5000">{lang === 'en' ? '$1-5 billion' : '1-5 milliards $'}</option>
                            <option value="5000_plus">{lang === 'en' ? 'More than $5 billion' : 'Plus de 5 milliards $'}</option>
                        </select>
                    </div>

                    <div style={{ minWidth: '130px', flex: '1 1 130px' }}>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>
                            {lang === 'en' ? 'Status' : 'Statut'}
                        </label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            style={{ 
                                padding: '6px 8px', 
                                fontSize: '11px',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                width: '100%',
                                backgroundColor: '#fff'
                            }}
                        >
                            <option value="all">{lang === 'en' ? 'All' : 'Tous'}</option>
                            <option value="planned">{lang === 'en' ? 'Planned' : 'Prévu'}</option>
                            <option value="under_construction">{lang === 'en' ? 'Under Construction' : 'En construction'}</option>
                        </select>
                    </div>

                    <div style={{ minWidth: '120px', flex: '1 1 120px' }}>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>
                            {lang === 'en' ? 'Clean Tech' : 'Tech. propre'}
                        </label>
                        <select
                            value={cleanTechFilter}
                            onChange={(e) => setCleanTechFilter(e.target.value)}
                            style={{ 
                                padding: '6px 8px', 
                                fontSize: '11px',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                width: '100%',
                                backgroundColor: '#fff'
                            }}
                        >
                            <option value="all">{lang === 'en' ? 'All' : 'Tous'}</option>
                            <option value="yes">{lang === 'en' ? 'Yes' : 'Oui'}</option>
                            <option value="no">{lang === 'en' ? 'No' : 'Non'}</option>
                        </select>
                    </div>
                </div>

                <div className="page30-table-wrapper">
                <details 
                    className="page30-data-table"
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
                        aria-label={lang === 'en' ? 'Data Table' : 'Tableau de données'}
                        tabIndex="0"
                    >
                        <table className="table table-striped table-hover" style={{ fontSize: '11px' }}>
                            <caption className="wb-inv">
                                {lang === 'en' 
                                    ? 'Major energy projects data including project name, company, province, location, type, capital cost, status, and clean technology indicator. Click column headers to sort.' 
                                    : 'Données sur les grands projets énergétiques incluant le nom du projet, l\'entreprise, la province, l\'emplacement, le type, le coût en capital, le statut et l\'indicateur de technologie propre. Cliquez sur les en-têtes de colonne pour trier.'}
                            </caption>
                            <thead>
                                <tr style={{ backgroundColor: '#e6e6e6' }}>
                                    <th 
                                        scope="col" 
                                        style={{ padding: '8px', textAlign: 'left', fontWeight: 'bold', borderBottom: '2px solid #ccc', border: '1px solid #ddd', cursor: 'pointer', userSelect: 'none' }}
                                        onClick={() => handleSort('project_name')}
                                        aria-sort={sortColumn === 'project_name' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                                    >
                                        {lang === 'en' ? 'Project Name' : 'Nom du projet'}
                                        <span style={{ marginLeft: '4px', opacity: sortColumn === 'project_name' ? 1 : 0.3 }}>
                                            {sortColumn === 'project_name' ? (sortDirection === 'asc' ? '▲' : '▼') : '▲'}
                                        </span>
                                    </th>
                                    <th 
                                        scope="col" 
                                        style={{ padding: '8px', textAlign: 'left', fontWeight: 'bold', borderBottom: '2px solid #ccc', border: '1px solid #ddd', cursor: 'pointer', userSelect: 'none' }}
                                        onClick={() => handleSort('company')}
                                        aria-sort={sortColumn === 'company' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                                    >
                                        {lang === 'en' ? 'Company' : 'Entreprise'}
                                        <span style={{ marginLeft: '4px', opacity: sortColumn === 'company' ? 1 : 0.3 }}>
                                            {sortColumn === 'company' ? (sortDirection === 'asc' ? '▲' : '▼') : '▲'}
                                        </span>
                                    </th>
                                    <th 
                                        scope="col" 
                                        style={{ padding: '6px 4px', textAlign: 'center', fontWeight: 'bold', borderBottom: '2px solid #ccc', border: '1px solid #ddd', cursor: 'pointer', userSelect: 'none' }}
                                        onClick={() => handleSort('province')}
                                        aria-sort={sortColumn === 'province' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                                    >
                                        {lang === 'en' ? 'Prov.' : 'Prov.'}
                                        <span style={{ marginLeft: '2px', opacity: sortColumn === 'province' ? 1 : 0.3 }}>
                                            {sortColumn === 'province' ? (sortDirection === 'asc' ? '▲' : '▼') : '▲'}
                                        </span>
                                    </th>
                                    <th 
                                        scope="col" 
                                        style={{ padding: '6px 4px', textAlign: 'left', fontWeight: 'bold', borderBottom: '2px solid #ccc', border: '1px solid #ddd', cursor: 'pointer', userSelect: 'none' }}
                                        onClick={() => handleSort('location')}
                                        aria-sort={sortColumn === 'location' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                                    >
                                        {lang === 'en' ? 'Location' : 'Lieu'}
                                        <span style={{ marginLeft: '2px', opacity: sortColumn === 'location' ? 1 : 0.3 }}>
                                            {sortColumn === 'location' ? (sortDirection === 'asc' ? '▲' : '▼') : '▲'}
                                        </span>
                                    </th>
                                    <th 
                                        scope="col" 
                                        style={{ padding: '6px 4px', textAlign: 'left', fontWeight: 'bold', borderBottom: '2px solid #ccc', border: '1px solid #ddd', cursor: 'pointer', userSelect: 'none' }}
                                        onClick={() => handleSort('clean_technology_type')}
                                        aria-sort={sortColumn === 'clean_technology_type' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                                    >
                                        {lang === 'en' ? 'Type' : 'Type'}
                                        <span style={{ marginLeft: '2px', opacity: sortColumn === 'clean_technology_type' ? 1 : 0.3 }}>
                                            {sortColumn === 'clean_technology_type' ? (sortDirection === 'asc' ? '▲' : '▼') : '▲'}
                                        </span>
                                    </th>
                                    <th 
                                        scope="col" 
                                        style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 'bold', borderBottom: '2px solid #ccc', border: '1px solid #ddd', cursor: 'pointer', userSelect: 'none' }}
                                        onClick={() => handleSort('capital_cost')}
                                        aria-sort={sortColumn === 'capital_cost' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                                    >
                                        {lang === 'en' ? 'Cost ($M)' : 'Coût (M$)'}
                                        <span style={{ marginLeft: '2px', opacity: sortColumn === 'capital_cost' ? 1 : 0.3 }}>
                                            {sortColumn === 'capital_cost' ? (sortDirection === 'asc' ? '▲' : '▼') : '▲'}
                                        </span>
                                    </th>
                                    <th 
                                        scope="col" 
                                        style={{ padding: '6px 4px', textAlign: 'center', fontWeight: 'bold', borderBottom: '2px solid #ccc', border: '1px solid #ddd' }}
                                    >
                                        {lang === 'en' ? 'Status' : 'Statut'}
                                    </th>
                                    <th 
                                        scope="col" 
                                        style={{ padding: '6px 4px', textAlign: 'center', fontWeight: 'bold', borderBottom: '2px solid #ccc', border: '1px solid #ddd' }}
                                    >
                                        {lang === 'en' ? 'Clean' : 'Propre'}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTableData.map((project, idx) => (
                                    <tr key={project.id || idx}>
                                        <td style={{ padding: '4px 6px', borderBottom: '1px solid #eee', border: '1px solid #ddd' }}>
                                            {project.project_name || '—'}
                                        </td>
                                        <td style={{ padding: '4px 6px', borderBottom: '1px solid #eee', border: '1px solid #ddd' }}>
                                            {project.company || '—'}
                                        </td>
                                        <td style={{ padding: '4px 6px', textAlign: 'center', borderBottom: '1px solid #eee', border: '1px solid #ddd' }}>
                                            {project.province || '—'}
                                        </td>
                                        <td style={{ padding: '4px 6px', borderBottom: '1px solid #eee', border: '1px solid #ddd' }}>
                                            {project.location || '—'}
                                        </td>
                                        <td style={{ padding: '4px 6px', borderBottom: '1px solid #eee', border: '1px solid #ddd' }}>
                                            {project.clean_technology_type || '—'}
                                        </td>
                                        <td style={{ padding: '4px 6px', textAlign: 'right', borderBottom: '1px solid #eee', border: '1px solid #ddd' }}>
                                            {project.capital_cost || '—'}
                                        </td>
                                        <td style={{ padding: '4px 6px', textAlign: 'center', borderBottom: '1px solid #eee', border: '1px solid #ddd' }}>
                                            {project.status || '—'}
                                        </td>
                                        <td style={{ padding: '4px 6px', textAlign: 'center', borderBottom: '1px solid #eee', border: '1px solid #ddd' }}>
                                            {project.clean_technology || '—'}
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
        </main>
    );
};

export default Page30;
