import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import useWindowWidth from '../hooks/useWindowWidth';
import PageShell from '../components/PageShell';
import PageStatus from '../components/PageStatus';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { getText } from '../utils/translations';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';
import { stripHtml } from '../utils/stripHtml';

const major_projects_map_PROVINCE_INFO = {
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

const major_projects_map_PROVINCE_CODES = ['bc', 'ab', 'sk', 'mb', 'on', 'qc', 'nb', 'ns', 'pe', 'nl', 'yt', 'nt', 'nu'];

const projectsMapHexToRgba = (hex, opacity = 1) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
        return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
    }
    return hex;
};

const projectsMapGetMarkerSize = (costRange) => {
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

const projectsMapGetMarkerProps = (project, isSelected = true) => {
    const isClean = project.clean_technology === 'Yes' || project.clean_technology === 'Oui';
    const isConstruction = project.status === 'Under Construction' || project.status === 'En construction';
    const size = projectsMapGetMarkerSize(project.capital_cost_range);
    const opacity = isSelected ? 1 : 0.3;
    const plannedColor = '#4196F6';
    const constructionColor = '#20B2AA';
    const color = isConstruction ? constructionColor : plannedColor;

    if (isClean) {
        return {
            symbol: 'triangle-down',
            color: projectsMapHexToRgba(color, opacity),
            size,
            line: { color: projectsMapHexToRgba(color, opacity), width: 1 }
        };
    }

    return {
        symbol: 'triangle-up',
        color: projectsMapHexToRgba(color, opacity),
        size,
        line: { color: projectsMapHexToRgba(color, opacity), width: 1 }
    };
};

const projectsMapGetLineColor = (line, isSelected = true) => {
    const isClean = line.clean_technology === 'Yes' || line.clean_technology === 'Oui';
    const isConstruction = line.status === 'Under Construction' || line.status === 'En construction';
    const opacity = isSelected ? 1 : 0.3;
    const color = isClean
        ? (isConstruction ? '#71a210' : '#a3f900')
        : (isConstruction ? '#B684B6' : '#FE3ED8');
    return projectsMapHexToRgba(color, opacity);
};

const projectsMapFormatHoverText = (project, language) => {
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

const projectsMapIsProjectInSelectedProvince = (project, selectedProvinces) => {
    if (selectedProvinces === null) return true;
    const projectProvince = (project.province || '').toLowerCase();
    return selectedProvinces.some(idx => {
        const code = major_projects_map_PROVINCE_CODES[idx];
        const info = major_projects_map_PROVINCE_INFO[code];
        const enName = info.nameEn.toLowerCase();
        const frName = info.nameFr.toLowerCase();
        return projectProvince.includes(enName) || enName.includes(projectProvince) ||
               projectProvince.includes(frName) || frName.includes(projectProvince);
    });
};

const LegendItem = ({ windowWidth, color, symbol, label, isLine, isOutline, size = 'medium' }) => {
    const sizeMap = { small: 8, medium: 12, large: 16 };
    const triangleSize = sizeMap[size] || 12;

    return (
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '3px', fontSize: windowWidth <= 768 ? '14px' : '16px' }}>
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
                    borderLeft: `${triangleSize / 2}px solid transparent`,
                    borderRight: `${triangleSize / 2}px solid transparent`,
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

const MajorProjectsMap = () => {
    const { lang } = useOutletContext();
    const windowWidth = useWindowWidth();
    const [mapData, setMapData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
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

    useEffect(() => {
        const handleResize = () => {
            const newWidth = window.innerWidth;
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

    

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: lang === 'en' ? 'major_energy_projects_map.png' : 'carte_grands_projets_energetiques.png',
        title: stripHtml(`${getText('major_projects_map_title', lang)} - ${getText('major_projects_map_subtitle', lang)}`),
        width: 1400,
        height: 900,
    }),
        [getText, lang, stripHtml],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: () => downloadChartWithTitle(),
        doubleClick: 'reset+autosize',
    });

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
                const code = major_projects_map_PROVINCE_CODES[idx];
                const info = major_projects_map_PROVINCE_INFO[code];
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

    const applyFiltersToData = useCallback((data) => {
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
    }, [projectFilter, companyFilter, provinceFilter, typeFilter, locationFilter, capitalCostFilter, statusFilter, cleanTechFilter]);

    const filteredMapPoints = useMemo(() => {
        if (!langData || !langData.points) return [];
        return applyFiltersToData(langData.points);
    }, [langData, applyFiltersToData]);

    const filteredMapLines = useMemo(() => {
        if (!langData || !langData.lines) return [];
        return applyFiltersToData(langData.lines);
    }, [langData, applyFiltersToData]);

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

    const tableCaption = lang === 'en'
        ? 'Major energy projects data including project name, company, province, location, type, capital cost, status, and clean technology indicator.'
        : 'Données sur les grands projets énergétiques incluant le nom du projet, l\'entreprise, la province, l\'emplacement, le type, le coût en capital, le statut et l\'indicateur de technologie propre.';

    const exportTableTitle = stripHtml(`${getText('major_projects_map_title', lang)} - ${getText('major_projects_map_subtitle', lang)}`);
    const tableDownloadSlug = lang === 'en' ? 'major_energy_projects' : 'grands_projets_energetiques';

    const tableColumns = useMemo(() => [
        { key: 'project_name', header: lang === 'en' ? 'Project Name' : 'Nom du projet', align: 'left' },
        { key: 'company', header: lang === 'en' ? 'Company' : 'Entreprise', align: 'left' },
        { key: 'province', header: lang === 'en' ? 'Prov.' : 'Prov.', align: 'left' },
        { key: 'location', header: lang === 'en' ? 'Location' : 'Lieu', align: 'left' },
        { key: 'clean_technology_type', header: lang === 'en' ? 'Type' : 'Type', align: 'left' },
        { key: 'capital_cost', header: lang === 'en' ? 'Cost ($M)' : 'Coût (M$)', align: 'num' },
        { key: 'status', header: lang === 'en' ? 'Status' : 'Statut', align: 'left' },
        { key: 'clean_technology', header: lang === 'en' ? 'Clean' : 'Propre', align: 'left' },
    ], [lang]);

    const plotlyData = useMemo(() => {
        if (!langData) return [];
        
        const traces = [];
        
        const geoJsonNames = major_projects_map_PROVINCE_CODES.map(code => major_projects_map_PROVINCE_INFO[code].geoJsonName);
        const provinceColors = major_projects_map_PROVINCE_CODES.map((_, idx) => {
            if (selectedProvinces === null) return '#474747';
            return selectedProvinces.includes(idx) ? '#474747' : projectsMapHexToRgba('#474747', 0.3);
        });

        const choroplethTrace = {
            type: 'choropleth',
            locationmode: 'geojson-id',
            geojson: 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/canada.geojson',
            featureidkey: 'properties.name',
            locations: geoJsonNames,
            z: major_projects_map_PROVINCE_CODES.map((_, idx) => idx),
            text: major_projects_map_PROVINCE_CODES.map(code => {
                const info = major_projects_map_PROVINCE_INFO[code];
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
                    const isSelected = projectsMapIsProjectInSelectedProvince(line, selectedProvinces);
                    line.paths.forEach((path, pathIdx) => {
                        const lats = path.map(p => p.lat);
                        const lons = path.map(p => p.lon);
                        
                        traces.push({
                            type: 'scattergeo',
                            mode: 'lines',
                            lat: lats,
                            lon: lons,
                            line: {
                                color: projectsMapGetLineColor(line, isSelected),
                                width: 3
                            },
                            hoverinfo: 'text',
                            hovertext: projectsMapFormatHoverText(line, lang),
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
                        size: points.map(p => projectsMapGetMarkerProps(p, projectsMapIsProjectInSelectedProvince(p, selectedProvinces)).size),
                        color: points.map(p => projectsMapGetMarkerProps(p, projectsMapIsProjectInSelectedProvince(p, selectedProvinces)).color),
                        symbol: points.map(p => projectsMapGetMarkerProps(p, projectsMapIsProjectInSelectedProvince(p, selectedProvinces)).symbol),
                        line: {
                            color: points.map(p => projectsMapGetMarkerProps(p, projectsMapIsProjectInSelectedProvince(p, selectedProvinces)).line.color),
                            width: points.map(p => projectsMapGetMarkerProps(p, projectsMapIsProjectInSelectedProvince(p, selectedProvinces)).line.width)
                        }
                    },
                    hoverinfo: 'text',
                    hovertext: points.map(p => projectsMapFormatHoverText(p, lang)),
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
    const mapHeight = windowWidth <= 384 ? 230 : windowWidth <= 480 ? 290 : windowWidth <= 640 ? 350 : windowWidth <= 768 ? 500 : windowWidth <= 1100 ? 600 : 700;

    if (loading || error) {
        return (
            <PageShell className="page-content page-30" role="main">
                <PageStatus
                    lang={lang}
                    loading={loading}
                    error={error}
                    loadingMessage={lang === 'en' ? 'Loading map data...' : 'Chargement des données de la carte...'}
                    style={{ padding: '40px', textAlign: 'center' }}
                />
            </PageShell>
        );
    }

    const getChartSummary = () => {
        const rows = filteredTableData || tableData || [];
        const body = summarizeByCategory({
            categories: rows.slice(0, 40).map((row) => row.name || row.project || row.title || row.province),
            series: [{ name: lang === 'en' ? 'Value' : 'Valeur', values: rows.slice(0, 40).map((row) => row.value ?? row.capacity ?? row.cost), format: (v) => String(v ?? '—') }],
            lang,
        });
        return joinChartSummary({
            intro: getText('major_projects_map_sr_summary', lang),
            body,
            lang,
        });
    };
    const mapRegionLabel = getChartSummary();

    return (
        <PageShell 
            id="main-content"
            tabIndex="-1"
            className="page-content page-30" 
            role="main"
            aria-label={`${getText('major_projects_map_title', lang)} - ${getText('major_projects_map_subtitle', lang)}`}
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
                    width: 100%; 
                }

                .projects-map-container {
                    width: 100%;
                    padding: 20px 0;
                    display: flex;
                    flex-direction: column;
                }

                .projects-map-header {
                    margin-bottom: 20px;
                }

                .projects-map-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 41px;
                    font-weight: bold;
                    margin-top: 0;
                    margin-bottom: 25px;
                    color: var(--gc-text);
                    margin: 0;
                    padding-bottom: 0.5em;
                    position: relative;
                }

                .projects-map-title::after {
                    content: '';
                    position: absolute;
                    left: 0;
                    bottom: 0.2em;
                    width: 72px;
                    height: 6px;
                    background-color: var(--gc-red);
                }

                .projects-map-chart-title {
                    font-family: 'Lato', sans-serif;
                    font-size: 39px;
                    font-weight: bold;
                    color: #58585a;
                    text-align: center;
                    margin: 0 0 1em 0;
                }

                .projects-map-chart-frame {
                    background-color: #f5f5f5;
                    padding: 20px;
                    border-radius: 8px;
                    margin-top: 10px;
                    margin-bottom: 20px;
                    box-sizing: border-box;
                }

                .projects-map-content {
                    display: flex;
                    flex-direction: row;
                    gap: 15px;
                }

                .projects-map-map-wrapper {
                    flex: 1;
                    position: relative;
                }

                .projects-map-map-container {
                    position: relative;
                    width: 100%;
                    height: ${mapHeight}px;
                    overflow: visible;
                }

                .projects-map-legend {
                    width: 100%;
                    padding: 12px 0;
                    background-color: transparent;
                    border: none;
                    border-radius: 4px;
                    margin-top: 15px;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 20px;
                    justify-content: flex-start;
                }

                .projects-map-legend-section {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .projects-map-legend-title {
                    font-family: Arial, sans-serif;
                    font-size: 18px;
                    font-weight: bold;
                    color: var(--gc-text);
                    margin-bottom: 4px;
                    padding-bottom: 3px;
                    border-bottom: 1px solid #ccc;
                }

                .projects-map-legend-items {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px 15px;
                }

                .projects-map-chart-frame button[type="button"]:hover,
                .projects-map-chart-frame button:hover {
                    background-color: #404040 !important;
                }

                @media (max-width: 1100px) {
                    .projects-map-map-wrapper {
                        margin-left: -150px;
                    }
                }

                @media (max-width: 768px) {
                    .projects-map-title {
                        font-size: 37px;
                    }
                    .projects-map-chart-title {
                        font-size: 35px;
                    }

                }

               @media (max-width: 640px) {
                    .page-30 { 
                        border-left: none !important; 
                        margin-left: 0;
                        width: 100%;
                    }

                    .projects-map-map-wrapper {
                        margin-left: -180px;
                        margin-right: -105px;
                        width: calc(100% + 140px); 
                    }

                    .projects-map-map-container {
                        width: 100%;
                    }

                    .projects-map-title {
                        font-size: 1.4rem;
                    }
                    .projects-map-chart-title {
                        font-size: 1.1rem;
                    }
                    .projects-map-legend {
                        flex-direction: column;
                        gap: 12px;
                    }
                    .projects-map-legend-section {
                        width: 100%;
                    }
                    .projects-map-legend-items {
                        flex-direction: column;
                        gap: 4px;
                    }
                    .projects-map-map-container .js-plotly-plot .plotly .modebar {
                        right: 90px !important;
                        top: -20px !important;    
                    }

                    @media (max-width: 480px) {
                        .projects-map-map-wrapper {
                            margin-left: -170px;
                            margin-right: -100px;
                            width: calc(100% + 100px);
                        }
                    }

                    @media (max-width: 384px) {
                        .projects-map-map-wrapper {
                            margin-left: -155px;
                            margin-right: -90px;
                            width: calc(100% + 70px);
                        }
                    }
                }

                .projects-map-table-wrapper {
                    width: 100%;
                    margin-top: 20px;
                }
            `}</style>

            <div className="projects-map-container">
                <header className="projects-map-header">
                    <h1 className="projects-map-title">
                        {getText('major_projects_map_title', lang)}
                    </h1>
                </header>

                <div className="projects-map-chart-frame">
                    <p className="projects-map-chart-title">
                        {getText('major_projects_map_subtitle', lang)}
                    </p>
                    <div className="projects-map-content">
                        <div className="projects-map-map-wrapper">
                            <div 
                                ref={chartRef} 
                                className="projects-map-map-container" 
                                style={{ position: 'relative' }}
                                role="region"
                                aria-label={mapRegionLabel}
                                tabIndex="0"
                            >
                                {selectedProvinces !== null && (
                                    <ClearSelectionButton lang={lang} onClick={() => setSelectedProvinces(null)} />
                                )}
                                <div aria-hidden="true">
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
                                            lakecolor: '#f5f5f5',
                                            bgcolor: 'rgba(0,0,0,0)'
                                        },
                                        margin: { l: 0, r: 0, t: 0, b: 0 },
                                        height: mapHeight,
                                        clickmode: 'event',
                                        dragmode: false,
                                        paper_bgcolor: 'rgba(0,0,0,0)',
                                        plot_bgcolor: 'rgba(0,0,0,0)',
                                        showlegend: false
                                    }}
                                    onClick={handleMapClick}
                                    config={plotConfig}
                                    style={{ width: '100%', height: '100%' }}
                                />
                                </div>
                            </div>
                        </div>
                    </div>

                    <aside className="projects-map-legend" aria-hidden="true">
                    <div className="projects-map-legend-section">
                        <div className="projects-map-legend-title">{getText('major_projects_map_legend_title_lines', lang)}</div>
                        <div className="projects-map-legend-items">
                            <LegendItem windowWidth={windowWidth} isLine color="#FE3ED8" label={getText('major_projects_map_legend_transmission_planned', lang)} />
                            <LegendItem windowWidth={windowWidth} isLine color="#B684B6" label={getText('major_projects_map_legend_transmission_construction', lang)} />
                            <LegendItem windowWidth={windowWidth} isLine color="#a3f900" label={getText('major_projects_map_legend_transmission_clean_planned', lang)} />
                            <LegendItem windowWidth={windowWidth} isLine color="#71a210" label={getText('major_projects_map_legend_transmission_clean_construction', lang)} />
                        </div>
                    </div>

                    <div className="projects-map-legend-section">
                        <div className="projects-map-legend-title">{getText('major_projects_map_legend_title_energy', lang)}</div>
                        <div className="projects-map-legend-items">
                            <LegendItem windowWidth={windowWidth} symbol="up" color="#4196F6" isOutline size="small" label={getText('major_projects_map_legend_energy_10_999m_planned', lang)} />
                            <LegendItem windowWidth={windowWidth} symbol="up" color="#4196F6" isOutline size="medium" label={getText('major_projects_map_legend_energy_1_5b_planned', lang)} />
                            <LegendItem windowWidth={windowWidth} symbol="up" color="#4196F6" isOutline size="large" label={getText('major_projects_map_legend_energy_5b_plus_planned', lang)} />
                            <LegendItem windowWidth={windowWidth} symbol="up" color="#20B2AA" size="small" label={getText('major_projects_map_legend_energy_10_999m_construction', lang)} />
                            <LegendItem windowWidth={windowWidth} symbol="up" color="#20B2AA" size="medium" label={getText('major_projects_map_legend_energy_1_5b_construction', lang)} />
                            <LegendItem windowWidth={windowWidth} symbol="up" color="#20B2AA" size="large" label={getText('major_projects_map_legend_energy_5b_plus_construction', lang)} />
                        </div>
                    </div>

                    <div className="projects-map-legend-section">
                        <div className="projects-map-legend-title">{getText('major_projects_map_legend_title_energy_clean', lang)}</div>
                        <div className="projects-map-legend-items">
                            <LegendItem windowWidth={windowWidth} symbol="down" color="#4196F6" isOutline size="small" label={getText('major_projects_map_legend_clean_10_999m_planned', lang)} />
                            <LegendItem windowWidth={windowWidth} symbol="down" color="#4196F6" isOutline size="medium" label={getText('major_projects_map_legend_clean_1_5b_planned', lang)} />
                            <LegendItem windowWidth={windowWidth} symbol="down" color="#4196F6" isOutline size="large" label={getText('major_projects_map_legend_clean_5b_plus_planned', lang)} />
                            <LegendItem windowWidth={windowWidth} symbol="down" color="#20B2AA" size="small" label={getText('major_projects_map_legend_clean_10_999m_construction', lang)} />
                            <LegendItem windowWidth={windowWidth} symbol="down" color="#20B2AA" size="medium" label={getText('major_projects_map_legend_clean_1_5b_construction', lang)} />
                            <LegendItem windowWidth={windowWidth} symbol="down" color="#20B2AA" size="large" label={getText('major_projects_map_legend_clean_5b_plus_construction', lang)} />
                        </div>
                    </div>
                </aside>
                </div>

                <div 
                    role="region" 
                    aria-label={lang === 'en' ? 'Filter controls for projects table' : 'Contrôles de filtre pour le tableau des projets'}
                >
                    <h3 className="wb-inv">{lang === 'en' ? 'Filter area - Use the controls below to filter the projects table' : 'Zone de filtre - Utilisez les contrôles ci-dessous pour filtrer le tableau des projets'}</h3>
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
                </div>

                <div className="projects-map-table-wrapper">
                    <ChartDataTable
                        lang={lang}
                        columns={tableColumns}
                        rows={filteredTableData}
                        csvFilename={`${tableDownloadSlug}.csv`}
                        docx={{
                            filename: `${tableDownloadSlug}.docx`,
                            title: exportTableTitle,
                            titleAlign: 'center',
                            columnWidths: [2200, 1800, 900, 1400, 1400, 1100, 1200, 900],
                            fontSize: 18,
                        }}
                        caption={tableCaption}
                        tableAriaLabel={tableCaption}
                        renderCell={(raw) => (raw == null || raw === '' ? '—' : String(raw))}
                    />
                </div>
            </div>
        </PageShell>
    );
};

export default MajorProjectsMap;
