/** World biofuels production chart categories, Energy Fact Book p.92. */

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

export const rowTotal = (row) =>
    TRACE_KEYS.reduce((sum, key) => sum + (Number(row[key]) || 0), 0);
