import React, { useState, useEffect, useMemo, useRef, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import useWindowWidth from '../hooks/useWindowWidth';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getText } from '../utils/translations';
import { getEnergyReliantCommunitiesData } from '../utils/dataLoader';
import { stripHtml } from '../utils/stripHtml';
import hexToRgba from '../utils/hexToRgba';

const BAR_COLOR = '#9f346d';

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

const roundHalfUp = (value, decimals) => {
    const factor = 10 ** decimals;
    return Math.sign(value) * Math.round((Math.abs(value) * factor) + 1e-10) / factor;
};

const formatCount = (value, lang) => {
    if (!Number.isFinite(Number(value))) return '—';
    return Math.abs(roundHalfUp(Number(value), 0)).toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA', { maximumFractionDigits: 0 });
};

const formatShare = (value, lang) => {
    if (!Number.isFinite(Number(value))) return '—';
    const text = Math.abs(roundHalfUp(Number(value), 0)).toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA', { maximumFractionDigits: 0 });
    return lang === 'fr' ? `${text} %` : `${text}%`;
};

const fillText = (key, lang, vars) => {
    let text = getText(key, lang);
    Object.entries(vars).forEach(([name, value]) => {
        text = text.split(`{{${name}}}`).join(String(value));
    });
    return text;
};

const toggleFilterValue = (value, setter) => {
    setter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
};

function getTabbables() {
    return [...document.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )].filter((el) => {
        if (el.getAttribute('aria-hidden') === 'true') return false;
        if (el.closest('[aria-hidden="true"]')) return false;
        const style = window.getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none') return false;
        return el.getClientRects().length > 0;
    });
}

