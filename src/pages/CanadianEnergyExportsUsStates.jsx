import React, { useEffect, useMemo, useRef, useState } from 'react';
import ChartDataTable from '../components/ChartDataTable';
import ClearSelectionButton from '../components/ClearSelectionButton';
import FootnoteMarker from '../components/FootnoteMarker';
import PageFootnotes from '../components/PageFootnotes';
import YearSelect from '../components/YearSelect';
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

const canadian_energy_exports_us_states_ROWS_2024 = [
    ['AK', 'Alaska', 'Alaska', 614, 1.5, 64.2, -149.5],
    ['AL', 'Ala.', 'Ala.', 309, 1.2, 32.779, -86.83],
    ['AR', 'Ark.', 'Ark.', 84, 0.5, 34.97, -92.37],
    ['AZ', 'Ariz.', 'Ariz.', 157, 0.4, 34.27, -111.66],
    ['CA', 'Calif.', 'Calif.', 4563, 1.8, 36.12, -119.68],
    ['CO', 'Colo.', 'Colo.', 4892, 2.0, 39.06, -105.31],
    ['CT', 'Conn.', 'Conn.', 958, 1.9, 41.6, -72.7],
    ['DC', 'D.C.', 'D.C.', 263, 2.2, 38.91, -77.01],
    ['DE', 'Del.', 'Del.', 1091, 5.2, 38.99, -75.51],
    ['FL', 'Fla.', 'Fla.', 268, 0.6, 28.63, -82.45],
    ['GA', 'Ga.', 'Ga.', 105, 0.4, 32.17, -83.42],
    ['HI', 'Hawaii', 'Hawaii', 31, 0.3, 20.79, -156.33],
    ['IA', 'Iowa', 'Iowa', 168, 0.5, 41.88, -93.1],
    ['ID', 'Idaho', 'Idaho', 131, 1.0, 44.35, -114.61],
    ['IL', 'Ill.', 'Ill.', 69670, 7.2, 40.63, -89.4],
    ['IN', 'Ind.', 'Ind.', 471, 0.9, 39.85, -86.26],
    ['KS', 'Kans.', 'Kans.', 100, 0.4, 38.53, -96.73],
    ['KY', 'Ky.', 'Ky.', 143, 0.5, 37.84, -85.2],
    ['LA', 'La.', 'La.', 1643, 2.5, 31.17, -91.87],
    ['MA', 'Mass.', 'Mass.', 4936, 3.5, 42.16, -71.53],
    ['MD', 'Md.', 'Md.', 153, 0.7, 39.05, -76.73],
    ['ME', 'Me.', 'Me.', 4069, 6.2, 45.37, -69.2],
    ['MI', 'Mich.', 'Mich.', 7577, 4.8, 43.33, -84.54],
    ['MN', 'Minn.', 'Minn.', 13893, 3.8, 45.73, -93.9],
    ['MO', 'Mo.', 'Mo.', 359, 0.9, 38.46, -92.37],
    ['MS', 'Miss.', 'Miss.', 605, 1.8, 32.74, -89.67],
    ['MT', 'Mont.', 'Mont.', 7343, 7.0, 47.05, -110.45],
    ['NC', 'N.C.', 'N.C.', 241, 0.9, 35.63, -79.81],
    ['ND', 'N.D.', 'N.D.', 644, 3.2, 47.53, -99.78],
    ['NE', 'Nebr.', 'Nebr.', 21, 0.3, 41.54, -99.81],
    ['NH', 'N.H.', 'N.H.', 703, 2.8, 43.94, -71.58],
    ['NJ', 'N.J.', 'N.J.', 3611, 3.2, 40.19, -74.67],
    ['NM', 'N.Mex.', 'N.Mex.', 580, 1.9, 34.84, -106.25],
    ['NV', 'Nev.', 'Nev.', 231, 0.6, 38.31, -117.03],
    ['NY', 'N.Y.', 'N.Y.', 2824, 2.5, 42.95, -75.53],
    ['OH', 'Ohio', 'Ohio', 5759, 2.2, 40.39, -82.79],
    ['OK', 'Okla.', 'Okla.', 10584, 5.4, 35.56, -96.93],
    ['OR', 'Ore.', 'Ore.', 658, 1.0, 44.57, -122.53],
    ['PA', 'Penn.', 'Penn.', 2853, 2.8, 41.2, -77.2],
    ['RI', 'R.I.', 'R.I.', 1339, 5.5, 41.68, -71.56],
    ['SC', 'S.C.', 'S.C.', 162, 0.6, 33.92, -80.34],
    ['SD', 'S.D.', 'S.D.', 21, 0.4, 44.44, -100.23],
    ['TN', 'Tenn.', 'Tenn.', 143, 0.5, 35.86, -86.35],
    ['TX', 'Tex.', 'Tex.', 12639, 1.5, 31.05, -97.56],
    ['UT', 'Utah', 'Utah', 213, 0.5, 40.15, -111.86],
    ['VA', 'Va.', 'Va.', 150, 0.7, 37.77, -78.17],
    ['VT', 'Vt.', 'Vt.', 1236, 6.8, 44.56, -72.58],
    ['WA', 'Wash.', 'Wash.', 13531, 4.0, 47.62, -120.74],
    ['WI', 'Wis.', 'Wis.', 822, 1.8, 44.26, -89.62],
    ['WV', 'W.Va.', 'W.Va.', 130, 1.0, 38.97, -80.33],
    ['WY', 'Wyo.', 'Wyo.', 273, 2.1, 42.75, -107.3],
].map(([code, abbrevEn, abbrevFr, exportMil, pctGdp, lat, lon]) => ({
    code,
    abbrevEn,
    abbrevFr,
    exportMil,
    pctGdp,
    lat,
    lon,
}));

