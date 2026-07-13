/** Hardcoded global hydrogen production & demand (2024) — Factbook p.101. */

export const REFERENCE_YEAR = 2024;

export const PRODUCTION_KEYS = [
    'by_product',
    'natural_gas_wo_ccus',
    'coal',
    'fossil_fuels_w_ccus',
    'oil',
    'electricity',
];

export const DEMAND_KEYS = [
    'transportation_other',
    'refining',
    'ammonia',
    'methanol',
    'steelmaking',
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

/** Percent shares by year; labels are keyed by category so they follow slices if years are added later. */
export const DATA_BY_YEAR = {
    2024: {
        totalMt: 100,
        production: {
            by_product: 15,
            natural_gas_wo_ccus: 63,
            coal: 21,
            fossil_fuels_w_ccus: 0.7,
            oil: 0.7,
            electricity: 0.1,
        },
        demand: {
            transportation_other: 1,
            refining: 44,
            ammonia: 33,
            methanol: 17,
            steelmaking: 6,
        },
    },
};

export const DOC_COLUMN_WIDTHS = [4200, 1800, 1800];
