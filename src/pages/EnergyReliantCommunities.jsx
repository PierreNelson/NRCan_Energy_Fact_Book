import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { getText } from '../utils/translations';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

const BAR_COLOR = '#9f346d';

const energy_reliant_communities_BAR_PROVINCES = [
    { key: 'ab', count: 79 },
    { key: 'sk', count: 44 },
    { key: 'nl', count: 23 },
    { key: 'bc', count: 13 },
    { key: 'qc', count: 10 },
    { key: 'on', count: 6 },
    { key: 'nb', count: 4 },
    { key: 'mb', count: 3 }
];

const RELIANCE_COLORS = {
    high: '#154360',
    significant: '#0859B4',
    moderate: '#2C93D8'
};

const provinceInfo = {
    ab: { nameEn: 'Alberta', nameFr: 'Alberta', geoJsonName: 'Alberta' },
    sk: { nameEn: 'Saskatchewan', nameFr: 'Saskatchewan', geoJsonName: 'Saskatchewan' },
    nl: { nameEn: 'Newfoundland and Labrador', nameFr: 'Terre-Neuve-et-Labrador', geoJsonName: 'Newfoundland and Labrador' },
    bc: { nameEn: 'British Columbia', nameFr: 'Colombie-Britannique', geoJsonName: 'British Columbia' },
    qc: { nameEn: 'Quebec', nameFr: 'Québec', geoJsonName: 'Quebec' },
    on: { nameEn: 'Ontario', nameFr: 'Ontario', geoJsonName: 'Ontario' },
    nb: { nameEn: 'New Brunswick', nameFr: 'Nouveau-Brunswick', geoJsonName: 'New Brunswick' },
    mb: { nameEn: 'Manitoba', nameFr: 'Manitoba', geoJsonName: 'Manitoba' },
    ns: { nameEn: 'Nova Scotia', nameFr: 'Nouvelle-Écosse', geoJsonName: 'Nova Scotia' },
    pe: { nameEn: 'Prince Edward Island', nameFr: 'Île-du-Prince-Édouard', geoJsonName: 'Prince Edward Island' },
    yt: { nameEn: 'Yukon', nameFr: 'Yukon', geoJsonName: 'Yukon Territory' },
    nt: { nameEn: 'Northwest Territories', nameFr: 'Territoires du Nord-Ouest', geoJsonName: 'Northwest Territories' },
    nu: { nameEn: 'Nunavut', nameFr: 'Nunavut', geoJsonName: 'Nunavut' }
};

const provinceCodes = ['bc', 'ab', 'sk', 'mb', 'on', 'qc', 'nb', 'ns', 'pe', 'nl', 'yt', 'nt', 'nu'];
const filterProvinceKeys = ['ab', 'sk', 'nl', 'bc', 'qc', 'on', 'nb', 'mb', 'ns', 'pe', 'yt', 'nt', 'nu'];
const locationKeys = ['remote', 'rural', 'urban'];
const relianceKeys = ['high', 'significant', 'moderate'];
const RELIANCE_ORDER = { high: 0, significant: 1, moderate: 2 };