/** Add new years when data are available; map year → row list (same shape as canadian_energy_exports_us_states_ROWS_2024). */
const canadian_energy_exports_us_states_DATA_BY_YEAR = {
    2024: canadian_energy_exports_us_states_ROWS_2024,
};

const canadian_energy_exports_us_states_YEAR_LIST = Object.keys(canadian_energy_exports_us_states_DATA_BY_YEAR)
    .map(Number)
    .sort((a, b) => b - a);

const MAP_BG = '#f5f5f5';

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
    const [selectedYear, setSelectedYear] = useState(canadian_energy_exports_us_states_YEAR_LIST[0] ?? 2024);
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

    const scrollToFootnote = makeScrollToIdHandler('fn-asterisk-canadian-energy-exports-us-states');

    const canadianEnergyExportsUsStatesYearRange = useMemo(() => {
        if (!canadian_energy_exports_us_states_YEAR_LIST.length) return { min: 2024, max: 2024 };
        return { min: Math.min(...canadian_energy_exports_us_states_YEAR_LIST), max: Math.max(...canadian_energy_exports_us_states_YEAR_LIST) };
    }, []);

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

    const formatPctTable = (p) => (lang === 'fr' ? String(p).replace('.', ',') : String(p));

    const tableColumns = useMemo(() => [
        { key: 'year', header: getText('canadian_energy_exports_us_states_table_year', lang), align: 'left' },
        { key: 'state', header: getText('canadian_energy_exports_us_states_table_state', lang), align: 'left' },
        { key: 'exportMil', header: getText('canadian_energy_exports_us_states_table_exports_mil', lang), align: 'num' },
        { key: 'pctGdp', header: getText('canadian_energy_exports_us_states_table_pct_gdp', lang), align: 'num' },
    ], [lang]);

    const tableRowsForExport = useMemo(() => {
        const nameMap = lang === 'fr' ? US_STATE_NAME_FR : US_STATE_NAME_EN;
        const out = [];
        for (const y of [...canadian_energy_exports_us_states_YEAR_LIST].sort((a, b) => b - a)) {
            const yrData = canadian_energy_exports_us_states_DATA_BY_YEAR[y];
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
    }, [lang]);

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
        const rows = canadian_energy_exports_us_states_DATA_BY_YEAR[selectedYear] || canadian_energy_exports_us_states_ROWS_2024;
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
            const pctStr = lang === 'fr' ? `${String(r.pctGdp).replace('.', ',')} %` : `${r.pctGdp}%`;
            return `<b>${full}</b><br>${v} ${lang === 'en' ? '$ millions (C$)' : 'millions de $ (CAN)'}<br>${pctStr} ${pctTail}`;
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
        const tickvals = [0, 2.5, 5, 7.5];
        const ticktext =
            lang === 'fr'
                ? ['0 %', '2,5 %', '5 %', '7,5 %']
                : ['0%', '2.5%', '5%', '7.5%'];

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
            zmax: 7.5,
            colorscale,
            marker: {
                line: { color: '#f0f7fc', width: 1 },
                opacity: opacities,
            },
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
        };
        return { data: [choropleth, leaderLines, scatterInternal, scatterExternal], layout };
    }, [lang, windowWidth, devicePixelRatio, sessionDevicePixelRatio, selectedPoints, selectedYear]);

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
        const rows = canadian_energy_exports_us_states_DATA_BY_YEAR[selectedYear] || [];
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
                <YearSelect
                    lang={lang}
                    id="canadian-energy-exports-us-states-year-button"
                    label={getText('year_slider_label', lang)}
                    years={[...canadian_energy_exports_us_states_YEAR_LIST].sort((a, b) => b - a)}
                    value={selectedYear}
                    onChange={(y) => {
                        setSelectedYear(y);
                        clearSelection();
                    }}
                />
                <div role="status" className="wb-inv" aria-live="polite">
                    {selectedYear
                        ? `${lang === 'en' ? 'Showing data for' : 'Données affichées pour'} ${selectedYear}`
                        : ''}
                </div>
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
                    >
                        <figure ref={chartRef} style={{ margin: 0, position: 'relative', width: '100%' }}>
                            <Plot
                                key={canadianEnergyExportsUsStatesColorbarHorizontal ? 'canadian-energy-exports-us-states-map-cb-h' : 'canadian-energy-exports-us-states-map-cb-v'}
                                data={plotBundle.data}
                                layout={plotBundle.layout}
                                config={plotConfig}
                                style={{ width: '100%' }}
                                useResizeHandler
                                onClick={handleChartClick}
                            />
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
