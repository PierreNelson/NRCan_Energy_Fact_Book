/**
 * Stand-in for the petroleum-and-the-economy series (factbook page 104).
 * Swap PETROLEUM_ECONOMY_ROWS for the pipeline series later. The newest year
 * in the rows is what the chart, chart title, legend, and employment list show.
 * Line-item jobs are stored separately from the printed direct total because
 * the factbook notes that parts may not sum due to rounding.
 */

const round1 = (value) => Math.round(value * 10) / 10;

export const PETROLEUM_ECONOMY_ROWS = [
    {
        year: 2025,
        directPct: 6.1,
        indirectPct: 1.1,
        directBillions: 186.0,
        indirectBillions: 32.1,
        directJobs: 199500,
        indirectJobs: 322000,
        jobs: [
            { key: 'extraction', count: 84800 },
            { key: 'support', count: 60900 },
            { key: 'exploration', count: 3200 },
            { key: 'transmission', count: 19400 },
            { key: 'pipeline', count: 5800 },
            { key: 'other', count: 25200 },
        ],
        indigenousJobs: 11300,
        capitalExpendituresBillions: 55,
        ghgSharePct: 30,
        exportsBillions: 182,
        exportsSharePct: 25,
        oilRank: 4,
        gasRank: 5,
    },
];

export function viewPetroleumEconomyRow(row) {
    const directPct = Number(row.directPct) || 0;
    const indirectPct = Number(row.indirectPct) || 0;
    const directBillions = Number(row.directBillions) || 0;
    const indirectBillions = Number(row.indirectBillions) || 0;
    return {
        ...row,
        directPct,
        indirectPct,
        directBillions,
        indirectBillions,
        restPct: round1(100 - directPct - indirectPct),
        totalPct: round1(directPct + indirectPct),
        totalBillions: round1(directBillions + indirectBillions),
        totalJobs: (Number(row.directJobs) || 0) + (Number(row.indirectJobs) || 0),
    };
}

export function summarizePetroleumEconomy(rows) {
    const sorted = (rows || [])
        .filter((row) => row && Number.isFinite(Number(row.year)))
        .map(viewPetroleumEconomyRow)
        .sort((a, b) => a.year - b.year);
    const latest = sorted[sorted.length - 1] || null;
    return {
        rows: sorted,
        latest,
        startYear: sorted[0]?.year ?? null,
        endYear: latest?.year ?? null,
    };
}