const DEMO_COMMUNITIES = [
    { id: 1, nameEn: 'Fort McMurray', nameFr: 'Fort McMurray', province: 'ab', lat: 56.73, lon: -111.38, location: 'remote', reliance: 'high' },
    { id: 2, nameEn: 'Grande Prairie', nameFr: 'Grande Prairie', province: 'ab', lat: 55.17, lon: -118.80, location: 'rural', reliance: 'significant' },
    { id: 3, nameEn: 'Lloydminster', nameFr: 'Lloydminster', province: 'ab', lat: 53.28, lon: -110.00, location: 'rural', reliance: 'high' },
    { id: 4, nameEn: 'Red Deer', nameFr: 'Red Deer', province: 'ab', lat: 52.27, lon: -113.81, location: 'urban', reliance: 'moderate' },
    { id: 5, nameEn: 'Medicine Hat', nameFr: 'Medicine Hat', province: 'ab', lat: 50.04, lon: -110.68, location: 'urban', reliance: 'moderate' },
    { id: 6, nameEn: 'Cold Lake', nameFr: 'Cold Lake', province: 'ab', lat: 54.46, lon: -110.18, location: 'remote', reliance: 'high' },
    { id: 7, nameEn: 'Bonnyville', nameFr: 'Bonnyville', province: 'ab', lat: 54.27, lon: -110.74, location: 'rural', reliance: 'significant' },
    { id: 8, nameEn: 'Whitecourt', nameFr: 'Whitecourt', province: 'ab', lat: 54.14, lon: -115.68, location: 'rural', reliance: 'significant' },
    { id: 9, nameEn: 'Hinton', nameFr: 'Hinton', province: 'ab', lat: 53.41, lon: -117.59, location: 'rural', reliance: 'moderate' },
    { id: 10, nameEn: 'Brooks', nameFr: 'Brooks', province: 'ab', lat: 50.56, lon: -111.90, location: 'rural', reliance: 'moderate' },
    { id: 11, nameEn: 'Estevan', nameFr: 'Estevan', province: 'sk', lat: 49.14, lon: -102.99, location: 'rural', reliance: 'high' },
    { id: 12, nameEn: 'Weyburn', nameFr: 'Weyburn', province: 'sk', lat: 49.66, lon: -103.85, location: 'rural', reliance: 'significant' },
    { id: 13, nameEn: 'Lloydminster', nameFr: 'Lloydminster', province: 'sk', lat: 53.24, lon: -109.99, location: 'rural', reliance: 'high' },
    { id: 14, nameEn: 'Kindersley', nameFr: 'Kindersley', province: 'sk', lat: 51.47, lon: -109.15, location: 'rural', reliance: 'significant' },
    { id: 15, nameEn: 'Swift Current', nameFr: 'Swift Current', province: 'sk', lat: 50.29, lon: -107.80, location: 'urban', reliance: 'moderate' },
    { id: 16, nameEn: 'Meadow Lake', nameFr: 'Meadow Lake', province: 'sk', lat: 54.13, lon: -108.43, location: 'remote', reliance: 'significant' },
    { id: 17, nameEn: 'La Ronge', nameFr: 'La Ronge', province: 'sk', lat: 55.10, lon: -105.28, location: 'remote', reliance: 'moderate' },
    { id: 18, nameEn: 'St. John\'s', nameFr: 'St. John\'s', province: 'nl', lat: 47.56, lon: -52.71, location: 'urban', reliance: 'moderate' },
    { id: 19, nameEn: 'Corner Brook', nameFr: 'Corner Brook', province: 'nl', lat: 48.95, lon: -57.93, location: 'urban', reliance: 'significant' },
    { id: 20, nameEn: 'Grand Falls-Windsor', nameFr: 'Grand Falls-Windsor', province: 'nl', lat: 48.93, lon: -55.65, location: 'rural', reliance: 'significant' },
    { id: 21, nameEn: 'Labrador City', nameFr: 'Labrador City', province: 'nl', lat: 52.95, lon: -66.91, location: 'remote', reliance: 'high' },
    { id: 22, nameEn: 'Stephenville', nameFr: 'Stephenville', province: 'nl', lat: 48.55, lon: -58.58, location: 'rural', reliance: 'moderate' },
    { id: 23, nameEn: 'Fort St. John', nameFr: 'Fort St. John', province: 'bc', lat: 56.25, lon: -120.85, location: 'rural', reliance: 'high' },
    { id: 24, nameEn: 'Dawson Creek', nameFr: 'Dawson Creek', province: 'bc', lat: 55.76, lon: -120.24, location: 'rural', reliance: 'significant' },
    { id: 25, nameEn: 'Kitimat', nameFr: 'Kitimat', province: 'bc', lat: 54.05, lon: -128.65, location: 'remote', reliance: 'significant' },
    { id: 26, nameEn: 'Prince George', nameFr: 'Prince George', province: 'bc', lat: 53.92, lon: -122.75, location: 'urban', reliance: 'moderate' },
    { id: 27, nameEn: 'Chicoutimi', nameFr: 'Chicoutimi', province: 'qc', lat: 48.43, lon: -71.07, location: 'urban', reliance: 'moderate' },
    { id: 28, nameEn: 'Rouyn-Noranda', nameFr: 'Rouyn-Noranda', province: 'qc', lat: 48.24, lon: -79.02, location: 'rural', reliance: 'significant' },
    { id: 29, nameEn: 'Sept-Îles', nameFr: 'Sept-Îles', province: 'qc', lat: 50.21, lon: -66.38, location: 'remote', reliance: 'moderate' },
    { id: 30, nameEn: 'Sarnia', nameFr: 'Sarnia', province: 'on', lat: 42.97, lon: -82.41, location: 'urban', reliance: 'significant' },
    { id: 31, nameEn: 'Thunder Bay', nameFr: 'Thunder Bay', province: 'on', lat: 48.38, lon: -89.25, location: 'urban', reliance: 'moderate' },
    { id: 32, nameEn: 'Saint John', nameFr: 'Saint John', province: 'nb', lat: 45.27, lon: -66.06, location: 'urban', reliance: 'moderate' },
    { id: 33, nameEn: 'Brandon', nameFr: 'Brandon', province: 'mb', lat: 49.85, lon: -99.95, location: 'urban', reliance: 'moderate' },
    { id: 34, nameEn: 'Thompson', nameFr: 'Thompson', province: 'mb', lat: 55.74, lon: -97.86, location: 'remote', reliance: 'significant' },
    { id: 35, nameEn: 'Sydney', nameFr: 'Sydney', province: 'ns', lat: 46.14, lon: -60.19, location: 'urban', reliance: 'moderate' },
    { id: 36, nameEn: 'Summerside', nameFr: 'Summerside', province: 'pe', lat: 46.40, lon: -63.79, location: 'urban', reliance: 'moderate' },
    { id: 37, nameEn: 'Whitehorse', nameFr: 'Whitehorse', province: 'yt', lat: 60.72, lon: -135.05, location: 'urban', reliance: 'moderate' },
    { id: 38, nameEn: 'Yellowknife', nameFr: 'Yellowknife', province: 'nt', lat: 62.45, lon: -114.37, location: 'urban', reliance: 'significant' },
    { id: 39, nameEn: 'Rankin Inlet', nameFr: 'Rankin Inlet', province: 'nu', lat: 62.81, lon: -92.08, location: 'remote', reliance: 'moderate' },
    { id: 40, nameEn: 'Edson', nameFr: 'Edson', province: 'ab', lat: 53.58, lon: -116.44, location: 'rural', reliance: 'significant' },
    { id: 41, nameEn: 'Nisku', nameFr: 'Nisku', province: 'ab', lat: 53.34, lon: -113.07, location: 'rural', reliance: 'high' },
    { id: 42, nameEn: 'Unity', nameFr: 'Unity', province: 'sk', lat: 52.43, lon: -109.16, location: 'rural', reliance: 'moderate' },
    { id: 43, nameEn: 'Happy Valley-Goose Bay', nameFr: 'Happy Valley-Goose Bay', province: 'nl', lat: 53.30, lon: -60.33, location: 'remote', reliance: 'significant' },
    { id: 44, nameEn: 'Terrace', nameFr: 'Terrace', province: 'bc', lat: 54.52, lon: -128.60, location: 'rural', reliance: 'moderate' },
    { id: 45, nameEn: 'Val-d\'Or', nameFr: 'Val-d\'Or', province: 'qc', lat: 48.10, lon: -77.80, location: 'rural', reliance: 'significant' },
    { id: 46, nameEn: 'Timmins', nameFr: 'Timmins', province: 'on', lat: 48.48, lon: -81.33, location: 'rural', reliance: 'moderate' },
    { id: 47, nameEn: 'Miramichi', nameFr: 'Miramichi', province: 'nb', lat: 47.00, lon: -65.50, location: 'rural', reliance: 'moderate' },
    { id: 48, nameEn: 'Flin Flon', nameFr: 'Flin Flon', province: 'mb', lat: 54.77, lon: -101.88, location: 'remote', reliance: 'significant' }
];

const toggleFilterValue = (value, setter) => {
    setter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
};

const FILTER_DROPDOWN_WRAP = {
    position: 'relative',
    minWidth: '180px',
    flex: '1 1 180px'
};

const FILTER_BUTTON = {
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
};

