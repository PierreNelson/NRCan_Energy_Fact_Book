/**
 * Stand-in series for Canadian crude oil imports (printed page 116).
 * Replace `CANADIAN_CRUDE_IMPORT_ROWS` with the pipeline series when a source exists.
 * The newest year drives the share bars, both chart titles, and the infographic figures.
 * Set `snapshot` on a year when the printed country list differs from the stacked origins
 * (2025 lists Ecuador, which the stacked chart includes in Other). Omit `snapshot` and the
 * left list is derived from that year's origin volumes.
 */

export const ORIGIN_KEYS = ['us', 'saudi', 'nigeria', 'algeria', 'iraq', 'norway', 'other'];

export const STACK_COLORS = {
    us: '#3d2914',
    saudi: '#7eb6d9',
    nigeria: '#e87722',
    algeria: '#1e3a5f',
    iraq: '#c4a574',
    norway: '#b0b0b0',
    other: '#5ec8e8',
};

export const SHARE_VALUE_COLOR = '#5aa3cc';
export const SHARE_TRACK_COLOR = '#e6e6e6';

const row = (year, us, saudi, nigeria, algeria, iraq, norway, other, extra = {}) => ({
    year,
    us,
    saudi,
    nigeria,
    algeria,
    iraq,
    norway,
    other,
    ...extra,
});

export const CANADIAN_CRUDE_IMPORT_ROWS = [
    row(2013, 90, 180, 90, 150, 60, 80, 50),
    row(2014, 130, 160, 80, 120, 50, 70, 40),
    row(2015, 220, 150, 70, 110, 45, 90, 55),
    row(2016, 280, 140, 60, 90, 40, 70, 50),
    row(2017, 340, 120, 50, 70, 30, 50, 40),
    row(2018, 400, 90, 40, 45, 25, 30, 30),
    row(2019, 480, 70, 35, 30, 20, 25, 40),
    row(2020, 320, 50, 25, 15, 10, 20, 30),
    row(2021, 340, 40, 25, 8, 5, 12, 30),
    row(2022, 370, 40, 28, 5, 0, 7, 50),
    row(2023, 390, 45, 30, 0, 0, 5, 50),
    row(2024, 400, 40, 30, 0, 0, 0, 40),
    row(2025, 388, 56, 56, 0, 0, 0, 10, {
        snapshot: [
            { key: 'us', pct: 76 },
            { key: 'saudi', pct: 11 },
            { key: 'nigeria', pct: 11 },
            { key: 'ecuador', pct: 2 },
        ],
        usCrudeImportSharePct: 63,
        usRefineryIntakeSharePct: 23,
        exportsToUsMmbd: 3.9,
        canadianExportSharePct: 90,
    }),
];

export function originTotal(entry) {
    return ORIGIN_KEYS.reduce((sum, key) => sum + (Number(entry?.[key]) || 0), 0);
}

export function shareSnapshot(entry) {
    if (!entry) return [];
    if (Array.isArray(entry.snapshot) && entry.snapshot.length) {
        return entry.snapshot.map((item) => ({
            key: item.key,
            pct: Number(item.pct) || 0,
        }));
    }
    const total = originTotal(entry);
    if (!total) return [];
    return ORIGIN_KEYS
        .filter((key) => Number(entry[key]) > 0)
        .map((key) => ({
            key,
            pct: Math.round((Number(entry[key]) / total) * 100),
        }));
}

export function summarizeCanadianCrudeImports(rows) {
    const sorted = [...(rows || [])].filter((entry) => entry && entry.year != null)
        .sort((a, b) => a.year - b.year);
    const latest = sorted[sorted.length - 1] || null;
    const figureRow = [...sorted].reverse().find((entry) => entry.usCrudeImportSharePct != null) || null;
    return {
        rows: sorted,
        latest,
        startYear: sorted[0]?.year ?? null,
        endYear: latest?.year ?? null,
        snapshot: shareSnapshot(latest),
        infographic: figureRow ? {
            year: figureRow.year,
            usCrudeImportSharePct: figureRow.usCrudeImportSharePct,
            usRefineryIntakeSharePct: figureRow.usRefineryIntakeSharePct,
            exportsToUsMmbd: figureRow.exportsToUsMmbd,
            canadianExportSharePct: figureRow.canadianExportSharePct,
        } : null,
    };
}
