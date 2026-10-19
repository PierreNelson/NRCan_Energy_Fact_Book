/** Slice colours. Shares and totals come from the pipeline. */

export const PRODUCTION_KEYS = [
    'natural_gas_wo_ccus',
    'coal',
    'fossil_fuels_w_ccus',
    'oil',
    'electricity',
    'by_product',
];

export const DEMAND_KEYS = [
    'refining',
    'ammonia',
    'methanol',
    'steelmaking',
    'transportation_other',
];

export const PRODUCTION_COLORS = {
    by_product: '#6098B0',
    natural_gas_wo_ccus: '#006030',
    coal: '#68A848',
    fossil_fuels_w_ccus: '#A4C639',
    oil: '#585858',
    electricity: '#F9B233',
};

export const DEMAND_COLORS = {
    transportation_other: '#F9B233',
    refining: '#006030',
    ammonia: '#68A848',
    methanol: '#6098B0',
    steelmaking: '#585858',
};

export const DOC_COLUMN_WIDTHS = [4200, 1800, 1800];