const EnergyReliantCommunitiesFilterDropdown = ({ label, filterValues, options, isOpen, setOpen, setFilter, closeOthers, lang }) => {
    const buttonRef = useRef(null);
    const [panelStyle, setPanelStyle] = useState(null);

    const updatePanelPosition = useCallback(() => {
        if (!buttonRef.current) return;
        const rect = buttonRef.current.getBoundingClientRect();
        const maxPanelHeight = 250;
        const gap = 4;
        const spaceBelow = window.innerHeight - rect.bottom - gap;
        const spaceAbove = rect.top - gap;
        const openUpward = spaceBelow < 180 && spaceAbove > spaceBelow;
        const available = openUpward ? spaceAbove : spaceBelow;
        const height = Math.min(maxPanelHeight, Math.max(available, 120));
        setPanelStyle({
            position: 'fixed',
            left: rect.left,
            width: rect.width,
            maxHeight: height,
            top: openUpward ? Math.max(gap, rect.top - gap - height) : rect.bottom + gap,
            overflowY: 'auto',
            backgroundColor: '#fff',
            border: '1px solid #ccc',
            borderRadius: '4px',
            zIndex: 10000,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        });
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        updatePanelPosition();
        window.addEventListener('scroll', updatePanelPosition, true);
        window.addEventListener('resize', updatePanelPosition);
        return () => {
            window.removeEventListener('scroll', updatePanelPosition, true);
            window.removeEventListener('resize', updatePanelPosition);
        };
    }, [isOpen, updatePanelPosition, options.length]);

    const handleToggleOpen = () => {
        if (isOpen) {
            setPanelStyle(null);
            setOpen(false);
        } else {
            closeOthers();
            setOpen(true);
        }
    };

    const panel = isOpen && panelStyle && typeof document !== 'undefined' ? createPortal(
        <div className="energy-reliant-communities-filter-panel" style={panelStyle} role="listbox" aria-label={label}>
            <label
                style={{ display: 'flex', alignItems: 'center', padding: '6px 8px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', borderBottom: '2px solid #ddd', backgroundColor: '#f9f9f9' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f0f0f0'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f9f9f9'; }}
            >
                <input type="checkbox" checked={filterValues.length === 0} onChange={() => setFilter([])} style={{ marginRight: '8px' }} />
                <span>{lang === 'en' ? 'All' : 'Tous'}</span>
            </label>
            {options.map(opt => (
                <label
                    key={opt.value}
                    style={{ display: 'flex', alignItems: 'center', padding: '6px 8px', cursor: 'pointer', fontSize: '11px', borderBottom: '1px solid #eee' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f0f0f0'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fff'; }}
                >
                    <input
                        type="checkbox"
                        checked={filterValues.includes(opt.value)}
                        onChange={() => toggleFilterValue(opt.value, setFilter)}
                        style={{ marginRight: '8px' }}
                    />
                    <span>{opt.label}</span>
                </label>
            ))}
        </div>,
        document.body
    ) : null;

    return (
        <div className="energy-reliant-communities-filter-dropdown" style={FILTER_DROPDOWN_WRAP}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>{label}</label>
            <button
                type="button"
                ref={buttonRef}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                onClick={handleToggleOpen}
                style={FILTER_BUTTON}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {filterValues.length === 0
                        ? (lang === 'en' ? 'All' : 'Tous')
                        : `${filterValues.length} ${lang === 'en' ? 'selected' : 'sélectionné(s)'}`}
                </span>
                <span style={{ marginLeft: '4px' }}>{isOpen ? '▲' : '▼'}</span>
            </button>
            {panel}
        </div>
    );
};

const useTableScrollSync = (isOpen, windowWidth, topScrollRef, tableScrollRef) => {
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
            if (topSpacer) topSpacer.style.width = `${scrollWidth}px`;
            topScroll.style.display = scrollWidth > containerWidth ? 'block' : 'none';
            topScroll.style.opacity = scrollWidth > containerWidth ? '1' : '0';
        };

        const handleTopScroll = () => {
            if (tableScroll.scrollLeft !== topScroll.scrollLeft) tableScroll.scrollLeft = topScroll.scrollLeft;
        };
        const handleTableScroll = () => {
            if (topScroll.scrollLeft !== tableScroll.scrollLeft) topScroll.scrollLeft = tableScroll.scrollLeft;
        };

        topScroll.addEventListener('scroll', handleTopScroll);
        tableScroll.addEventListener('scroll', handleTableScroll);
        const observer = new ResizeObserver(() => window.requestAnimationFrame(syncScrollbars));
        const tableEl = tableScroll.querySelector('table');
        if (tableEl) observer.observe(tableEl);
        observer.observe(tableScroll);
        syncScrollbars();

        return () => {
            topScroll.removeEventListener('scroll', handleTopScroll);
            tableScroll.removeEventListener('scroll', handleTableScroll);
            observer.disconnect();
        };
    }, [isOpen, windowWidth, topScrollRef, tableScrollRef]);
};

