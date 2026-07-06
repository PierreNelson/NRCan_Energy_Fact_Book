import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Plot from '../components/LazyPlot';
import { Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun, WidthType, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import { getText } from '../utils/translations';

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

const stripHtml = (text) =>
    text ? String(text).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';

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
    const { lang } = useOutletContext();
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [devicePixelRatio, setDevicePixelRatio] = useState(
        () => (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
    );
    /** Baseline DPR at mount — used to detect browser zoom (Chromium/Firefox). */
    const [sessionDevicePixelRatio] = useState(() =>
        typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    );
    const [selectedYear, setSelectedYear] = useState(canadian_energy_exports_us_states_YEAR_LIST[0] ?? 2024);
    const [selectedPoints, setSelectedPoints] = useState(null);
    const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
    const lastClickRef = useRef({ time: 0, pointIndex: null });
    const yearDropdownRef = useRef(null);
    const yearButtonRef = useRef(null);

    useEffect(() => {
        const onResize = () => {
            setWindowWidth(window.innerWidth);
            setDevicePixelRatio(window.devicePixelRatio || 1);
        };
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (yearDropdownRef.current && !yearDropdownRef.current.contains(e.target)) {
                setIsYearDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const scrollToFootnote = (e) => {
        e.preventDefault();
        document.getElementById('fn-asterisk-canadian-energy-exports-us-states')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const scrollToRef = (e) => {
        e.preventDefault();
        document.getElementById('fn-asterisk-rf-canadian-energy-exports-us-states')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const chartRef = useRef(null);
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);
    const [isTableOpen, setIsTableOpen] = useState(false);

    const canadianEnergyExportsUsStatesYearRange = useMemo(() => {
        if (!canadian_energy_exports_us_states_YEAR_LIST.length) return { min: 2024, max: 2024 };
        return { min: Math.min(...canadian_energy_exports_us_states_YEAR_LIST), max: Math.max(...canadian_energy_exports_us_states_YEAR_LIST) };
    }, []);

    const tableExportStem = useMemo(() => {
        const base = stripHtml(getText('canadian_energy_exports_us_states_title', lang).replace(/\(\{\{year\}\}\)/g, '').trim());
        return `${toFileSlug(base)}-${canadianEnergyExportsUsStatesYearRange.min}-${canadianEnergyExportsUsStatesYearRange.max}`;
    }, [lang, canadianEnergyExportsUsStatesYearRange.min, canadianEnergyExportsUsStatesYearRange.max]);

    const formatExports = useCallback(
        (n) => (lang === 'fr' ? n.toLocaleString('fr-CA').replace(/\u00a0/g, ' ') : n.toLocaleString('en-CA')),
        [lang]
    );

    const formatPctTable = useCallback(
        (p) => (lang === 'fr' ? String(p).replace('.', ',') : String(p)),
        [lang]
    );

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

    const downloadChartWithTitle = useCallback(async () => {
        const plotElement = chartRef?.current?.querySelector('.js-plotly-plot');
        if (!plotElement || !window.Plotly) return;
        try {
            const title = stripHtml(getText('canadian_energy_exports_us_states_title', lang).replace(/\{\{year\}\}/g, String(selectedYear)));
            const subtitle = stripHtml(getText('canadian_energy_exports_us_states_subtitle', lang));
            const imgData = await window.Plotly.toImage(plotElement, { format: 'png', width: 1200, height: 720, scale: 2 });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                const titleHeight = 88;
                canvas.width = img.width;
                canvas.height = img.height + titleHeight;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#000000';
                ctx.font = 'bold 22px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(title, canvas.width / 2, 38);
                ctx.font = '18px Arial';
                ctx.fillText(subtitle, canvas.width / 2, 68);
                ctx.drawImage(img, 0, titleHeight);
                const slug = toFileSlug(title);
                canvas.toBlob((blob) => {
                    if (blob) saveAs(blob, `${slug}.png`);
                });
            };
            img.src = imgData;
        } catch (e) {
            console.error(e);
        }
    }, [lang, selectedYear]);

    const downloadTableAsCSV = useCallback(() => {
        const headers = [
            getText('canadian_energy_exports_us_states_table_year', lang),
            getText('canadian_energy_exports_us_states_table_state', lang),
            getText('canadian_energy_exports_us_states_table_exports_mil', lang),
            getText('canadian_energy_exports_us_states_table_pct_gdp', lang),
        ];
        const lines = [
            headers.join(','),
            ...tableRowsForExport.map((row) =>
                [
                    row.year,
                    `"${String(row.state).replace(/"/g, '""')}"`,
                    formatExports(row.exportMil),
                    `${formatPctTable(row.pctGdp)}%`,
                ].join(',')
            ),
        ];
        const csv = lines.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${tableExportStem}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    }, [lang, tableExportStem, tableRowsForExport, formatExports, formatPctTable]);

    const downloadTableAsDocx = useCallback(async () => {
        const yearInHeading =
            canadianEnergyExportsUsStatesYearRange.min === canadianEnergyExportsUsStatesYearRange.max
                ? String(canadianEnergyExportsUsStatesYearRange.min)
                : `${canadianEnergyExportsUsStatesYearRange.min}–${canadianEnergyExportsUsStatesYearRange.max}`;
        const heading = stripHtml(getText('canadian_energy_exports_us_states_title', lang).replace(/\{\{year\}\}/g, yearInHeading));
        const yLabel = getText('canadian_energy_exports_us_states_table_year', lang);
        const sLabel = getText('canadian_energy_exports_us_states_table_state', lang);
        const eLabel = getText('canadian_energy_exports_us_states_table_exports_mil', lang);
        const pLabel = getText('canadian_energy_exports_us_states_table_pct_gdp', lang);
        const headerShade = { fill: 'E6E6E6' };
        const headerCells = [
            new TableCell({
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: yLabel, bold: true, size: 22 })],
                        alignment: AlignmentType.CENTER,
                    }),
                ],
                shading: headerShade,
            }),
            new TableCell({
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: sLabel, bold: true, size: 22 })],
                        alignment: AlignmentType.CENTER,
                    }),
                ],
                shading: headerShade,
            }),
            new TableCell({
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: eLabel, bold: true, size: 22 })],
                        alignment: AlignmentType.CENTER,
                    }),
                ],
                shading: headerShade,
            }),
            new TableCell({
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: pLabel, bold: true, size: 22 })],
                        alignment: AlignmentType.CENTER,
                    }),
                ],
                shading: headerShade,
            }),
        ];
        const dataRows = tableRowsForExport.map(
            (row) =>
                new TableRow({
                    children: [
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [new TextRun({ text: String(row.year), size: 22 })],
                                    alignment: AlignmentType.CENTER,
                                }),
                            ],
                        }),
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [new TextRun({ text: row.state, size: 22 })],
                                    alignment: AlignmentType.LEFT,
                                }),
                            ],
                        }),
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [new TextRun({ text: formatExports(row.exportMil), size: 22 })],
                                    alignment: AlignmentType.RIGHT,
                                }),
                            ],
                        }),
                        new TableCell({
                            children: [
                                new Paragraph({
                                    children: [
                                        new TextRun({
                                            text:
                                                lang === 'fr'
                                                    ? `${formatPctTable(row.pctGdp)} %`
                                                    : `${formatPctTable(row.pctGdp)}%`,
                                            size: 22,
                                        }),
                                    ],
                                    alignment: AlignmentType.RIGHT,
                                }),
                            ],
                        }),
                    ],
                })
        );
        const doc = new Document({
            sections: [
                {
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: heading, bold: true, size: 28 })],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 300 },
                        }),
                        new Table({
                            width: { size: 100, type: WidthType.PERCENTAGE },
                            columnWidths: [900, 5200, 2200, 2200],
                            rows: [new TableRow({ children: headerCells }), ...dataRows],
                        }),
                    ],
                },
            ],
        });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${tableExportStem}.docx`);
    }, [
        lang,
        tableExportStem,
        tableRowsForExport,
        formatExports,
        formatPctTable,
        canadianEnergyExportsUsStatesYearRange.min,
        canadianEnergyExportsUsStatesYearRange.max,
    ]);

    const plotConfig = useMemo(
        () => ({
            displayModeBar: true,
            displaylogo: false,
            responsive: true,
            scrollZoom: false,
            doubleClick: false,
            modeBarButtonsToRemove: [
                'pan2d',
                'select2d',
                'lasso2d',
                'zoom2d',
                'zoomIn2d',
                'zoomOut2d',
                'autoScale2d',
                'resetScale2d',
                'toImage',
            ],
            modeBarButtonsToAdd: [
                {
                    name: lang === 'en' ? 'Download chart as PNG' : 'Télécharger le graphique en PNG',
                    icon: {
                        width: 24,
                        height: 24,
                        path: 'M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z',
                    },
                    click: () => {
                        downloadChartWithTitle();
                    },
                },
            ],
        }),
        [lang, downloadChartWithTitle]
    );

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

    useEffect(() => {
        const topScroll = topScrollRef.current;
        const tableScroll = tableScrollRef.current;
        if (!topScroll || !tableScroll || !isTableOpen) return;
        const syncTopToTable = () => {
            const table = tableScroll.querySelector('table');
            if (table && topScroll.firstChild) {
                topScroll.firstChild.style.width = `${table.scrollWidth}px`;
            }
        };
        const handleTop = () => {
            tableScroll.scrollLeft = topScroll.scrollLeft;
        };
        const handleTable = () => {
            topScroll.scrollLeft = tableScroll.scrollLeft;
        };
        topScroll.addEventListener('scroll', handleTop);
        tableScroll.addEventListener('scroll', handleTable);
        syncTopToTable();
        const ro = new ResizeObserver(() => window.requestAnimationFrame(syncTopToTable));
        const tableEl = tableScroll.querySelector('table');
        if (tableEl) ro.observe(tableEl);
        ro.observe(tableScroll);
        return () => {
            topScroll.removeEventListener('scroll', handleTop);
            tableScroll.removeEventListener('scroll', handleTable);
            ro.disconnect();
        };
    }, [isTableOpen, windowWidth, tableRowsForExport.length]);

    const handleChartClick = (data) => {
        if (!data.points?.length) return;
        const pt = data.points[0];
        if (pt.curveNumber !== 0) return;
        const pointIndex = pt.pointIndex;
        if (pointIndex == null) return;

        if (windowWidth <= 768) {
            const now = Date.now();
            const last = lastClickRef.current;
            const samePoint = pointIndex === last.pointIndex;
            const doubleTap = samePoint && now - last.time < 300;
            lastClickRef.current = { time: now, pointIndex };
            if (!doubleTap) return;
        }

        setSelectedPoints((prev) => {
            if (prev === null) return [pointIndex];
            const isSelected = prev.includes(pointIndex);
            if (isSelected) {
                const next = prev.filter((i) => i !== pointIndex);
                return next.length === 0 ? null : next;
            }
            return [...prev, pointIndex];
        });
    };

    return (
        <main
            id="main-content"
            tabIndex="-1"
            className="page-content page-14"
            role="main"
            aria-labelledby="canadian-energy-exports-us-states-chart-heading"
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
.page-14 { width: 100%; }
.canadian-energy-exports-us-states-container { width: 100%; padding: 15px 0 0 0; box-sizing: border-box; }
.canadian-energy-exports-us-states-year-selector label { display: block; font-size: 14px; font-weight: bold; margin-bottom: 5px; font-family: 'Noto Sans', sans-serif; }
.canadian-energy-exports-us-states-year-selector .canadian-energy-exports-us-states-year-button:hover { border-color: #007bff; }
.canadian-energy-exports-us-states-year-selector .canadian-energy-exports-us-states-year-button:focus { outline: 2px solid #005fcc; outline-offset: 2px; border-color: #007bff; }
.canadian-energy-exports-us-states-chart-frame {
    background-color: #f5f5f5;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 20px;
    box-sizing: border-box;
}
.canadian-energy-exports-us-states-chart-title {
    font-family: 'Lato', sans-serif;
    font-size: 29px;
    font-weight: bold;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 5px 0;
    padding-left: 15px;
}
.canadian-energy-exports-us-states-chart-subtitle {
    font-family: 'Noto Sans', sans-serif;
    font-size: 20px;
    color: var(--gc-text);
    text-align: center;
    margin: 0 0 15px 90px;
    padding-left: 0;
}
.canadian-energy-exports-us-states-map-wrap { width: 100%; position: relative; min-height: 480px; }
.canadian-energy-exports-us-states-map-wrap .js-plotly-plot .plotly .modebar { right: 20px !important; }
.canadian-energy-exports-us-states-table-wrapper { display: block; width: 100%; margin: 20px 0 0 0; }
.canadian-energy-exports-us-states-table-wrapper details > summary {
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
.canadian-energy-exports-us-states-table-wrapper details > summary::-webkit-details-marker { display: none; }
.canadian-energy-exports-us-states-table-wrapper details > summary:hover { background-color: #404040 !important; }
.canadian-energy-exports-us-states-table-wrapper button[type="button"]:hover,
.canadian-energy-exports-us-states-table-wrapper button:hover,
.canadian-energy-exports-us-states-chart-frame button[type="button"]:hover,
.canadian-energy-exports-us-states-chart-frame button:hover { background-color: #404040 !important; }
.canadian-energy-exports-us-states-table-wrapper .table-responsive { display: block; width: 100%; overflow-x: auto; border: 1px solid #ddd; background: #fff; }
.canadian-energy-exports-us-states-table-wrapper .table-responsive table { width: max-content; min-width: 100%; border-collapse: collapse; }
@media (max-width: 1097px) {
    .canadian-energy-exports-us-states-chart-subtitle { margin-left: 60px; }
}
@media (max-width: 960px) {
    .canadian-energy-exports-us-states-chart-subtitle { margin-left: 20px; }
}
@media (max-width: 768px) {
    .canadian-energy-exports-us-states-chart-title { font-size: 26px; }
    .canadian-energy-exports-us-states-chart-subtitle { font-size: 18px; }
}
            `}</style>
            <div className="canadian-energy-exports-us-states-container">
                <div ref={yearDropdownRef} className="canadian-energy-exports-us-states-year-selector" style={{ position: 'relative', marginBottom: '20px', width: '200px' }}>
                    <label htmlFor="canadian-energy-exports-us-states-year-button">{getText('year_slider_label', lang)}</label>
                    <button
                        id="canadian-energy-exports-us-states-year-button"
                        ref={yearButtonRef}
                        type="button"
                        className="canadian-energy-exports-us-states-year-button"
                        onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
                        aria-expanded={isYearDropdownOpen}
                        aria-haspopup="listbox"
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
                            fontSize: '16px',
                            fontFamily: "'Noto Sans', sans-serif",
                        }}
                    >
                        <span>{selectedYear}</span>
                        <span aria-hidden="true" style={{ fontSize: '12px' }}>{isYearDropdownOpen ? '▲' : '▼'}</span>
                    </button>
                    {isYearDropdownOpen && (
                        <div
                            role="listbox"
                            aria-label={getText('year_slider_label', lang)}
                            style={{
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
                                boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                            }}
                        >
                            {[...canadian_energy_exports_us_states_YEAR_LIST].sort((a, b) => b - a).map((y) => {
                                const isSelected = y === selectedYear;
                                return (
                                    <button
                                        key={y}
                                        type="button"
                                        role="option"
                                        aria-selected={isSelected}
                                        onClick={() => {
                                            setSelectedYear(y);
                                            setSelectedPoints(null);
                                            setIsYearDropdownOpen(false);
                                            setTimeout(() => yearButtonRef.current?.focus(), 0);
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
                                            fontFamily: 'Arial, sans-serif',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = isSelected ? '#e0f2fe' : '#f5f5f5';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = isSelected ? '#f0f9ff' : '#fff';
                                        }}
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
                                                backgroundColor: '#fff',
                                            }}
                                        >
                                            {isSelected && (
                                                <span
                                                    style={{
                                                        height: '10px',
                                                        width: '10px',
                                                        borderRadius: '50%',
                                                        backgroundColor: '#000',
                                                    }}
                                                />
                                            )}
                                        </span>
                                        <span style={{ fontSize: '16px', color: '#000000' }}>{y}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    <div role="status" className="wb-inv" aria-live="polite">
                        {selectedYear
                            ? `${lang === 'en' ? 'Showing data for' : 'Données affichées pour'} ${selectedYear}`
                            : ''}
                    </div>
                </div>
                <div className="canadian-energy-exports-us-states-chart-frame">
                    <h2 id="canadian-energy-exports-us-states-chart-heading" className="canadian-energy-exports-us-states-chart-title">
                        {getText('canadian_energy_exports_us_states_title', lang).replace(/\{\{year\}\}/g, String(selectedYear))}
                        <sup
                            id="fn-asterisk-rf-canadian-energy-exports-us-states"
                            style={{ verticalAlign: 'super', fontSize: '0.6em', lineHeight: 0 }}
                        >
                            <a href="#fn-asterisk-canadian-energy-exports-us-states" onClick={scrollToFootnote} className="fn-lnk">
                                <span className="wb-inv">{lang === 'en' ? 'Footnote ' : 'Note de bas de page '}</span>
                                <span aria-hidden="true">*</span>
                            </a>
                        </sup>
                    </h2>
                    <p className="canadian-energy-exports-us-states-chart-subtitle">{getText('canadian_energy_exports_us_states_subtitle', lang)}</p>
                    {selectedPoints !== null && (
                        <div style={{ marginBottom: 8, textAlign: 'center' }}>
                            <button
                                type="button"
                                onClick={() => setSelectedPoints(null)}
                                style={{
                                    padding: '6px 12px',
                                    backgroundColor: '#8C8C8C',
                                    border: '1px solid #404040',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontFamily: 'Arial, sans-serif',
                                    fontSize: 14,
                                    color: '#fff',
                                }}
                            >
                                {lang === 'en' ? 'Clear selection' : 'Effacer la sélection'}
                            </button>
                        </div>
                    )}
                    <div
                        className="canadian-energy-exports-us-states-map-wrap"
                        role="region"
                        aria-label={getText('canadian_energy_exports_us_states_map_aria', lang)}
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
                        <details onToggle={(e) => setIsTableOpen(e.currentTarget.open)}>
                            <summary role="button" aria-expanded={isTableOpen}>
                                <span aria-hidden="true" style={{ marginRight: '8px' }}>{isTableOpen ? '▼' : '▶'}</span>
                                {lang === 'en' ? 'Chart data table' : 'Tableau de données du graphique'}
                                <span className="wb-inv">
                                    {lang === 'en' ? ' Press Enter to open or close.' : ' Appuyez sur Entrée pour ouvrir ou fermer.'}
                                </span>
                            </summary>
                            <div
                                ref={topScrollRef}
                                style={{
                                    width: '100%',
                                    overflowX: 'auto',
                                    overflowY: 'hidden',
                                    marginBottom: 0,
                                    display: windowWidth <= 768 ? 'none' : 'block',
                                }}
                                aria-hidden="true"
                            >
                                <div style={{ height: '20px' }} />
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
                                        {stripHtml(
                                            getText('canadian_energy_exports_us_states_title', lang).replace(
                                                /\{\{year\}\}/g,
                                                canadianEnergyExportsUsStatesYearRange.min === canadianEnergyExportsUsStatesYearRange.max
                                                    ? String(canadianEnergyExportsUsStatesYearRange.min)
                                                    : `${canadianEnergyExportsUsStatesYearRange.min}–${canadianEnergyExportsUsStatesYearRange.max}`
                                            )
                                        )}
                                    </caption>
                                    <thead>
                                        <tr>
                                            <th scope="col" style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #ddd' }}>
                                                {getText('canadian_energy_exports_us_states_table_year', lang)}
                                            </th>
                                            <th scope="col" style={{ fontWeight: 'bold', padding: '10px', border: '1px solid #ddd' }}>
                                                {getText('canadian_energy_exports_us_states_table_state', lang)}
                                            </th>
                                            <th
                                                scope="col"
                                                style={{
                                                    fontWeight: 'bold',
                                                    padding: '10px',
                                                    border: '1px solid #ddd',
                                                    textAlign: 'right',
                                                }}
                                            >
                                                {getText('canadian_energy_exports_us_states_table_exports_mil', lang)}
                                            </th>
                                            <th
                                                scope="col"
                                                style={{
                                                    fontWeight: 'bold',
                                                    padding: '10px',
                                                    border: '1px solid #ddd',
                                                    textAlign: 'right',
                                                }}
                                            >
                                                {getText('canadian_energy_exports_us_states_table_pct_gdp', lang)}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tableRowsForExport.map((row, idx) => (
                                            <tr key={`${row.year}-${row.state}-${idx}`}>
                                                <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>{row.year}</td>
                                                <th scope="row" style={{ fontWeight: 'bold', padding: '8px', border: '1px solid #ddd' }}>
                                                    {row.state}
                                                </th>
                                                <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>
                                                    {formatExports(row.exportMil)}
                                                </td>
                                                <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'right' }}>
                                                    {lang === 'fr'
                                                        ? `${formatPctTable(row.pctGdp)} %`
                                                        : `${formatPctTable(row.pctGdp)}%`}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '15px' }}>
                                    <button
                                        type="button"
                                        onClick={downloadTableAsCSV}
                                        style={{
                                            padding: '8px 16px',
                                            backgroundColor: '#8C8C8C',
                                            border: '1px solid #404040',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontFamily: 'Arial, sans-serif',
                                            fontWeight: 'bold',
                                            color: '#ffffff',
                                        }}
                                    >
                                        {lang === 'en' ? 'Download data (CSV)' : 'Télécharger les données (CSV)'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={downloadTableAsDocx}
                                        style={{
                                            padding: '8px 16px',
                                            backgroundColor: '#8C8C8C',
                                            border: '1px solid #404040',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontFamily: 'Arial, sans-serif',
                                            fontWeight: 'bold',
                                            color: '#ffffff',
                                        }}
                                    >
                                        {lang === 'en' ? 'Download table (DOCX)' : 'Télécharger le tableau (DOCX)'}
                                    </button>
                                </div>
                            </div>
                        </details>
                    </div>
                </div>
                <aside className="wb-fnote" role="note">
                    <h2 id="canadian-energy-exports-us-states-fn-heading">{lang === 'en' ? 'Footnotes' : 'Notes de bas de page'}</h2>
                    <dl>
                        <dt>{lang === 'en' ? 'Footnote *' : 'Note de bas de page *'}</dt>
                        <dd id="fn-asterisk-canadian-energy-exports-us-states">
                            <a
                                href="#fn-asterisk-rf-canadian-energy-exports-us-states"
                                onClick={scrollToRef}
                                className="fn-num"
                                title={
                                    lang === 'en'
                                        ? 'Return to footnote * referrer'
                                        : 'Retour à la référence de la note de bas de page *'
                                }
                            >
                                <span className="wb-inv">
                                    {lang === 'en' ? 'Return to footnote ' : 'Retour à la note de bas de page '}
                                </span>
                                *
                            </a>
                            <p>{getText('canadian_energy_exports_us_states_footnote', lang)}</p>
                        </dd>
                    </dl>
                </aside>
            </div>
        </main>
    );
};

export default CanadianEnergyExportsUsStates;