function focusAdjacentTo(el, direction) {
    if (!el) return;
    const tabbables = getTabbables();
    const index = tabbables.indexOf(el);
    if (index < 0) return;
    const next = tabbables[index + direction];
    next?.focus();
}

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
    const reactId = useId().replace(/:/g, '');
    const buttonId = `erc-filter-btn-${reactId}`;
    const panelId = `erc-filter-panel-${reactId}`;
    const buttonRef = useRef(null);
    const panelRef = useRef(null);
    const [panelStyle, setPanelStyle] = useState(null);
    const [statusMessage, setStatusMessage] = useState('');

    const allLabel = lang === 'en' ? 'All' : 'Tous';
    const valueText = filterValues.length === 0
        ? allLabel
        : `${filterValues.length} ${lang === 'en' ? 'selected' : 'sélectionné(s)'}`;

    const buttonAriaLabel = lang === 'en'
        ? `${label} dropdown, ${valueText}`
        : `Liste déroulante ${label}, ${valueText}`;

    const announceCheckboxChange = useCallback((itemLabel, nextChecked) => {
        const message = lang === 'en'
            ? `${itemLabel} checkbox ${nextChecked ? 'checked' : 'unchecked'}`
            : `${itemLabel} case à cocher ${nextChecked ? 'cochée' : 'décochée'}`;
        // Retrigger live region even when the same option is toggled twice.
        setStatusMessage('');
        window.requestAnimationFrame(() => setStatusMessage(message));
    }, [lang]);

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
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        });
    }, []);

    const closePanel = useCallback((options = {}) => {
        const { restoreFocus = true } = options;
        setPanelStyle(null);
        setOpen(false);
        setStatusMessage('');
        if (restoreFocus) {
            requestAnimationFrame(() => buttonRef.current?.focus());
        }
    }, [setOpen]);

    useEffect(() => {
        if (!isOpen) return undefined;
        updatePanelPosition();
        window.addEventListener('scroll', updatePanelPosition, true);
        window.addEventListener('resize', updatePanelPosition);
        return () => {
            window.removeEventListener('scroll', updatePanelPosition, true);
            window.removeEventListener('resize', updatePanelPosition);
        };
    }, [isOpen, updatePanelPosition, options.length]);

    // Panel is portaled to document.body — move focus into it and trap Tab/Escape.
    useEffect(() => {
        if (!isOpen || !panelStyle) return undefined;

        const focusFirst = () => {
            const first = panelRef.current?.querySelector('input[type="checkbox"]');
            first?.focus();
        };
        const focusTimer = window.setTimeout(focusFirst, 0);

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                closePanel();
                return;
            }

            // Native checkboxes toggle with Space; Enter is expected here for SR users.
            if (event.key === 'Enter') {
                const active = document.activeElement;
                if (
                    active instanceof HTMLInputElement
                    && active.type === 'checkbox'
                    && panelRef.current?.contains(active)
                ) {
                    event.preventDefault();
                    event.stopPropagation();
                    active.click();
                }
                return;
            }

            // Tab should leave the dropdown (unlike a modal dialog focus trap).
            if (event.key === 'Tab' && panelRef.current) {
                const focusables = [...panelRef.current.querySelectorAll('input[type="checkbox"]')];
                if (!focusables.length) return;
                const first = focusables[0];
                const last = focusables[focusables.length - 1];
                const onFirst = document.activeElement === first;
                const onLast = document.activeElement === last;
                if (!event.shiftKey && onLast) {
                    event.preventDefault();
                    closePanel({ restoreFocus: false });
                    requestAnimationFrame(() => focusAdjacentTo(buttonRef.current, 1));
                } else if (event.shiftKey && onFirst) {
                    event.preventDefault();
                    closePanel({ restoreFocus: true });
                }
            }
        };

        document.addEventListener('keydown', onKeyDown, true);
        return () => {
            window.clearTimeout(focusTimer);
            document.removeEventListener('keydown', onKeyDown, true);
        };
    }, [isOpen, panelStyle, closePanel]);

    const handleToggleOpen = () => {
        if (isOpen) {
            closePanel();
        } else {
            closeOthers();
            setOpen(true);
        }
    };

    const handleButtonKeyDown = (event) => {
        if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
            if (!isOpen && (event.key === 'ArrowDown')) {
                event.preventDefault();
                closeOthers();
                setOpen(true);
            }
        }
    };

    const handleAllChange = () => {
        setFilter([]);
        announceCheckboxChange(allLabel, true);
    };

    const handleOptionChange = (opt) => {
        const nextChecked = !filterValues.includes(opt.value);
        toggleFilterValue(opt.value, setFilter);
        announceCheckboxChange(opt.label, nextChecked);
    };

    const panel = isOpen && panelStyle && typeof document !== 'undefined' ? createPortal(
        <div
            ref={panelRef}
            id={panelId}
            className="energy-reliant-communities-filter-panel"
            style={panelStyle}
            role="group"
            aria-label={label}
        >
            <div className="wb-inv" aria-live="assertive" aria-atomic="true">
                {statusMessage}
            </div>
            <label
                style={{ display: 'flex', alignItems: 'center', padding: '6px 8px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', borderBottom: '2px solid #ddd', backgroundColor: '#f9f9f9' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f0f0f0'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f9f9f9'; }}
            >
                <input
                    type="checkbox"
                    checked={filterValues.length === 0}
                    onChange={handleAllChange}
                    aria-label={allLabel}
                    style={{ marginRight: '8px' }}
                />
                <span aria-hidden="true">{allLabel}</span>
            </label>
            {options.map((opt) => (
                <label
                    key={opt.value}
                    style={{ display: 'flex', alignItems: 'center', padding: '6px 8px', cursor: 'pointer', fontSize: '11px', borderBottom: '1px solid #eee' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f0f0f0'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fff'; }}
                >
                    <input
                        type="checkbox"
                        checked={filterValues.includes(opt.value)}
                        onChange={() => handleOptionChange(opt)}
                        aria-label={opt.label}
                        style={{ marginRight: '8px' }}
                    />
                    <span aria-hidden="true">{opt.label}</span>
                </label>
            ))}
        </div>,
        document.body,
    ) : null;

    return (
        <div className="energy-reliant-communities-filter-dropdown" style={FILTER_DROPDOWN_WRAP}>
            <label htmlFor={buttonId} style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>
                {label}
            </label>
            <button
                type="button"
                id={buttonId}
                ref={buttonRef}
                aria-label={buttonAriaLabel}
                aria-expanded={isOpen}
                aria-haspopup="dialog"
                aria-controls={isOpen ? panelId : undefined}
                onClick={handleToggleOpen}
                onKeyDown={handleButtonKeyDown}
                style={FILTER_BUTTON}
            >
                <span aria-hidden="true" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {valueText}
                </span>
                <span aria-hidden="true" style={{ marginLeft: '4px' }}>{isOpen ? '▲' : '▼'}</span>
            </button>
            {panel}
        </div>
    );
};