const EnergyReliantCommunities = () => {
    const { lang } = useOutletContext();
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [isBarTableOpen, setIsBarTableOpen] = useState(false);
    const [isMapTableOpen, setIsMapTableOpen] = useState(false);
    const [selectedBarPoints, setSelectedBarPoints] = useState(null);
    const [selectedMapIds, setSelectedMapIds] = useState(null);

    const [provinceFilter, setProvinceFilter] = useState([]);
    const [communityFilter, setCommunityFilter] = useState([]);
    const [locationFilter, setLocationFilter] = useState([]);
    const [relianceFilter, setRelianceFilter] = useState([]);
    const [provinceDropdownOpen, setProvinceDropdownOpen] = useState(false);
    const [communityDropdownOpen, setCommunityDropdownOpen] = useState(false);
    const [locationDropdownOpen, setLocationDropdownOpen] = useState(false);
    const [relianceDropdownOpen, setRelianceDropdownOpen] = useState(false);
    const [mapSortColumn, setMapSortColumn] = useState('community');
    const [mapSortDirection, setMapSortDirection] = useState('asc');

    const barChartRef = useRef(null);
    const mapChartRef = useRef(null);
    const barTopScrollRef = useRef(null);
    const barTableScrollRef = useRef(null);
    const mapTopScrollRef = useRef(null);
    const mapTableScrollRef = useRef(null);
    const barLastClickRef = useRef({ time: 0, pointIndex: null });
    const mapLastClickRef = useRef({ time: 0, pointIndex: null });

    const MODEBAR_REMOVE_ALL = [
        'zoom2d', 'pan2d', 'select2d', 'lasso2d', 'zoomIn2d', 'zoomOut2d',
        'autoScale2d', 'resetScale2d', 'hoverClosestCartesian', 'hoverCompareCartesian',
        'toggleSpikelines', 'toImage', 'resetGeo', 'hoverClosestGeo'
    ];

    const hexToRgba = (hex, opacity = 1) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
        return hex;
    };

    const stripHtml = (text) => text ? text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';

    const getProvinceName = useCallback((key) => {
        const info = provinceInfo[key];
        return lang === 'en' ? info.nameEn : info.nameFr;
    }, [lang]);

    const getCommunityName = useCallback((c) => lang === 'en' ? c.nameEn : c.nameFr, [lang]);

    const getLocationLabel = useCallback((key) => getText(`energy_reliant_communities_location_${key}`, lang), [lang]);
    const getRelianceLabel = useCallback((key) => getText(`energy_reliant_communities_reliance_${key}`, lang), [lang]);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (event.target.closest('.energy-reliant-communities-filter-dropdown') || event.target.closest('.energy-reliant-communities-filter-panel')) return;
            setProvinceDropdownOpen(false);
            setCommunityDropdownOpen(false);
            setLocationDropdownOpen(false);
            setRelianceDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useTableScrollSync(isBarTableOpen, windowWidth, barTopScrollRef, barTableScrollRef);
    useTableScrollSync(isMapTableOpen, windowWidth, mapTopScrollRef, mapTableScrollRef);

    const filteredCommunities = useMemo(() => {
        return DEMO_COMMUNITIES.filter(c => {
            if (provinceFilter.length > 0 && !provinceFilter.includes(c.province)) return false;
            if (communityFilter.length > 0 && !communityFilter.includes(c.id)) return false;
            if (locationFilter.length > 0 && !locationFilter.includes(c.location)) return false;
            if (relianceFilter.length > 0 && !relianceFilter.includes(c.reliance)) return false;
            return true;
        });
    }, [provinceFilter, communityFilter, locationFilter, relianceFilter]);

    const effectiveSelectedMapIds = useMemo(() => {
        if (selectedMapIds === null) return null;
        const visibleIds = new Set(filteredCommunities.map(c => c.id));
        const next = selectedMapIds.filter(id => visibleIds.has(id));
        return next.length === 0 ? null : next;
    }, [filteredCommunities, selectedMapIds]);

    useEffect(() => {
        [barChartRef, mapChartRef].forEach(ref => {
            if (!ref?.current) return;
            const plotContainer = ref.current;
            plotContainer.querySelectorAll('.main-svg, .svg-container svg').forEach(svg => svg.setAttribute('aria-hidden', 'true'));
            plotContainer.querySelectorAll('.modebar-btn').forEach(btn => {
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
        });
    }, [lang, selectedBarPoints, effectiveSelectedMapIds, provinceFilter, communityFilter, locationFilter, relianceFilter]);

    const sortedMapTableData = useMemo(() => {
        const sorted = [...filteredCommunities];
        sorted.sort((a, b) => {
            let valA;
            let valB;

            if (mapSortColumn === 'community') {
                valA = getCommunityName(a).toLowerCase();
                valB = getCommunityName(b).toLowerCase();
            } else if (mapSortColumn === 'province') {
                valA = getProvinceName(a.province).toLowerCase();
                valB = getProvinceName(b.province).toLowerCase();
            } else if (mapSortColumn === 'location') {
                valA = getLocationLabel(a.location).toLowerCase();
                valB = getLocationLabel(b.location).toLowerCase();
            } else {
                valA = RELIANCE_ORDER[a.reliance] ?? 99;
                valB = RELIANCE_ORDER[b.reliance] ?? 99;
            }

            if (mapSortColumn === 'reliance') {
                return mapSortDirection === 'asc' ? valA - valB : valB - valA;
            }

            const comparison = valA.localeCompare(valB);
            return mapSortDirection === 'asc' ? comparison : -comparison;
        });
        return sorted;
    }, [filteredCommunities, mapSortColumn, mapSortDirection, getCommunityName, getProvinceName, getLocationLabel]);

    const handleMapTableSort = (column) => {
        if (mapSortColumn === column) {
            setMapSortDirection(mapSortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setMapSortColumn(column);
            setMapSortDirection('asc');
        }
    };

    const mapTableHeaderStyle = {
        padding: '8px',
        textAlign: 'left',
        fontWeight: 'bold',
        borderBottom: '2px solid #ccc',
        border: '1px solid #ddd',
        cursor: 'pointer',
        userSelect: 'none'
    };

    const renderMapSortIndicator = (column) => (
        <span style={{ marginLeft: '4px', opacity: mapSortColumn === column ? 1 : 0.3 }}>
            {mapSortColumn === column ? (mapSortDirection === 'asc' ? '▲' : '▼') : '▲'}
        </span>
    );

    const barLabels = useMemo(() => energy_reliant_communities_BAR_PROVINCES.map(p => getProvinceName(p.key)), [getProvinceName]);
    const barValues = useMemo(() => energy_reliant_communities_BAR_PROVINCES.map(p => p.count), []);

    const barTrace = useMemo(() => {
        const hovertext = energy_reliant_communities_BAR_PROVINCES.map((p, i) => {
            const name = getProvinceName(p.key);
            return `<b>${name}</b><br>${stripHtml(getText('energy_reliant_communities_bar_chart_title', lang))}: ${barValues[i]}`;
        });
        const markerColor = selectedBarPoints === null
            ? BAR_COLOR
            : energy_reliant_communities_BAR_PROVINCES.map((_, i) => selectedBarPoints.includes(i) ? BAR_COLOR : hexToRgba(BAR_COLOR, 0.3));
        return {
            type: 'bar',
            orientation: 'h',
            x: barValues,
            y: barLabels,
            marker: { color: markerColor },
            hovertext,
            hoverinfo: 'text',
            hoverlabel: { bgcolor: '#ffffff', font: { color: '#000000', size: 14, family: 'Arial, sans-serif' } },
            text: barValues.map(String),
            textposition: 'outside',
            textfont: { size: windowWidth <= 480 ? 16 : 20, color: '#666666', family: 'Arial, sans-serif' }
        };
    }, [lang, barLabels, barValues, windowWidth, selectedBarPoints, getProvinceName]);

    const barPlotLayout = useMemo(() => ({
        barmode: 'overlay',
        showlegend: false,
        hovermode: 'closest',
        clickmode: 'event',
        dragmode: false,
        xaxis: {
            range: [0, 100],
            tick0: 0,
            dtick: 20,
            showgrid: true,
            gridcolor: '#cccccc',
            gridwidth: 1,
            zeroline: true,
            fixedrange: true,
            tickfont: { size: windowWidth <= 480 ? 12 : 16, family: 'Arial, sans-serif' },
            automargin: true
        },
        yaxis: {
            autorange: 'reversed',
            showgrid: false,
            fixedrange: true,
            tickfont: { size: windowWidth <= 480 ? 12 : 16, family: 'Arial, sans-serif' },
            automargin: true
        },
        margin: { l: 120, r: 50, t: 20, b: 60 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        autosize: true
    }), [windowWidth]);

    const mapScale = 2.5;
    const mapHeight = windowWidth <= 384 ? 280 : windowWidth <= 480 ? 340 : windowWidth <= 640 ? 400 : windowWidth <= 768 ? 480 : windowWidth <= 1100 ? 560 : 620;

    const plotlyMapData = useMemo(() => {
        const geoJsonNames = provinceCodes.map(code => provinceInfo[code].geoJsonName);
        const provinceFill = '#474747';
        const choroplethTrace = {
            type: 'choropleth',
            locationmode: 'geojson-id',
            geojson: 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/canada.geojson',
            featureidkey: 'properties.name',
            locations: geoJsonNames,
            z: provinceCodes.map((_, idx) => idx),
            text: provinceCodes.map(code => getProvinceName(code)),
            hoverinfo: 'text',
            hoverlabel: { bgcolor: '#ffffff', bordercolor: '#000000', font: { color: '#000000', size: 12, family: 'Arial, sans-serif' } },
            colorscale: geoJsonNames.map((_, idx) => [idx / (geoJsonNames.length - 1), provinceFill]),
            showscale: false,
            marker: { line: { color: 'white', width: 1 } }
        };

        const isSelected = (id) => effectiveSelectedMapIds === null || effectiveSelectedMapIds.includes(id);
        const markerColors = filteredCommunities.map(c => {
            const base = RELIANCE_COLORS[c.reliance];
            return isSelected(c.id) ? base : hexToRgba(base, 0.3);
        });

        const scatterTrace = {
            type: 'scattergeo',
            mode: 'markers',
            lat: filteredCommunities.map(c => c.lat),
            lon: filteredCommunities.map(c => c.lon),
            marker: { size: 8, color: markerColors, line: { color: '#ffffff', width: 0.5 } },
            hoverinfo: 'text',
            hovertext: filteredCommunities.map(c =>
                `<b>${getCommunityName(c)}</b><br>` +
                `${getText('energy_reliant_communities_filter_province', lang)}: ${getProvinceName(c.province)}<br>` +
                `${getText('energy_reliant_communities_filter_location', lang)}: ${getLocationLabel(c.location)}<br>` +
                `${getText('energy_reliant_communities_filter_reliance', lang)}: ${getRelianceLabel(c.reliance)}`
            ),
            hoverlabel: { bgcolor: '#ffffff', bordercolor: '#333333', font: { color: '#000000', size: 12, family: 'Arial, sans-serif' } },
            showlegend: false,
            customdata: filteredCommunities.map(c => c.id)
        };

        return [choroplethTrace, scatterTrace];
    }, [lang, filteredCommunities, effectiveSelectedMapIds, getProvinceName, getCommunityName, getLocationLabel, getRelianceLabel]);

    const handleBarClick = (data) => {
        if (!data.points || data.points.length === 0) return;
        const pointIndex = data.points[0].pointIndex;
        if (windowWidth <= 768) {
            const currentTime = Date.now();
            const last = barLastClickRef.current;
            const isDoubleTap = pointIndex === last.pointIndex && (currentTime - last.time < 300);
            barLastClickRef.current = { time: currentTime, pointIndex };
            if (!isDoubleTap) return;
        }
        setSelectedBarPoints(prev => {
            if (prev === null) return [pointIndex];
            const isSelected = prev.includes(pointIndex);
            if (isSelected) {
                const next = prev.filter(i => i !== pointIndex);
                return next.length === 0 ? null : next;
            }
            return [...prev, pointIndex];
        });
    };

    const handleMapClick = (data) => {
        if (!data.points || data.points.length === 0) return;
        if (data.points[0].curveNumber !== 1) return;
        const pointIndex = data.points[0].pointIndex;
        const communityId = filteredCommunities[pointIndex]?.id;
        if (communityId === undefined) return;

        if (windowWidth <= 768) {
            const currentTime = Date.now();
            const last = mapLastClickRef.current;
            const isDoubleTap = pointIndex === last.pointIndex && (currentTime - last.time < 300);
            mapLastClickRef.current = { time: currentTime, pointIndex };
            if (!isDoubleTap) return;
        }

        setSelectedMapIds(prev => {
            if (prev === null) return [communityId];
            const isSelected = prev.includes(communityId);
            if (isSelected) {
                const next = prev.filter(id => id !== communityId);
                return next.length === 0 ? null : next;
            }
            return [...prev, communityId];
        });
    };

    const downloadChartWithTitle = async (chartRef, titleKey, filenameEn, filenameFr, height = 520) => {
        const plotElement = chartRef?.current?.querySelector('.js-plotly-plot');
        if (!plotElement || !window.Plotly) return;
        try {
            const title = stripHtml(getText(titleKey, lang));
            const imgData = await window.Plotly.toImage(plotElement, { format: 'png', width: 1000, height, scale: 2 });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                const titleHeight = 50;
                canvas.width = img.width;
                canvas.height = img.height + titleHeight;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#333333';
                ctx.font = 'bold 20px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(title, canvas.width / 2, 35);
                ctx.drawImage(img, 0, titleHeight);
                const link = document.createElement('a');
                link.download = lang === 'en' ? filenameEn : filenameFr;
                link.href = canvas.toDataURL('image/png');
                link.click();
            };
            img.src = imgData;
        } catch (e) {
            console.error(e);
        }
    };

    const downloadMapWithTitleAndLegend = async () => {
        const plotElement = mapChartRef?.current?.querySelector('.js-plotly-plot');
        if (!plotElement || !window.Plotly) return;
        try {
            const title = stripHtml(getText('energy_reliant_communities_map_title', lang));
            const imgData = await window.Plotly.toImage(plotElement, { format: 'png', width: 1000, height: mapHeight, scale: 2 });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                const titleHeight = 50;
                const legendHeight = 50;
                canvas.width = img.width;
                canvas.height = img.height + titleHeight + legendHeight;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#333333';
                ctx.font = 'bold 20px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(title, canvas.width / 2, 35);
                ctx.drawImage(img, 0, titleHeight);

                const legendItems = relianceKeys.map(key => ({
                    color: RELIANCE_COLORS[key],
                    label: getRelianceLabel(key)
                }));
                const legendY = titleHeight + img.height + 32;
                ctx.font = '16px Arial';
                const totalLegendWidth = legendItems.reduce((sum, item) => sum + ctx.measureText(item.label).width + 36, 0);
                let legendX = (canvas.width - totalLegendWidth) / 2;
                legendItems.forEach(item => {
                    ctx.beginPath();
                    ctx.arc(legendX + 7, legendY, 7, 0, Math.PI * 2);
                    ctx.fillStyle = item.color;
                    ctx.fill();
                    ctx.fillStyle = '#333333';
                    ctx.textAlign = 'left';
                    ctx.fillText(item.label, legendX + 20, legendY + 5);
                    legendX += ctx.measureText(item.label).width + 36;
                });

                const link = document.createElement('a');
                link.download = lang === 'en' ? 'energy_reliant_communities_map.png' : 'carte_communautes_dependantes_energie.png';
                link.href = canvas.toDataURL('image/png');
                link.click();
            };
            img.src = imgData;
        } catch (e) {
            console.error(e);
        }
    };

    const barConfig = {
        displayModeBar: true,
        displaylogo: false,
        responsive: true,
        scrollZoom: false,
        doubleClick: false,
        modeBarButtonsToRemove: MODEBAR_REMOVE_ALL,
        modeBarButtonsToAdd: [{
            name: lang === 'en' ? 'Download chart as PNG' : 'Télécharger le graphique en PNG',
            icon: { width: 24, height: 24, path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z' },
            click: () => downloadChartWithTitle(barChartRef, 'energy_reliant_communities_bar_chart_title', 'energy_reliant_communities_by_province.png', 'communautes_dependantes_energie_par_province.png')
        }]
    };

    const mapConfig = {
        displayModeBar: true,
        displaylogo: false,
        responsive: true,
        scrollZoom: false,
        doubleClick: false,
        modeBarButtonsToRemove: MODEBAR_REMOVE_ALL,
        modeBarButtonsToAdd: [{
            name: lang === 'en' ? 'Download chart as PNG' : 'Télécharger le graphique en PNG',
            icon: { width: 24, height: 24, path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z' },
            click: () => downloadMapWithTitleAndLegend()
        }]
    };

    const downloadBarCSV = () => {
        const headers = [getText('energy_reliant_communities_table_province', lang), getText('energy_reliant_communities_table_count', lang)];
        const rows = energy_reliant_communities_BAR_PROVINCES.map(p => [getProvinceName(p.key), p.count]);
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = lang === 'en' ? 'energy_reliant_communities_by_province.csv' : 'communautes_dependantes_energie_par_province.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const downloadBarDocx = async () => {
        const title = stripHtml(getText('energy_reliant_communities_title', lang));
        const headerCells = [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: getText('energy_reliant_communities_table_province', lang), bold: true, size: 22 })], alignment: AlignmentType.CENTER })], shading: { fill: 'E6E6E6' } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: getText('energy_reliant_communities_table_count', lang), bold: true, size: 22 })], alignment: AlignmentType.CENTER })], shading: { fill: 'E6E6E6' } })
        ];
        const dataRows = energy_reliant_communities_BAR_PROVINCES.map(p => new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: getProvinceName(p.key), size: 22 })], alignment: AlignmentType.LEFT })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(p.count), size: 22 })], alignment: AlignmentType.CENTER })] })
            ]
        }));
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
                    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [4500, 2500], rows: [new TableRow({ children: headerCells }), ...dataRows] })
                ]
            }]
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'energy_reliant_communities_by_province.docx' : 'communautes_dependantes_energie_par_province.docx');
    };

    const downloadMapCSV = () => {
        const headers = [
            getText('energy_reliant_communities_table_community', lang),
            getText('energy_reliant_communities_table_province', lang),
            getText('energy_reliant_communities_filter_location', lang),
            getText('energy_reliant_communities_filter_reliance', lang)
        ];
        const rows = sortedMapTableData.map(c => [
            getCommunityName(c),
            getProvinceName(c.province),
            getLocationLabel(c.location),
            getRelianceLabel(c.reliance)
        ]);
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = lang === 'en' ? 'energy_reliant_communities_map.csv' : 'carte_communautes_dependantes_energie.csv';
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const downloadMapDocx = async () => {
        const title = stripHtml(getText('energy_reliant_communities_map_title', lang));
        const headers = [
            getText('energy_reliant_communities_table_community', lang),
            getText('energy_reliant_communities_table_province', lang),
            getText('energy_reliant_communities_filter_location', lang),
            getText('energy_reliant_communities_filter_reliance', lang)
        ];
        const headerRow = new TableRow({
            children: headers.map(h => new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20 })], alignment: AlignmentType.CENTER })],
                shading: { fill: 'E6E6E6' }
            }))
        });
        const dataRows = sortedMapTableData.map(c => new TableRow({
            children: [
                getCommunityName(c),
                getProvinceName(c.province),
                getLocationLabel(c.location),
                getRelianceLabel(c.reliance)
            ].map((text, i) => new TableCell({
                children: [new Paragraph({
                    children: [new TextRun({ text, size: 18 })],
                    alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.CENTER
                })]
            }))
        }));
        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        columnWidths: [2800, 2200, 2000, 2200],
                        rows: [headerRow, ...dataRows]
                    })
                ]
            }]
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, lang === 'en' ? 'energy_reliant_communities_map.docx' : 'carte_communautes_dependantes_energie.docx');
    };

    const clearAllFilters = () => {
        setProvinceFilter([]);
        setCommunityFilter([]);
        setLocationFilter([]);
        setRelianceFilter([]);
        setMapSortColumn('community');
        setMapSortDirection('asc');
        setSelectedMapIds(null);
        setProvinceDropdownOpen(false);
        setCommunityDropdownOpen(false);
        setLocationDropdownOpen(false);
        setRelianceDropdownOpen(false);
    };

    const getBarChartSummary = () => {
        const parts = energy_reliant_communities_BAR_PROVINCES.map((p, i) => `${getProvinceName(p.key)}: ${barValues[i]}`).join(', ');
        return `${stripHtml(getText('energy_reliant_communities_bar_chart_title', lang))}. ${parts}.`;
    };

    const getMapChartSummary = () => {
        return `${stripHtml(getText('energy_reliant_communities_map_title', lang))}. ${filteredCommunities.length} ${lang === 'en' ? 'communities shown.' : 'communautés affichées.'}`;
    };

    const closeOtherFilterDropdowns = (except) => {
        if (except !== 'community') setCommunityDropdownOpen(false);
        if (except !== 'province') setProvinceDropdownOpen(false);
        if (except !== 'location') setLocationDropdownOpen(false);
        if (except !== 'reliance') setRelianceDropdownOpen(false);
    };

    const provinceOptions = useMemo(() => filterProvinceKeys.map(key => ({ value: key, label: getProvinceName(key) })), [getProvinceName]);
    const communityOptions = useMemo(() =>
        [...DEMO_COMMUNITIES]
            .sort((a, b) => getCommunityName(a).localeCompare(getCommunityName(b), lang === 'en' ? 'en-CA' : 'fr-CA'))
            .map(c => ({ value: c.id, label: getCommunityName(c) })),
        [lang, getCommunityName]
    );
    const locationOptions = useMemo(() => locationKeys.map(key => ({ value: key, label: getLocationLabel(key) })), [getLocationLabel]);
    const relianceOptions = useMemo(() => relianceKeys.map(key => ({ value: key, label: getRelianceLabel(key) })), [getRelianceLabel]);

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-46"
            role="main"
            aria-labelledby="energy-reliant-communities-title"
            style={{ backgroundColor: '#ffffff', overflow: 'visible' }}
        >
            <style>{`
.page-46 { width: 100%; overflow: visible !important; }
.energy-reliant-communities-container { width: 100%; padding: 15px 0 40px 0; display: flex; flex-direction: column; box-sizing: border-box; overflow: visible; }
.energy-reliant-communities-title {
    font-family: 'Lato', sans-serif;
    font-size: 50px;
    font-weight: bold;
    color: #a0346e;
    margin: 0 0 24px 0;
    line-height: 1.2;
    position: relative;
    padding-bottom: 0.5em;
    text-transform: none;
}
.energy-reliant-communities-title::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0.2em;
    width: 72px;
    height: 6px;
    background-color: var(--gc-red);
}
.energy-reliant-communities-intro {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    line-height: 1.5;
    color: var(--gc-text);
    margin-top: 0;
    margin-bottom: 20px;
}
.energy-reliant-communities-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 20px;
    box-sizing: border-box;
    overflow: visible;
}
.energy-reliant-communities-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 15px 0;
    text-align: center;
}
.energy-reliant-communities-map-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    margin: 0 0 15px 0;
    text-align: center;
}
.energy-reliant-communities-bar-chart { width: 100%; height: 420px; }
.energy-reliant-communities-map-chart { width: 100%; overflow: hidden; position: relative; }
.energy-reliant-communities-filter-region { position: relative; overflow: visible; margin-bottom: 0; }
.energy-reliant-communities-filter-dropdowns { display: flex; flex-wrap: wrap; gap: 10px; overflow: visible; position: relative; }
.energy-reliant-communities-map-legend {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 20px;
    margin: 15px 0 5px 0;
    padding: 10px 0;
}
.energy-reliant-communities-legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: Arial, sans-serif;
    font-size: 16px;
    color: #333;
}
.energy-reliant-communities-legend-dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    flex-shrink: 0;
}
.energy-reliant-communities-table-wrapper { display: block; width: 100%; margin: 20px 0 0 0; }
.energy-reliant-communities-table-wrapper details > summary {
    display: block;
    width: 100%;
    padding: 12px 15px;
    background-color: #8C8C8C;
    border: 1px solid #404040;
    border-radius: 4px;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-weight: bold;
    color: #ffffff;
    list-style: none;
}
.energy-reliant-communities-table-wrapper details > summary::-webkit-details-marker { display: none; }
.energy-reliant-communities-table-wrapper details > summary:hover,
.energy-reliant-communities-table-wrapper button[type="button"]:hover,
.energy-reliant-communities-chart-frame button[type="button"]:hover { background-color: #404040 !important; }
.energy-reliant-communities-table-wrapper .table-responsive { display: block; width: 100%; overflow-x: auto; border: 1px solid #ddd; background: #fff; }
.energy-reliant-communities-table-wrapper .table-responsive table { width: max-content; min-width: 100%; border-collapse: collapse; }
@media (max-width: 768px) {
    .energy-reliant-communities-title { font-size: 37px; }
    .energy-reliant-communities-chart-title, .energy-reliant-communities-map-title { font-size: 26px; }
    .energy-reliant-communities-intro { font-size: 18px; }
    .energy-reliant-communities-bar-chart { height: 380px; }
}
            `}</style>

            <div className="energy-reliant-communities-container">
                <header role="region" aria-label={getText('energy_reliant_communities_title', lang)}>
                    <h1 id="energy-reliant-communities-title" className="energy-reliant-communities-title">{getText('energy_reliant_communities_title', lang)}</h1>
                </header>

                <p className="energy-reliant-communities-intro" role="region" aria-label={stripHtml(getText('energy_reliant_communities_para1', lang))}>
                    {getText('energy_reliant_communities_para1', lang)}
                </p>
                <p className="energy-reliant-communities-intro" role="region" aria-label={stripHtml(getText('energy_reliant_communities_para2_part1', lang) + getText('energy_reliant_communities_para2_bold1', lang) + getText('energy_reliant_communities_para2_part2', lang) + getText('energy_reliant_communities_para2_bold2', lang))}>
                    {getText('energy_reliant_communities_para2_part1', lang)}<strong>{getText('energy_reliant_communities_para2_bold1', lang)}</strong>{getText('energy_reliant_communities_para2_part2', lang)}<strong>{getText('energy_reliant_communities_para2_bold2', lang)}</strong>
                </p>

                <div className="energy-reliant-communities-chart-frame">
                    <h2 className="energy-reliant-communities-chart-title">{getText('energy_reliant_communities_bar_chart_title', lang)}</h2>
                    <div role="region" aria-label={getBarChartSummary()} tabIndex="0">
                        <figure ref={barChartRef} className="energy-reliant-communities-bar-chart" style={{ margin: 0, position: 'relative' }}>
                            {selectedBarPoints !== null && (
                                <div style={{ marginBottom: 8 }}>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedBarPoints(null)}
                                        style={{ padding: '6px 12px', backgroundColor: '#8C8C8C', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontSize: 14, color: '#fff' }}
                                    >
                                        {lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}
                                    </button>
                                </div>
                            )}
                            <Plot
                                data={[barTrace]}
                                layout={barPlotLayout}
                                config={barConfig}
                                style={{ width: '100%', height: '100%' }}
                                useResizeHandler={true}
                                onClick={handleBarClick}
                            />
                        </figure>
                    </div>
                    <div className="energy-reliant-communities-table-wrapper">
                        <details onToggle={(e) => setIsBarTableOpen(e.currentTarget.open)}>
                            <summary role="button" aria-expanded={isBarTableOpen}>
                                <span aria-hidden="true" style={{ marginRight: '8px' }}>{isBarTableOpen ? '▼' : '▶'}</span>
                                {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                            </summary>
                            <div ref={barTopScrollRef} style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden', marginBottom: 0, display: windowWidth <= 768 ? 'none' : 'block' }} aria-hidden="true">
                                <div style={{ height: '20px' }} />
                            </div>
                            <div ref={barTableScrollRef} className="table-responsive" role="region" style={{ borderTop: 'none', padding: '15px' }} tabIndex="0">
                                <table className="table table-striped table-hover">
                                    <caption className="wb-inv">{getText('energy_reliant_communities_bar_chart_title', lang)}</caption>
                                    <thead>
                                        <tr>
                                            <th scope="col" style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #ddd' }}>{getText('energy_reliant_communities_table_province', lang)}</th>
                                            <th scope="col" style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #ddd', textAlign: 'center' }}>{getText('energy_reliant_communities_table_count', lang)}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {energy_reliant_communities_BAR_PROVINCES.map(p => (
                                            <tr key={p.key}>
                                                <th scope="row" style={{ fontWeight: 'bold', padding: '8px', border: '1px solid #ddd' }}>{getProvinceName(p.key)}</th>
                                                <td style={{ textAlign: 'center', padding: '8px', border: '1px solid #ddd' }}>{p.count}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '15px' }}>
                                    <button type="button" onClick={downloadBarCSV} style={{ padding: '8px 16px', backgroundColor: '#8C8C8C', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', color: '#ffffff' }}>
                                        {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
                                    </button>
                                    <button type="button" onClick={downloadBarDocx} style={{ padding: '8px 16px', backgroundColor: '#8C8C8C', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', color: '#ffffff' }}>
                                        {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
                                    </button>
                                </div>
                            </div>
                        </details>
                    </div>
                </div>

                <div className="energy-reliant-communities-chart-frame">
                    <h2 className="energy-reliant-communities-map-title">{getText('energy_reliant_communities_map_title', lang)}</h2>
                    <div role="region" aria-label={getMapChartSummary()} tabIndex="0">
                        <figure ref={mapChartRef} className="energy-reliant-communities-map-chart" style={{ margin: 0, position: 'relative', height: mapHeight, overflow: 'hidden' }}>
                            {effectiveSelectedMapIds !== null && (
                                <div style={{ marginBottom: 8 }}>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedMapIds(null)}
                                        style={{ padding: '6px 12px', backgroundColor: '#8C8C8C', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontSize: 14, color: '#fff' }}
                                    >
                                        {lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}
                                    </button>
                                </div>
                            )}
                            <Plot
                                data={plotlyMapData}
                                layout={{
                                    geo: {
                                        scope: 'north america',
                                        projection: { type: 'conic conformal', parallels: [50, 70], rotation: { lon: -96 }, scale: mapScale },
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
                                config={mapConfig}
                                style={{ width: '100%', height: mapHeight }}
                                useResizeHandler={false}
                                onClick={handleMapClick}
                            />
                        </figure>
                    </div>
                    <div className="energy-reliant-communities-map-legend" aria-hidden="true">
                        {relianceKeys.map(key => (
                            <div key={key} className="energy-reliant-communities-legend-item">
                                <span className="energy-reliant-communities-legend-dot" style={{ backgroundColor: RELIANCE_COLORS[key] }} />
                                <span>{getRelianceLabel(key)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div
                    className="energy-reliant-communities-filter-region"
                    role="region"
                    aria-label={lang === 'en' ? 'Filter controls for communities map' : 'Contrôles de filtre pour la carte des communautés'}
                >
                    <h3 className="wb-inv">{lang === 'en' ? 'Filter area - Use the controls below to filter the communities map' : 'Zone de filtre - Utilisez les contrôles ci-dessous pour filtrer la carte des communautés'}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '20px', marginBottom: '5px', padding: '8px 10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                        <button
                            type="button"
                            onClick={clearAllFilters}
                            style={{ padding: '6px 12px', fontSize: '11px', backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' }}
                        >
                            {lang === 'en' ? 'Clear filters' : 'Effacer filtres'}
                        </button>
                        <span style={{ fontSize: '11px', color: '#666', marginLeft: 'auto' }}>
                            {lang === 'en'
                                ? `Showing ${filteredCommunities.length} of ${DEMO_COMMUNITIES.length} communities`
                                : `Affichage de ${filteredCommunities.length} sur ${DEMO_COMMUNITIES.length} communautés`}
                        </span>
                    </div>
                    <div className="energy-reliant-communities-filter-dropdowns" style={{ marginBottom: '0', padding: '10px', backgroundColor: '#fafafa', borderRadius: '4px', border: '1px solid #e0e0e0' }}>
                        <EnergyReliantCommunitiesFilterDropdown
                            label={getText('energy_reliant_communities_filter_community', lang)}
                            filterValues={communityFilter}
                            options={communityOptions}
                            isOpen={communityDropdownOpen}
                            setOpen={setCommunityDropdownOpen}
                            setFilter={setCommunityFilter}
                            closeOthers={() => closeOtherFilterDropdowns('community')}
                            lang={lang}
                        />
                        <EnergyReliantCommunitiesFilterDropdown
                            label={getText('energy_reliant_communities_filter_province', lang)}
                            filterValues={provinceFilter}
                            options={provinceOptions}
                            isOpen={provinceDropdownOpen}
                            setOpen={setProvinceDropdownOpen}
                            setFilter={setProvinceFilter}
                            closeOthers={() => closeOtherFilterDropdowns('province')}
                            lang={lang}
                        />
                        <EnergyReliantCommunitiesFilterDropdown
                            label={getText('energy_reliant_communities_filter_location', lang)}
                            filterValues={locationFilter}
                            options={locationOptions}
                            isOpen={locationDropdownOpen}
                            setOpen={setLocationDropdownOpen}
                            setFilter={setLocationFilter}
                            closeOthers={() => closeOtherFilterDropdowns('location')}
                            lang={lang}
                        />
                        <EnergyReliantCommunitiesFilterDropdown
                            label={getText('energy_reliant_communities_filter_reliance', lang)}
                            filterValues={relianceFilter}
                            options={relianceOptions}
                            isOpen={relianceDropdownOpen}
                            setOpen={setRelianceDropdownOpen}
                            setFilter={setRelianceFilter}
                            closeOthers={() => closeOtherFilterDropdowns('reliance')}
                            lang={lang}
                        />
                    </div>
                </div>

                <div className="energy-reliant-communities-table-wrapper">
                    <details onToggle={(e) => setIsMapTableOpen(e.currentTarget.open)}>
                        <summary role="button" aria-expanded={isMapTableOpen}>
                            <span aria-hidden="true" style={{ marginRight: '8px' }}>{isMapTableOpen ? '▼' : '▶'}</span>
                            {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                            <span className="wb-inv">{lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}</span>
                        </summary>
                        <div ref={mapTopScrollRef} style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden', marginBottom: 0, display: windowWidth <= 768 ? 'none' : 'block' }} aria-hidden="true">
                            <div style={{ height: '20px' }} />
                        </div>
                        <div ref={mapTableScrollRef} className="table-responsive" role="region" style={{ borderTop: 'none', padding: '15px' }} tabIndex="0">
                            <table className="table table-striped table-hover" style={{ fontSize: '11px' }}>
                                <caption className="wb-inv">
                                    {lang === 'en'
                                        ? 'Energy reliant communities including community name, province, location type, and energy reliance level. Click column headers to sort.'
                                        : "Communautés dépendantes de l'énergie incluant le nom de la communauté, la province, le type d'emplacement et le niveau de dépendance à l'énergie. Cliquez sur les en-têtes de colonne pour trier."}
                                </caption>
                                <thead>
                                    <tr style={{ backgroundColor: '#e6e6e6' }}>
                                        <th
                                            scope="col"
                                            style={mapTableHeaderStyle}
                                            onClick={() => handleMapTableSort('community')}
                                            aria-sort={mapSortColumn === 'community' ? (mapSortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                                        >
                                            {getText('energy_reliant_communities_table_community', lang)}
                                            {renderMapSortIndicator('community')}
                                        </th>
                                        <th
                                            scope="col"
                                            style={mapTableHeaderStyle}
                                            onClick={() => handleMapTableSort('province')}
                                            aria-sort={mapSortColumn === 'province' ? (mapSortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                                        >
                                            {getText('energy_reliant_communities_table_province', lang)}
                                            {renderMapSortIndicator('province')}
                                        </th>
                                        <th
                                            scope="col"
                                            style={mapTableHeaderStyle}
                                            onClick={() => handleMapTableSort('location')}
                                            aria-sort={mapSortColumn === 'location' ? (mapSortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                                        >
                                            {getText('energy_reliant_communities_filter_location', lang)}
                                            {renderMapSortIndicator('location')}
                                        </th>
                                        <th
                                            scope="col"
                                            style={mapTableHeaderStyle}
                                            onClick={() => handleMapTableSort('reliance')}
                                            aria-sort={mapSortColumn === 'reliance' ? (mapSortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                                        >
                                            {getText('energy_reliant_communities_filter_reliance', lang)}
                                            {renderMapSortIndicator('reliance')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedMapTableData.map(c => (
                                        <tr key={c.id}>
                                            <th scope="row" style={{ fontWeight: 'bold', padding: '8px', border: '1px solid #ddd' }}>{getCommunityName(c)}</th>
                                            <td style={{ padding: '8px', border: '1px solid #ddd' }}>{getProvinceName(c.province)}</td>
                                            <td style={{ padding: '8px', border: '1px solid #ddd' }}>{getLocationLabel(c.location)}</td>
                                            <td style={{ padding: '8px', border: '1px solid #ddd' }}>{getRelianceLabel(c.reliance)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '15px' }}>
                                <button type="button" onClick={downloadMapCSV} style={{ padding: '8px 16px', backgroundColor: '#8C8C8C', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', color: '#ffffff' }}>
                                    {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
                                </button>
                                <button type="button" onClick={downloadMapDocx} style={{ padding: '8px 16px', backgroundColor: '#8C8C8C', border: '1px solid #404040', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', color: '#ffffff' }}>
                                    {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
                                </button>
                            </div>
                        </div>
                    </details>
                </div>
            </div>
        </main>
    );
};

export default EnergyReliantCommunities;
