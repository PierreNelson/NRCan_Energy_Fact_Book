/** Hardcoded world biofuels production (PJ), Energy Fact Book p.92. */

export const TRACE_KEYS = [
    'canada',
    'brazil',
    'united_states',
    'european_union',
    'china',
    'rest_of_world',
];

export const LEGEND_KEYS = [...TRACE_KEYS].reverse();

export const COLORS = {
    canada: '#006837',
    brazil: '#7AC043',
    united_states: '#B5D333',
    european_union: '#414042',
    china: '#BDCCD4',
    rest_of_world: '#6399AE',
};

/** DOCX table column widths: Year + 6 categories + Total */
export const DOC_COLUMN_WIDTHS = [900, 1100, 1100, 1400, 1500, 1100, 1500, 1100];

export const Y_TICKVALS = [0, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500];
export const Y_RANGE = [0, 5000];

export const START_YEAR = 2011;
export const END_YEAR = 2023;

export const CHART_DATA = [
    { year: 2011, canada: 50, brazil: 540, united_states: 1240, european_union: 440, china: 100, rest_of_world: 280 },
    { year: 2012, canada: 52, brazil: 555, united_states: 1280, european_union: 450, china: 110, rest_of_world: 295 },
    { year: 2013, canada: 54, brazil: 640, united_states: 1350, european_union: 470, china: 120, rest_of_world: 310 },
    { year: 2014, canada: 55, brazil: 690, united_states: 1440, european_union: 490, china: 130, rest_of_world: 370 },
    { year: 2015, canada: 56, brazil: 745, united_states: 1480, european_union: 500, china: 145, rest_of_world: 340 },
    { year: 2016, canada: 57, brazil: 755, united_states: 1510, european_union: 520, china: 155, rest_of_world: 365 },
    { year: 2017, canada: 58, brazil: 775, united_states: 1560, european_union: 545, china: 165, rest_of_world: 410 },
    { year: 2018, canada: 60, brazil: 870, united_states: 1600, european_union: 580, china: 180, rest_of_world: 540 },
    { year: 2019, canada: 62, brazil: 940, united_states: 1560, european_union: 670, china: 205, rest_of_world: 615 },
    { year: 2020, canada: 55, brazil: 845, united_states: 1450, european_union: 640, china: 235, rest_of_world: 575 },
    { year: 2021, canada: 58, brazil: 875, united_states: 1520, european_union: 700, china: 285, rest_of_world: 740 },
    { year: 2022, canada: 60, brazil: 950, united_states: 1720, european_union: 760, china: 340, rest_of_world: 800 },
    { year: 2023, canada: 48, brazil: 1054, united_states: 1964, european_union: 760, china: 192, rest_of_world: 773 },
];

export const rowTotal = (row) =>
    TRACE_KEYS.reduce((sum, key) => sum + (Number(row[key]) || 0), 0);