const EnergyReliantCommunities = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const [selectedBarPoints, setSelectedBarPoints] = useState(null);
    const [selectedMapIds, setSelectedMapIds] = useState(null);
    const [barProvinces, setBarProvinces] = useState([]);
    const [totalCommunities, setTotalCommunities] = useState(null);
    const [ruralShare, setRuralShare] = useState(null);

    useEffect(() => {
        let cancelled = false;
        getEnergyReliantCommunitiesData()
            .then((payload) => {
                if (cancelled) return;
                setBarProvinces(Array.isArray(payload?.provinces) ? payload.provinces : []);
                setTotalCommunities(payload?.totalCommunities ?? null);
                setRuralShare(payload?.ruralShare ?? null);
            })
            .catch((err) => {
                console.error('Failed to load energy reliant communities:', err);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const [provinceFilter, setProvinceFilter] = useState([]);
    const [communityFilter, setCommunityFilter] = useState([]);
    const [locationFilter, setLocationFilter] = useState([]);
    const [relianceFilter, setRelianceFilter] = useState([]);
    const [provinceDropdownOpen, setProvinceDropdownOpen] = useState(false);
    const [communityDropdownOpen, setCommunityDropdownOpen] = useState(false);
    const [locationDropdownOpen, setLocationDropdownOpen] = useState(false);
    const [relianceDropdownOpen, setRelianceDropdownOpen] = useState(false);

    const barChartRef = useRef(null);
    const mapChartRef = useRef(null);
    const barLastClickRef = useRef({ time: 0, pointIndex: null });
    const mapLastClickRef = useRef({ time: 0, pointIndex: null });

    const getProvinceName = useCallback((key) => {
        const info = provinceInfo[key];
        return lang === 'en' ? info.nameEn : info.nameFr;
    }, [lang]);

    const getCommunityName = useCallback((c) => lang === 'en' ? c.nameEn : c.nameFr, [lang]);

    const getLocationLabel = useCallback((key) => getText(`energy_reliant_communities_location_${key}`, lang), [lang]);
    const getRelianceLabel = useCallback((key) => getText(`energy_reliant_communities_reliance_${key}`, lang), [lang]);

    const barChartTitle = getText('energy_reliant_communities_bar_chart_title', lang);
    const mapChartTitle = getText('energy_reliant_communities_map_title', lang);
    const exportBarTitle = stripHtml(barChartTitle);
    const exportMapTitle = stripHtml(mapChartTitle);
    const barDownloadSlug = getText('energy_reliant_communities_bar_download_title', lang).replace(/\s+/g, '_');
    const mapDownloadSlug = getText('energy_reliant_communities_map_download_title', lang).replace(/\s+/g, '_');

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

    

    const barLabels = useMemo(() => barProvinces.map(p => getProvinceName(p.key)), [barProvinces, getProvinceName]);
    const barValues = useMemo(() => barProvinces.map(p => p.count), [barProvinces]);
    const countText = formatCount(totalCommunities, lang);
    const shareText = formatShare(ruralShare, lang);
    const boldCount = fillText('energy_reliant_communities_para2_bold1', lang, { count: countText });
    const boldShare = fillText('energy_reliant_communities_para2_bold2', lang, { share: shareText });

    const barTableColumns = useMemo(() => [
        { key: 'province', header: getText('energy_reliant_communities_table_province', lang), align: 'left' },
        { key: 'count', header: getText('energy_reliant_communities_table_count', lang), align: 'num' },
    ], [lang]);

    const barTableRows = useMemo(() => (
        barProvinces.map((p) => ({
            province: getProvinceName(p.key),
            count: roundHalfUp(p.count, 0),
        }))
    ), [barProvinces, getProvinceName]);

    const mapTableColumns = useMemo(() => [
        { key: 'community', header: getText('energy_reliant_communities_table_community', lang), align: 'left' },
        { key: 'province', header: getText('energy_reliant_communities_table_province', lang), align: 'left' },
        { key: 'location', header: getText('energy_reliant_communities_filter_location', lang), align: 'left' },
        { key: 'reliance', header: getText('energy_reliant_communities_filter_reliance', lang), align: 'left' },
    ], [lang]);

    const mapTableRows = useMemo(() => {
        const locale = lang === 'en' ? 'en-CA' : 'fr-CA';
        return [...filteredCommunities]
            .sort((a, b) => getCommunityName(a).localeCompare(getCommunityName(b), locale))
            .map((c) => ({
                community: getCommunityName(c),
                province: getProvinceName(c.province),
                location: getLocationLabel(c.location),
                reliance: getRelianceLabel(c.reliance),
            }));
    }, [filteredCommunities, getCommunityName, getProvinceName, getLocationLabel, getRelianceLabel, lang]);

    const barTrace = useMemo(() => {
        const hovertext = barProvinces.map((p, i) => {
            const name = getProvinceName(p.key);
            return `<b>${name}</b><br>${exportBarTitle}: ${formatCount(barValues[i], lang)}`;
        });
        const markerColor = selectedBarPoints === null
            ? BAR_COLOR
            : barProvinces.map((_, i) => selectedBarPoints.includes(i) ? BAR_COLOR : hexToRgba(BAR_COLOR, 0.3));
        return {
            type: 'bar',
            orientation: 'h',
            x: barValues,
            y: barLabels,
            marker: { color: markerColor },
            hovertext,
            hoverinfo: 'text',
            hoverlabel: { bgcolor: '#ffffff', font: { color: '#000000', size: 14, family: 'Arial, sans-serif' } },
            text: barValues.map((value) => formatCount(value, lang)),
            textposition: 'outside',
            textfont: { size: windowWidth <= 480 ? 16 : 20, color: '#666666', family: 'Arial, sans-serif' }
        };
    }, [exportBarTitle, barLabels, barValues, barProvinces, windowWidth, selectedBarPoints, getProvinceName, lang]);

    const barPlotLayout = useMemo(() => ({
        barmode: 'overlay',
        showlegend: false,
        hovermode: 'closest',
        clickmode: 'event',
        dragmode: false,
        xaxis: {
            range: [0, Math.max(100, Math.ceil((Math.max(0, ...barValues.filter((value) => Number.isFinite(value))) + 10) / 20) * 20)],
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
    }), [windowWidth, barValues]);

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

    const downloadBarChartWithTitle = useChartPngDownloader(
        barChartRef,
        () => ({
        filename: `${barDownloadSlug}.png`,
        title: exportBarTitle,
        height: 520,
    }),
        [barDownloadSlug, exportBarTitle],
    );

    const downloadMapWithTitleAndLegend = useChartPngDownloader(
        mapChartRef,
        () => ({
        filename: `${mapDownloadSlug}.png`,
        title: exportMapTitle,
        height: mapHeight,
        legendItems: relianceKeys.map((key) => ({
            label: getRelianceLabel(key),
            color: RELIANCE_COLORS[key],
        })),
    }),
        [RELIANCE_COLORS, exportMapTitle, getRelianceLabel, mapDownloadSlug, mapHeight, relianceKeys],
    );

    const barConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadBarChartWithTitle(gd),
    });

    const mapConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadMapWithTitleAndLegend(gd),
    });

    const clearAllFilters = () => {
        setProvinceFilter([]);
        setCommunityFilter([]);
        setLocationFilter([]);
        setRelianceFilter([]);
        setSelectedMapIds(null);
        setProvinceDropdownOpen(false);
        setCommunityDropdownOpen(false);
        setLocationDropdownOpen(false);
        setRelianceDropdownOpen(false);
    };

    const getBarChartSummary = () => {
        const unit = lang === 'fr' ? 'communautés' : 'communities';
        const parts = barProvinces.map(
            (p, i) => `${getProvinceName(p.key)}: ${formatCount(barValues[i], lang)} ${unit}`,
        ).join(', ');
        return `${exportBarTitle}. ${parts}.`;
    };

    const getMapChartSummary = () => {
        return `${exportMapTitle}. ${filteredCommunities.length} ${lang === 'en' ? 'communities shown.' : 'communautés affichées.'}`;
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

    const mapTableCaption = lang === 'en'
        ? 'Energy reliant communities including community name, province, location type, and energy reliance level.'
        : "Communautés dépendantes de l'énergie incluant le nom de la communauté, la province, le type d'emplacement et le niveau de dépendance à l'énergie.";

    return (
        <PageShell tabIndex="-1"
            className="page-content page-46 energy-reliant-communities page-chrome page-chrome--bleed"
            aria-labelledby="energy-reliant-communities-title"
            style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
        >
            <style>{`
.page-46.energy-reliant-communities {
}
.energy-reliant-communities-container { width: 100%; padding: 15px 0 40px 0; display: flex; flex-direction: column; box-sizing: border-box; overflow: visible; }
.energy-reliant-communities-title {
    font-size: 50px;
    color: #a0346e;
    margin: 0 0 24px 0;
    text-transform: none;
}
.energy-reliant-communities-intro {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    line-height: 1.5;
    color: var(--gc-text);
    margin-top: 0;
    margin-bottom: 20px;
}
.energy-reliant-communities-chart-title {
    color: var(--gc-text);
    margin: 0 0 15px 0;
}
.energy-reliant-communities-map-title {
    color: var(--gc-text);
    margin: 0 0 15px 0;
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
.energy-reliant-communities-table-wrapper { display: block; width: 100%; margin-top: 20px; }
.energy-reliant-communities-chart-frame button[type="button"]:hover { background-color: #404040 !important; }
@media (max-width: 768px) {
    .energy-reliant-communities-title { font-size: 37px; }
    .energy-reliant-communities-intro { font-size: 18px; }
    .energy-reliant-communities-bar-chart { height: 380px; }
}
            `}</style>

            <div className="energy-reliant-communities-container">
                <header role="region" aria-label={getText('energy_reliant_communities_title', lang)}>
                    <h1 id="energy-reliant-communities-title" className="energy-reliant-communities-title page-chrome-title">{getText('energy_reliant_communities_title', lang)}</h1>
                </header>

                <p className="energy-reliant-communities-intro" role="region" aria-label={stripHtml(getText('energy_reliant_communities_para1', lang))}>
                    {getText('energy_reliant_communities_para1', lang)}
                </p>
                <p className="energy-reliant-communities-intro" role="region" aria-label={stripHtml(getText('energy_reliant_communities_para2_part1', lang) + boldCount + getText('energy_reliant_communities_para2_part2', lang) + boldShare)}>
                    {getText('energy_reliant_communities_para2_part1', lang)}<strong>{boldCount}</strong>{getText('energy_reliant_communities_para2_part2', lang)}<strong>{boldShare}</strong>
                </p>

                <div className="energy-reliant-communities-chart-frame page-chrome-chart-frame">
                    <h2 className="energy-reliant-communities-chart-title page-chrome-chart-title">{barChartTitle}</h2>
                    <div role="region" aria-label={getBarChartSummary()} tabIndex="0">
                        <figure ref={barChartRef} className="energy-reliant-communities-bar-chart" style={{ margin: 0, position: 'relative' }}>
                            {selectedBarPoints !== null && <ClearSelectionButton lang={lang} onClick={() => setSelectedBarPoints(null)} />}
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
                        <ChartDataTable
                            lang={lang}
                            columns={barTableColumns}
                            rows={barTableRows}
                            csvFilename={`${barDownloadSlug}.csv`}
                            docx={{
                                filename: `${barDownloadSlug}.docx`,
                                title: exportBarTitle,
                                titleAlign: 'center',
                                columnWidths: [4500, 2500],
                                fontSize: 22,
                            }}
                            caption={exportBarTitle}
                            tableAriaLabel={exportBarTitle}
                        />
                    </div>
                </div>

                <div className="energy-reliant-communities-chart-frame page-chrome-chart-frame">
                    <h2 className="energy-reliant-communities-map-title page-chrome-chart-title">{mapChartTitle}</h2>
                    <div role="region" aria-label={getMapChartSummary()} tabIndex="0">
                        <figure ref={mapChartRef} className="energy-reliant-communities-map-chart" style={{ margin: 0, position: 'relative', height: mapHeight, overflow: 'hidden' }}>
                            {effectiveSelectedMapIds !== null && <ClearSelectionButton lang={lang} onClick={() => setSelectedMapIds(null)} />}
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
                    <ChartDataTable
                        lang={lang}
                        columns={mapTableColumns}
                        rows={mapTableRows}
                        csvFilename={`${mapDownloadSlug}.csv`}
                        docx={{
                            filename: `${mapDownloadSlug}.docx`,
                            title: exportMapTitle,
                            titleAlign: 'center',
                            columnWidths: [2800, 2200, 2000, 2200],
                            fontSize: 18,
                        }}
                        caption={mapTableCaption}
                        tableAriaLabel={mapTableCaption}
                    />
                </div>
            </div>
        </PageShell>
    );
};

export default EnergyReliantCommunities;
