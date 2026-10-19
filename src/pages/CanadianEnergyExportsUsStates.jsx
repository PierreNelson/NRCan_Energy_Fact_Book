import React, { useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import FootnoteMarker from '../components/FootnoteMarker';
import PageFootnotes from '../components/PageFootnotes';
import { layoutBleedCssVars } from '../hooks/useLayoutBleedStyle';
import useWindowWidth from '../hooks/useWindowWidth';
import usePlotlySelection from '../hooks/usePlotlySelection';
import PageShell from '../components/PageShell';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import useChartPngDownloader from '../hooks/useChartPngDownloader';
import { buildPngOnlyPlotConfig } from '../utils/plotlyInteractiveDefaults';
import { getText } from '../utils/translations';
import { stripHtml } from '../utils/stripHtml';
import { summarizeByCategory, joinChartSummary } from '../utils/chartSpokenSummary';

import { makeScrollToIdHandler } from '../utils/scrollToId';
import { getUsStateEnergyExportsData } from '../utils/dataLoader';

/** Full names for hover (EN / FR) — matches common factbook usage */
const US_STATE_NAME_EN = {
    AK: 'Alaska',
    AL: 'Alabama',
    AR: 'Arkansas',
    AZ: 'Arizona',
    CA: 'California',
    CO: 'Colorado',
    CT: 'Connecticut',
    DC: 'District of Columbia',
    DE: 'Delaware',
    FL: 'Florida',
    GA: 'Georgia',
    HI: 'Hawaii',
    IA: 'Iowa',
    ID: 'Idaho',
    IL: 'Illinois',
    IN: 'Indiana',
    KS: 'Kansas',
    KY: 'Kentucky',
    LA: 'Louisiana',
    MA: 'Massachusetts',
    MD: 'Maryland',
    ME: 'Maine',
    MI: 'Michigan',
    MN: 'Minnesota',
    MO: 'Missouri',
    MS: 'Mississippi',
    MT: 'Montana',
    NC: 'North Carolina',
    ND: 'North Dakota',
    NE: 'Nebraska',
    NH: 'New Hampshire',
    NJ: 'New Jersey',
    NM: 'New Mexico',
    NV: 'Nevada',
    NY: 'New York',
    OH: 'Ohio',
    OK: 'Oklahoma',
    OR: 'Oregon',
    PA: 'Pennsylvania',
    RI: 'Rhode Island',
    SC: 'South Carolina',
    SD: 'South Dakota',
    TN: 'Tennessee',
    TX: 'Texas',
    UT: 'Utah',
    VA: 'Virginia',
    VT: 'Vermont',
    WA: 'Washington',
    WI: 'Wisconsin',
    WV: 'West Virginia',
    WY: 'Wyoming',
};

const US_STATE_NAME_FR = {
    AK: 'Alaska',
    AL: 'Alabama',
    AR: 'Arkansas',
    AZ: 'Arizona',
    CA: 'Californie',
    CO: 'Colorado',
    CT: 'Connecticut',
    DC: 'District de Columbia',
    DE: 'Delaware',
    FL: 'Floride',
    GA: 'Géorgie',
    HI: 'Hawaï',
    IA: 'Iowa',
    ID: 'Idaho',
    IL: 'Illinois',
    IN: 'Indiana',
    KS: 'Kansas',
    KY: 'Kentucky',
    LA: 'Louisiane',
    MA: 'Massachusetts',
    MD: 'Maryland',
    ME: 'Maine',
    MI: 'Michigan',
    MN: 'Minnesota',
    MO: 'Missouri',
    MS: 'Mississippi',
    MT: 'Montana',
    NC: 'Caroline du Nord',
    ND: 'Dakota du Nord',
    NE: 'Nebraska',
    NH: 'New Hampshire',
    NJ: 'New Jersey',
    NM: 'Nouveau-Mexique',
    NV: 'Nevada',
    NY: 'New York',
    OH: 'Ohio',
    OK: 'Oklahoma',
    OR: 'Oregon',
    PA: 'Pennsylvanie',
    RI: 'Rhode Island',
    SC: 'Caroline du Sud',
    SD: 'Dakota du Sud',
    TN: 'Tennessee',
    TX: 'Texas',
    UT: 'Utah',
    VA: 'Virginie',
    VT: 'Vermont',
    WA: 'Washington',
    WI: 'Wisconsin',
    WV: 'Virginie-Occidentale',
    WY: 'Wyoming',
};

/**
 * Plotly map label size (px). Shrinks as the layout viewport narrows (browser zoom reflow) and as
 * `devicePixelRatio` rises vs session start (Chromium/Firefox zoom), so offshore NE labels do not stack.
 * Floor steps down to 5px at ~400–500% zoom; the data table carries full values (WCAG 1.4.4).
 */
function canadianEnergyExportsUsStatesMapLabelSize(innerWidth, devicePixelRatio, sessionDevicePixelRatio) {
    const session = sessionDevicePixelRatio > 0 ? sessionDevicePixelRatio : 1;
    const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1;
    const dprRatio = dpr / session;

    let base;
    if (innerWidth <= 420) base = 7;
    else if (innerWidth <= 480) base = 8;
    else if (innerWidth <= 800) base = 9;
    else if (innerWidth <= 960) base = 10;
    else if (innerWidth <= 1200) base = 10;
    else if (innerWidth <= 1440) base = 11;
    else base = 12;

    let sub = 0;
    if (dprRatio >= 1.22) sub += 1;
    if (dprRatio >= 1.45) sub += 1;
    if (dprRatio >= 1.72) sub += 1;
    if (dprRatio >= 2.0) sub += 1;
    if (dprRatio >= 2.35) sub += 1;
    if (dprRatio >= 2.7) sub += 1;
    if (dprRatio >= 3.05) sub += 1;
    if (dprRatio >= 3.35) sub += 1;
    if (dprRatio >= 3.65) sub += 1;
    if (dprRatio >= 4.0) sub += 1;
    if (dprRatio >= 4.4) sub += 1;
    if (dprRatio >= 4.85) sub += 1;

    const floor =
        dprRatio >= 4.7 ? 5 : dprRatio >= 4.0 ? 6 : dprRatio >= 3.25 ? 7 : 8;
    return Math.max(floor, base - sub);
}

/** Lighter font at high zoom / tiny labels so glyphs take less horizontal space (Plotly textfont.weight). */
function canadianEnergyExportsUsStatesMapLabelWeight(dprRatio, labelSize) {
    if (dprRatio >= 3.25 || labelSize <= 7) return 'normal';
    return 'bold';
}

/** ~200% zoom: move colorbar under the map so geo can use full width (no right margin for vertical bar). */
function canadianEnergyExportsUsStatesUseHorizontalColorbar(innerWidth, devicePixelRatio, sessionDevicePixelRatio) {
    const session = sessionDevicePixelRatio > 0 ? sessionDevicePixelRatio : 1;
    const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1;
    const dprRatio = dpr / session;
    return innerWidth <= 960 || dprRatio >= 1.28;
}

/** Colorbar tick/title sizes — extra shrink at ~300% zoom so tick labels do not overlap. */
function canadianEnergyExportsUsStatesColorbarFontSizes(labelSize, innerWidth, devicePixelRatio, sessionDevicePixelRatio) {
    const session = sessionDevicePixelRatio > 0 ? sessionDevicePixelRatio : 1;
    const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1;
    const dprRatio = dpr / session;
    let titleSize = Math.max(12, Math.min(17, labelSize + 4));
    let tickSize = Math.max(11, Math.min(15, labelSize + 2));
    if (innerWidth <= 720) {
        tickSize = Math.min(tickSize, 12);
        titleSize = Math.min(titleSize, 14);
    }
    if (innerWidth <= 560) {
        tickSize = Math.min(tickSize, 11);
        titleSize = Math.min(titleSize, 13);
    }
    if (dprRatio >= 2.15) {
        tickSize = Math.min(tickSize, 10);
        titleSize = Math.min(titleSize, 12);
    }
    if (dprRatio >= 2.55) {
        tickSize = Math.min(tickSize, 9);
        titleSize = Math.min(titleSize, 11);
    }
    if (dprRatio >= 2.95) {
        tickSize = Math.min(tickSize, 8);
        titleSize = Math.min(titleSize, 10);
    }
    return {
        titleSize: Math.max(10, titleSize),
        tickSize: Math.max(8, tickSize),
    };
}

/** States whose on-map labels sit outside the polygon with leader arrows (see printed factbook). */
const canadian_energy_exports_us_states_EXTERNAL_LABEL_CODES = new Set(['VT', 'ME', 'NH', 'MA', 'RI', 'CT', 'NJ', 'DE', 'MD', 'DC']);

/**
 * Leader lines: text sits at label (labelLon, labelLat) in the Atlantic margin; line draws to state centroid (row.lon, row.lat).
 * Order matches the printed factbook (north → south). Tune coordinates if the geo projection changes.
 */
/**
 * Offshore anchors: extra vertical gap (esp. NH / Mass. / R.I. / mid-Atlantic stack), lon zig-zag
 * for side-by-side pairs; lines still terminate at state centroids.
 */
/**
 * All anchors west enough (~−71° or farther) to avoid right-edge clip on Albers usa.
 * Extra lat gap NH→MA; DE/NJ separated; DC last with room below MD.
 */
const canadian_energy_exports_us_states_OUTSIDE_LABEL_GEO = {
    ME: { labelLon: -65.08, labelLat: 47.14 },
    VT: { labelLon: -75.58, labelLat: 47.45 },
    NH: { labelLon: -70.72, labelLat: 47.95 },
    MA: { labelLon: -67.38, labelLat: 43.2 },
    CT: { labelLon: -70.78, labelLat: 39.9 },
    RI: { labelLon: -65.28, labelLat: 40.22 },
    NJ: { labelLon: -66.02, labelLat: 36.72 },
    DE: { labelLon: -72.72, labelLat: 38.4 },
    MD: { labelLon: -71.08, labelLat: 33.48 },
    DC: { labelLon: -75.48, labelLat: 32.28 },
};

/** Optional lat/lon for in-state text only (centroid default otherwise). */
const canadian_energy_exports_us_states_INTERNAL_LABEL_POS = {
    ID: { lat: 43.88, lon: -115.35 },
};

const canadian_energy_exports_us_states_EXTERNAL_ORDER = ['ME', 'VT', 'NH', 'MA', 'RI', 'CT', 'NJ', 'DE', 'MD', 'DC'];

const canadian_energy_exports_us_states_LAYOUT = [
    ['AK', 'Alaska', 'Alaska', 64.2, -149.5],
    ['AL', 'Ala.', 'Ala.', 32.779, -86.83],
    ['AR', 'Ark.', 'Ark.', 34.97, -92.37],
    ['AZ', 'Ariz.', 'Ariz.', 34.27, -111.66],
    ['CA', 'Calif.', 'Calif.', 36.12, -119.68],
    ['CO', 'Colo.', 'Colo.', 39.06, -105.31],
    ['CT', 'Conn.', 'Conn.', 41.6, -72.7],
    ['DC', 'D.C.', 'D.C.', 38.91, -77.01],
    ['DE', 'Del.', 'Del.', 38.99, -75.51],
    ['FL', 'Fla.', 'Fla.', 28.63, -82.45],
    ['GA', 'Ga.', 'Ga.', 32.17, -83.42],
    ['HI', 'Hawaii', 'Hawaii', 20.79, -156.33],
    ['IA', 'Iowa', 'Iowa', 41.88, -93.1],
    ['ID', 'Idaho', 'Idaho', 44.35, -114.61],
    ['IL', 'Ill.', 'Ill.', 40.63, -89.4],
    ['IN', 'Ind.', 'Ind.', 39.85, -86.26],
    ['KS', 'Kans.', 'Kans.', 38.53, -96.73],
    ['KY', 'Ky.', 'Ky.', 37.84, -85.2],
    ['LA', 'La.', 'La.', 31.17, -91.87],
    ['MA', 'Mass.', 'Mass.', 42.16, -71.53],
    ['MD', 'Md.', 'Md.', 39.05, -76.73],
    ['ME', 'Me.', 'Me.', 45.37, -69.2],
    ['MI', 'Mich.', 'Mich.', 43.33, -84.54],
    ['MN', 'Minn.', 'Minn.', 45.73, -93.9],
    ['MO', 'Mo.', 'Mo.', 38.46, -92.37],
    ['MS', 'Miss.', 'Miss.', 32.74, -89.67],
    ['MT', 'Mont.', 'Mont.', 47.05, -110.45],
    ['NC', 'N.C.', 'N.C.', 35.63, -79.81],
    ['ND', 'N.D.', 'N.D.', 47.53, -99.78],
    ['NE', 'Nebr.', 'Nebr.', 41.54, -99.81],
    ['NH', 'N.H.', 'N.H.', 43.94, -71.58],
    ['NJ', 'N.J.', 'N.J.', 40.19, -74.67],
    ['NM', 'N.Mex.', 'N.Mex.', 34.84, -106.25],
    ['NV', 'Nev.', 'Nev.', 38.31, -117.03],
    ['NY', 'N.Y.', 'N.Y.', 42.95, -75.53],
    ['OH', 'Ohio', 'Ohio', 40.39, -82.79],
    ['OK', 'Okla.', 'Okla.', 35.56, -96.93],
    ['OR', 'Ore.', 'Ore.', 44.57, -122.53],
    ['PA', 'Penn.', 'Penn.', 41.2, -77.2],
    ['RI', 'R.I.', 'R.I.', 41.68, -71.56],
    ['SC', 'S.C.', 'S.C.', 33.92, -80.34],
    ['SD', 'S.D.', 'S.D.', 44.44, -100.23],
    ['TN', 'Tenn.', 'Tenn.', 35.86, -86.35],
    ['TX', 'Tex.', 'Tex.', 31.05, -97.56],
    ['UT', 'Utah', 'Utah', 40.15, -111.86],
    ['VA', 'Va.', 'Va.', 37.77, -78.17],
    ['VT', 'Vt.', 'Vt.', 44.56, -72.58],
    ['WA', 'Wash.', 'Wash.', 47.62, -120.74],
    ['WI', 'Wis.', 'Wis.', 44.26, -89.62],
    ['WV', 'W.Va.', 'W.Va.', 38.97, -80.33],
    ['WY', 'Wyo.', 'Wyo.', 42.75, -107.3],
].map(([code, abbrevEn, abbrevFr, lat, lon]) => ({
    code,
    abbrevEn,
    abbrevFr,
    lat,
    lon,
}));

const MAP_BG = '#f5f5f5';

const rowsForYear = (year, byYear) => {
    const metrics = byYear[year] || [];
    const byCode = new Map(metrics.map((row) => [row.code, row]));
    return canadian_energy_exports_us_states_LAYOUT.flatMap((layout) => {
        const metric = byCode.get(layout.code);
        if (!metric) return [];
        return [{ ...layout, exportMil: metric.exportMil, pctGdp: metric.pctGdp }];
    });
};

const formatGdpShare = (value, lang) => {
    const text = (Math.round(Number(value) * 10) / 10).toFixed(1);
    return lang === 'fr' ? text.replace('.', ',') : text;
};

const formatScaleTick = (value, lang) => {
    const rounded = Math.round(Number(value) * 10) / 10;
    const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    const shown = lang === 'fr' ? text.replace('.', ',') : text;
    return lang === 'fr' ? `${shown} %` : `${shown}%`;
};

const toFileSlug = (text) => {
    const s = stripHtml(text)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase();
    return s || 'chart';
};

const CanadianEnergyExportsUsStates = () => {
    const { lang, layoutPadding } = useOutletContext();
    const windowWidth = useWindowWidth();
    const [devicePixelRatio, setDevicePixelRatio] = useState(
        () => (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
    );
    /** Baseline DPR at mount — used to detect browser zoom (Chromium/Firefox). */
    const [sessionDevicePixelRatio] = useState(() =>
        typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    );
    const [rowsByYear, setRowsByYear] = useState({});
    const [selectedYear, setSelectedYear] = useState(null);
    const {
        selected: selectedPoints,
        clear: clearSelection,
        onPlotClick,
    } = usePlotlySelection({ mode: 'slices', windowWidth });
    const chartRef = useRef(null);

    useEffect(() => {
        const onResize = () => {
            setDevicePixelRatio(window.devicePixelRatio || 1);
        };
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        let cancelled = false;
        getUsStateEnergyExportsData()
            .then((data) => {
                if (cancelled) return;
                const next = {};
                (Array.isArray(data) ? data : []).forEach((entry) => {
                    next[entry.year] = entry.states;
                });
                const years = Object.keys(next)
                    .map(Number)
                    .filter((year) => {
                        const codes = new Set((next[year] || []).map((row) => row.code));
                        return canadian_energy_exports_us_states_LAYOUT.every((layout) => codes.has(layout.code));
                    })
                    .sort((a, b) => b - a);
                setRowsByYear(next);
                setSelectedYear(years[0] ?? null);
            })
            .catch((err) => {
                console.error('Failed to load U.S. state energy exports:', err);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const yearList = useMemo(() => Object.keys(rowsByYear)
        .map(Number)
        .filter((year) => {
            const codes = new Set((rowsByYear[year] || []).map((row) => row.code));
            return canadian_energy_exports_us_states_LAYOUT.every((layout) => codes.has(layout.code));
        })
        .sort((a, b) => b - a), [rowsByYear]);

    const scrollToFootnote = makeScrollToIdHandler('fn-asterisk-canadian-energy-exports-us-states');

    const canadianEnergyExportsUsStatesYearRange = useMemo(() => {
        if (!yearList.length) return { min: '', max: '' };
        return { min: Math.min(...yearList), max: Math.max(...yearList) };
    }, [yearList]);

    const chartTitle = getText('canadian_energy_exports_us_states_title', lang).replace(/\{\{year\}\}/g, String(selectedYear));
    const chartSubtitle = getText('canadian_energy_exports_us_states_subtitle', lang);
    const exportChartTitle = stripHtml(chartTitle);
    const exportChartSubtitle = stripHtml(chartSubtitle);
    /** Visible subtitle is "($ millions)"; title focus speaks full unit phrase. */
    const titleUnitSpoken = lang === 'en' ? 'millions of dollars' : 'millions de dollars';
    /** Overview / map values are CAD — avoid "C$ millions" → "c dollar millions". */
    const cadUnitSpoken = lang === 'en'
        ? 'millions of Canadian dollars'
        : 'millions de dollars canadiens';
    const chartTitleSpoken = `${exportChartTitle}, ${titleUnitSpoken}`;
    const chartDownloadSlug = toFileSlug(exportChartTitle);

    const yearInTableHeading =
        canadianEnergyExportsUsStatesYearRange.min === canadianEnergyExportsUsStatesYearRange.max
            ? String(canadianEnergyExportsUsStatesYearRange.min)
            : `${canadianEnergyExportsUsStatesYearRange.min}–${canadianEnergyExportsUsStatesYearRange.max}`;
    const tableCaption = stripHtml(
        getText('canadian_energy_exports_us_states_title', lang).replace(/\{\{year\}\}/g, yearInTableHeading),
    );
    const tableExportStem = useMemo(() => {
        const base = stripHtml(getText('canadian_energy_exports_us_states_title', lang).replace(/\(\{\{year\}\}\)/g, '').trim());
        return `${toFileSlug(base)}-${canadianEnergyExportsUsStatesYearRange.min}-${canadianEnergyExportsUsStatesYearRange.max}`;
    }, [lang, canadianEnergyExportsUsStatesYearRange.min, canadianEnergyExportsUsStatesYearRange.max]);

    const formatExports = (n) =>
        (lang === 'fr' ? Number(n).toLocaleString('fr-CA').replace(/\u00a0/g, ' ') : Number(n).toLocaleString('en-CA'));

    const formatPctTable = (p) => formatGdpShare(p, lang);

    const tableColumns = useMemo(() => [
        { key: 'year', header: getText('canadian_energy_exports_us_states_table_year', lang), align: 'left' },
        { key: 'state', header: getText('canadian_energy_exports_us_states_table_state', lang), align: 'left' },
        { key: 'exportMil', header: getText('canadian_energy_exports_us_states_table_exports_mil', lang), align: 'num' },
        { key: 'pctGdp', header: getText('canadian_energy_exports_us_states_table_pct_gdp', lang), align: 'num' },
    ], [lang]);

    const tableRowsForExport = useMemo(() => {
        const nameMap = lang === 'fr' ? US_STATE_NAME_FR : US_STATE_NAME_EN;
        const out = [];
        for (const y of yearList) {
            const yrData = rowsForYear(y, rowsByYear);
            if (!yrData) continue;
            for (const r of yrData) {
                out.push({
                    year: y,
                    state: nameMap[r.code] || r.code,
                    exportMil: r.exportMil,
                    pctGdp: r.pctGdp,
                });
            }
        }
        return out;
    }, [lang, rowsByYear, yearList]);

    const downloadChartWithTitle = useChartPngDownloader(
        chartRef,
        () => ({
        filename: `${chartDownloadSlug}.png`,
        title: exportChartTitle,
        subtitle: exportChartSubtitle,
        width: 1200,
        height: 720,
    }),
        [chartDownloadSlug, exportChartSubtitle, exportChartTitle],
    );

    const plotConfig = buildPngOnlyPlotConfig({
        lang,
        click: (gd) => downloadChartWithTitle(gd),
    });

    const canadianEnergyExportsUsStatesColorbarHorizontal = useMemo(
        () => canadianEnergyExportsUsStatesUseHorizontalColorbar(windowWidth, devicePixelRatio, sessionDevicePixelRatio),
        [windowWidth, devicePixelRatio, sessionDevicePixelRatio]
    );

    const plotBundle = useMemo(() => {
        const rows = rowsForYear(selectedYear, rowsByYear);
        if (!rows.length) return null;
        const fmt = (n) =>
            lang === 'fr' ? n.toLocaleString('fr-CA').replace(/\u00a0/g, ' ') : n.toLocaleString('en-CA');
        const nameMap = lang === 'fr' ? US_STATE_NAME_FR : US_STATE_NAME_EN;
        const locations = rows.map((r) => r.code);
        const z = rows.map((r) => r.pctGdp);
        const labelSize = canadianEnergyExportsUsStatesMapLabelSize(windowWidth, devicePixelRatio, sessionDevicePixelRatio);
        const mapLabelWeight = canadianEnergyExportsUsStatesMapLabelWeight(
            (devicePixelRatio > 0 ? devicePixelRatio : 1) /
                (sessionDevicePixelRatio > 0 ? sessionDevicePixelRatio : 1),
            labelSize
        );
        const abbrevKey = lang === 'fr' ? 'abbrevFr' : 'abbrevEn';
        const mapLabelFont = {
            family: 'Arial, sans-serif',
            size: labelSize,
            weight: mapLabelWeight,
        };
        const hoverFontSize = Math.max(12, Math.min(16, labelSize + 2));
        const pctTail = getText('canadian_energy_exports_us_states_hover_pct_tail', lang);

        const opacities = rows.map((_, i) => {
            if (selectedPoints === null) return 1;
            return selectedPoints.includes(i) ? 1 : 0.3;
        });

        const labelText = rows.map((r) => {
            if (canadian_energy_exports_us_states_EXTERNAL_LABEL_CODES.has(r.code)) return '';
            const ab = r[abbrevKey];
            const v = fmt(r.exportMil);
            return `${ab}<br>${v}`;
        });

        const hoverText = rows.map((r) => {
            const full = nameMap[r.code] || r.code;
            const v = fmt(r.exportMil);
            const pctStr = lang === 'fr' ? `${formatGdpShare(r.pctGdp, lang)} %` : `${formatGdpShare(r.pctGdp, lang)}%`;
            const valueLabel = lang === 'en' ? `$${v} million ($C)` : `${v} millions de $ (CAN)`;
            return `<b>${full}</b><br>${valueLabel}<br>${pctStr} ${pctTail}`;
        });

        const leaderLat = [];
        const leaderLon = [];
        for (const code of canadian_energy_exports_us_states_EXTERNAL_ORDER) {
            const row = rows.find((r) => r.code === code);
            const g = canadian_energy_exports_us_states_OUTSIDE_LABEL_GEO[code];
            if (!row || !g) continue;
            leaderLat.push(g.labelLat, row.lat, null);
            leaderLon.push(g.labelLon, row.lon, null);
        }
        const leaderTraceOpacity = selectedPoints === null ? 1 : 0.35;

        const extLabelLat = [];
        const extLabelLon = [];
        const extLabelText = [];
        const extLabelColors = [];
        for (const code of canadian_energy_exports_us_states_EXTERNAL_ORDER) {
            const row = rows.find((r) => r.code === code);
            const g = canadian_energy_exports_us_states_OUTSIDE_LABEL_GEO[code];
            if (!row || !g) continue;
            const ab = row[abbrevKey];
            const v = fmt(row.exportMil);
            extLabelLat.push(g.labelLat);
            extLabelLon.push(g.labelLon);
            extLabelText.push(`${ab}<br>${v}`);
            const idx = rows.findIndex((r) => r.code === code);
            const o =
                selectedPoints === null || selectedPoints.includes(idx) ? 1 : 0.35;
            extLabelColors.push(`rgba(0,0,0,${o})`);
        }

        const colorscale = [
            [0, '#d6ebf5'],
            [0.2, '#a8d4e8'],
            [0.4, '#6baed6'],
            [0.6, '#3d8fc4'],
            [0.8, '#1f6b8f'],
            [1, '#0c3d5c'],
        ];
        const zmax = Math.max(...z, 0);
        const tickvals = zmax > 0 ? [0, zmax / 2, zmax] : [0];
        const ticktext = tickvals.map((value) => formatScaleTick(value, lang));

        const useHorizontalColorbar = canadianEnergyExportsUsStatesUseHorizontalColorbar(
            windowWidth,
            devicePixelRatio,
            sessionDevicePixelRatio
        );
        const cbFonts = canadianEnergyExportsUsStatesColorbarFontSizes(
            labelSize,
            windowWidth,
            devicePixelRatio,
            sessionDevicePixelRatio
        );
        let colorbarTitleSize = cbFonts.titleSize;
        if (useHorizontalColorbar) colorbarTitleSize = Math.max(10, colorbarTitleSize - 1);
        const colorbarTickSize = cbFonts.tickSize;

        const colorbarTitleText = getText('canadian_energy_exports_us_states_colorbar_title', lang);
        const colorbarTickFont = { size: colorbarTickSize, family: 'Arial, sans-serif', color: '#000000' };
        const colorbarTitleFont = { size: colorbarTitleSize, family: 'Arial, sans-serif', color: '#000000' };

        const colorbar = useHorizontalColorbar
            ? {
                  orientation: 'h',
                  x: 0.5,
                  xanchor: 'center',
                  y: -0.06,
                  yanchor: 'top',
                  len: 0.82,
                  thickness: 11,
                  xpad: 4,
                  ypad: 2,
                  title: {
                      text: colorbarTitleText,
                      side: 'bottom',
                      font: colorbarTitleFont,
                  },
                  tickvals,
                  ticktext,
                  tickangle: 0,
                  outlinewidth: 0,
                  tickfont: colorbarTickFont,
              }
            : {
                  title: {
                      text: colorbarTitleText,
                      side: 'right',
                      font: colorbarTitleFont,
                  },
                  tickvals,
                  ticktext,
                  len: 0.55,
                  thickness: 16,
                  x: 0.985,
                  xpad: 12,
                  y: 0.45,
                  outlinewidth: 0,
                  tickfont: colorbarTickFont,
              };

        const choropleth = {
            type: 'choropleth',
            locationmode: 'USA-states',
            locations,
            z,
            zmin: 0,
            zmax,
            colorscale,
            marker: {
                line: { color: '#f0f7fc', width: 1 },
            },
            ...(selectedPoints
                ? {
                    selectedpoints: selectedPoints,
                    selected: { marker: { opacity: 1 } },
                    unselected: { marker: { opacity: 0.3 } },
                }
                : {}),
            colorbar,
            showscale: true,
            hoverinfo: 'text',
            hovertext: hoverText,
            hoverlabel: {
                bgcolor: '#ffffff',
                bordercolor: '#000000',
                font: { color: '#000000', size: hoverFontSize, family: 'Arial, sans-serif' },
            },
        };

        const labelColors = rows.map((r, i) => {
            if (canadian_energy_exports_us_states_EXTERNAL_LABEL_CODES.has(r.code)) return 'rgba(0,0,0,0)';
            const o = opacities[i];
            return `rgba(26,26,26,${o})`;
        });

        const leaderLines = {
            type: 'scattergeo',
            mode: 'lines',
            lat: leaderLat,
            lon: leaderLon,
            line: { color: '#000000', width: 1 },
            opacity: leaderTraceOpacity,
            hoverinfo: 'skip',
            showlegend: false,
        };

        const scatterInternal = {
            type: 'scattergeo',
            mode: 'text',
            lat: rows.map((r) => canadian_energy_exports_us_states_INTERNAL_LABEL_POS[r.code]?.lat ?? r.lat),
            lon: rows.map((r) => canadian_energy_exports_us_states_INTERNAL_LABEL_POS[r.code]?.lon ?? r.lon),
            text: labelText,
            textfont: {
                ...mapLabelFont,
                color: labelColors,
            },
            hoverinfo: 'skip',
            showlegend: false,
        };

        const scatterExternal = {
            type: 'scattergeo',
            mode: 'text',
            lat: extLabelLat,
            lon: extLabelLon,
            text: extLabelText,
            textfont: {
                ...mapLabelFont,
                color: extLabelColors,
            },
            hoverinfo: 'skip',
            showlegend: false,
        };

        const hBase = windowWidth <= 768 ? 520 : 640;
        const h = useHorizontalColorbar ? hBase + 104 : hBase;
        const layout = {
            dragmode: false,
            clickmode: 'event',
            hovermode: 'closest',
            geo: {
                scope: 'usa',
                projection: { type: 'albers usa' },
                showlakes: true,
                lakecolor: MAP_BG,
                bgcolor: MAP_BG,
                subunitcolor: '#ffffff',
                subunitwidth: 0.75,
                countrycolor: MAP_BG,
                countrywidth: 0,
                showland: true,
                landcolor: MAP_BG,
                showocean: true,
                oceancolor: MAP_BG,
                showcoastlines: false,
                fixedrange: true,
                domain: { x: [0, 1], y: [0, 1] },
            },
            margin: useHorizontalColorbar
                ? { l: 8, r: 8, t: 8, b: 124 }
                : { l: 8, r: 132, t: 8, b: 8 },
            height: h,
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            autosize: true,
            uirevision: 'canadian-energy-exports-us-states',
        };
        return { data: [choropleth, leaderLines, scatterInternal, scatterExternal], layout };
    }, [lang, windowWidth, devicePixelRatio, sessionDevicePixelRatio, selectedPoints, selectedYear, rowsByYear]);

    useEffect(() => {
        if (!chartRef?.current) return;
        const plotContainer = chartRef.current;
        const setup = () => {
            const svgElements = plotContainer.querySelectorAll('.main-svg, .svg-container svg');
            svgElements.forEach((svg) => svg.setAttribute('aria-hidden', 'true'));
            const modebarButtons = plotContainer.querySelectorAll('.modebar-btn');
            modebarButtons.forEach((btn) => {
                const dataTitle = btn.getAttribute('data-title');
                if (dataTitle && (dataTitle.includes('Download') || dataTitle.includes('Télécharger'))) {
                    btn.setAttribute('aria-label', dataTitle);
                    btn.setAttribute('role', 'button');
                    btn.setAttribute('tabindex', '0');
                    btn.removeAttribute('aria-hidden');
                    btn.onkeydown = (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            btn.click();
                        }
                    };
                } else {
                    btn.setAttribute('aria-hidden', 'true');
                    btn.setAttribute('tabindex', '-1');
                }
            });
        };
        const t = setTimeout(setup, 500);
        const observer = new MutationObserver(setup);
        observer.observe(plotContainer, { childList: true, subtree: true });
        return () => {
            clearTimeout(t);
            observer.disconnect();
        };
    }, [lang, selectedYear]);

    const handleChartClick = (data) => {
        if (!data.points?.length) return;
        if (data.points[0].curveNumber !== 0) return;
        onPlotClick(data);
    };

    const getChartSummary = () => {
        const rows = rowsForYear(selectedYear, rowsByYear);
        const nameMap = lang === 'fr' ? US_STATE_NAME_FR : US_STATE_NAME_EN;
        const exportsLabel = lang === 'en' ? 'Exports' : 'Exportations';
        const pctLabel = getText('canadian_energy_exports_us_states_table_pct_gdp', lang);
        const body = summarizeByCategory({
            categories: rows.map((r) => nameMap[r.code] || r.code),
            series: [
                {
                    name: exportsLabel,
                    values: rows.map((r) => r.exportMil),
                    format: (v) => `${formatExports(v)} ${cadUnitSpoken}`,
                },
                {
                    name: pctLabel,
                    values: rows.map((r) => r.pctGdp),
                    format: (p) => (lang === 'fr' ? `${formatPctTable(p)} %` : `${formatPctTable(p)}%`),
                },
            ],
            lang,
        });
        return joinChartSummary({
            intro: lang === 'en'
                ? `Map of Canadian energy exports to U.S. states for ${selectedYear}`
                : `Carte des exportations énergétiques canadiennes vers les États américains pour ${selectedYear}`,
            body,
            lang,
        });
    };
    const mapRegionLabel = `${getText('canadian_energy_exports_us_states_map_aria', lang)}. ${getChartSummary()}`;

    return (
        <PageShell
            tabIndex="-1"
            className="page-content page-14 page-chrome page-chrome--bleed"
            aria-labelledby="canadian-energy-exports-us-states-chart-heading"
            style={{ backgroundColor: '#ffffff', ...layoutBleedCssVars(layoutPadding) }}
        >
            <style>{`
.page-14 { width: 100%; }
.canadian-energy-exports-us-states-container { width: 100%; padding: 15px 0 40px 0; box-sizing: border-box; }
.canadian-energy-exports-us-states-heading {
    display: grid;
    grid-template-columns: auto auto;
    justify-content: center;
    align-items: start;
    column-gap: 0.2em;
    margin: 0 0 15px 0;
    padding-left: 15px;
    width: fit-content;
    max-width: 100%;
    margin-left: auto;
    margin-right: auto;
}
.canadian-energy-exports-us-states-chart-title {
    grid-column: 1;
    grid-row: 1 / span 2;
    color: var(--gc-text);
    margin: 0;
    padding-left: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: fit-content;
    max-width: 100%;
}
.canadian-energy-exports-us-states-fn-slot {
    grid-column: 2;
    grid-row: 1;
    line-height: 1;
    padding-top: 0.2em;
}
.canadian-energy-exports-us-states-chart-subtitle {
    display: block;
    font-family: 'Noto Sans', sans-serif !important;
    font-size: 20px !important;
    font-weight: 400 !important;
    color: var(--gc-text);
    text-align: center;
    margin: 5px 0 0 0 !important;
    padding-left: 0;
}
.canadian-energy-exports-us-states-map-wrap { width: 100%; position: relative; min-height: 480px; }
.canadian-energy-exports-us-states-map-wrap .js-plotly-plot .plotly .modebar { right: 20px !important; }
.canadian-energy-exports-us-states-table-wrapper { display: block; width: 100%; margin: 20px 0 0 0; }
.canadian-energy-exports-us-states-chart-frame button[type="button"]:hover,
.canadian-energy-exports-us-states-chart-frame button:hover { background-color: #404040 !important; }
@media (max-width: 768px) {
    .canadian-energy-exports-us-states-chart-subtitle { font-size: 18px !important; }
}
            `}</style>
            <div className="canadian-energy-exports-us-states-container">
                <div className="canadian-energy-exports-us-states-chart-frame page-chrome-chart-frame">
                    <div className="canadian-energy-exports-us-states-heading">
                        <h2
                            id="canadian-energy-exports-us-states-chart-heading"
                            className="canadian-energy-exports-us-states-chart-title page-chrome-chart-title"
                            aria-labelledby="canadian-energy-exports-us-states-chart-heading-spoken"
                        >
                            <span
                                id="canadian-energy-exports-us-states-chart-heading-spoken"
                                className="wb-inv"
                            >
                                {chartTitleSpoken}
                            </span>
                            <span aria-hidden="true">{chartTitle}</span>
                            <span
                                className="canadian-energy-exports-us-states-chart-subtitle"
                                aria-hidden="true"
                            >
                                {chartSubtitle}
                            </span>
                        </h2>
                        <div className="canadian-energy-exports-us-states-fn-slot">
                            <FootnoteMarker
                                lang={lang}
                                href="#fn-asterisk-canadian-energy-exports-us-states"
                                id="fn-asterisk-rf-canadian-energy-exports-us-states"
                                marker="*"
                                onClick={scrollToFootnote}
                            />
                        </div>
                    </div>
                    {selectedPoints !== null && (
                        <ClearSelectionButton lang={lang} onClick={clearSelection} />
                    )}
                    <div
                        className="canadian-energy-exports-us-states-map-wrap"
                        role="region"
                        aria-label={mapRegionLabel}
                        tabIndex="0"
                        style={{ minHeight: plotBundle ? plotBundle.layout.height : 640 }}
                    >
                        <figure ref={chartRef} style={{ margin: 0, position: 'relative', width: '100%' }}>
                            {plotBundle && (
                                <Plot
                                    key={canadianEnergyExportsUsStatesColorbarHorizontal ? 'canadian-energy-exports-us-states-map-cb-h' : 'canadian-energy-exports-us-states-map-cb-v'}
                                    data={plotBundle.data}
                                    layout={plotBundle.layout}
                                    config={plotConfig}
                                    style={{ width: '100%', height: plotBundle.layout.height }}
                                    useResizeHandler
                                    onClick={handleChartClick}
                                />
                            )}
                        </figure>
                    </div>
                    <div className="canadian-energy-exports-us-states-table-wrapper">
                        <ChartDataTable
                            lang={lang}
                            columns={tableColumns}
                            rows={tableRowsForExport}
                            csvFilename={`${tableExportStem}.csv`}
                            docx={{
                                filename: `${tableExportStem}.docx`,
                                title: tableCaption,
                                titleAlign: 'center',
                                columnWidths: [900, 5200, 2200, 2200],
                                fontSize: 22,
                            }}
                            caption={tableCaption}
                            tableAriaLabel={tableCaption}
                            renderCell={(raw, { colIndex }) => {
                                if (colIndex === 0 || colIndex === 1) return String(raw ?? '');
                                if (colIndex === 2) return formatExports(raw);
                                return lang === 'fr'
                                    ? `${formatPctTable(raw)} %`
                                    : `${formatPctTable(raw)}%`;
                            }}
                        />
                    </div>
                </div>
                <PageFootnotes
                    lang={lang}
                    titleId="canadian-energy-exports-us-states-fn-heading"
                    items={[{
                        id: 'fn-asterisk-canadian-energy-exports-us-states',
                        marker: '*',
                        text: getText('canadian_energy_exports_us_states_footnote', lang),
                        returnHref: '#fn-asterisk-rf-canadian-energy-exports-us-states',
                    }]}
                />
            </div>
        </PageShell>
    );
};

export default CanadianEnergyExportsUsStates;
