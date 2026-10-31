/** Stand-in series read from the 2025-2026 factbook charts. 2025 anchors match the printed donut and trade callouts. */

const BCM_PER_BCF = 0.55 / 19.5;

const bcm = (bcfd, printed) => (printed != null ? printed : Math.round(bcfd * BCM_PER_BCF * 100) / 100);

const PRODUCTION = [
    { year: 2009, canadaBcfd: 15.5, usBcfd: 54.9 },
    { year: 2010, canadaBcfd: 14.1, usBcfd: 56.4 },
    { year: 2011, canadaBcfd: 14.1, usBcfd: 58.8 },
    { year: 2012, canadaBcfd: 14.1, usBcfd: 63.2 },
    { year: 2013, canadaBcfd: 13.6, usBcfd: 65.6 },
    { year: 2014, canadaBcfd: 14.1, usBcfd: 67.5 },
    { year: 2015, canadaBcfd: 14.1, usBcfd: 71.9 },
    { year: 2016, canadaBcfd: 15.1, usBcfd: 73.4 },
    { year: 2017, canadaBcfd: 16.5, usBcfd: 73.8 },
    { year: 2018, canadaBcfd: 17.0, usBcfd: 80.2 },
    { year: 2019, canadaBcfd: 17.0, usBcfd: 89.4 },
    { year: 2020, canadaBcfd: 16.0, usBcfd: 92.3 },
    { year: 2021, canadaBcfd: 16.5, usBcfd: 93.8 },
    { year: 2022, canadaBcfd: 18.0, usBcfd: 98.6 },
    { year: 2023, canadaBcfd: 18.5, usBcfd: 102.5 },
    { year: 2024, canadaBcfd: 18.9, usBcfd: 103.0 },
    { year: 2025, canadaBcfd: 19.5, usBcfd: 107.7, canadaBcmd: 0.55, usBcmd: 3.05 },
];

const TRADE = [
    { year: 2009, exportsBcfd: 9.7, importsBcfd: 1.3 },
    { year: 2010, exportsBcfd: 8.7, importsBcfd: 1.6 },
    { year: 2011, exportsBcfd: 8.7, importsBcfd: 2.1 },
    { year: 2012, exportsBcfd: 8.5, importsBcfd: 2.7 },
    { year: 2013, exportsBcfd: 8.0, importsBcfd: 2.6 },
    { year: 2014, exportsBcfd: 7.5, importsBcfd: 2.4 },
    { year: 2015, exportsBcfd: 7.2, importsBcfd: 2.0 },
    { year: 2016, exportsBcfd: 7.5, importsBcfd: 1.8 },
    { year: 2017, exportsBcfd: 8.0, importsBcfd: 2.0 },
    { year: 2018, exportsBcfd: 7.7, importsBcfd: 2.0 },
    { year: 2019, exportsBcfd: 7.3, importsBcfd: 2.0 },
    { year: 2020, exportsBcfd: 6.9, importsBcfd: 2.0 },
    { year: 2021, exportsBcfd: 7.3, importsBcfd: 1.9 },
    { year: 2022, exportsBcfd: 8.0, importsBcfd: 2.0 },
    { year: 2023, exportsBcfd: 8.0, importsBcfd: 2.0 },
    { year: 2024, exportsBcfd: 8.5, importsBcfd: 2.0 },
    { year: 2025, exportsBcfd: 8.8, importsBcfd: 2.2, exportsBcmd: 0.25, importsBcmd: 0.06 },
];

const PROVINCE_KEYS = ['alta', 'bc', 'sask', 'other'];

const PROVINCE_YEARS = [
    {
        year: 2025,
        totalBcfd: 19.5,
        totalBcmd: 0.55,
        slices: [
            { key: 'alta', pct: 63.2 },
            { key: 'bc', pct: 35.8 },
            { key: 'sask', pct: 0.8 },
            { key: 'other', pct: 0.1 },
        ],
    },
];

const withProduction = (row) => ({
    ...row,
    canadaBcmd: bcm(row.canadaBcfd, row.canadaBcmd),
    usBcmd: bcm(row.usBcfd, row.usBcmd),
});

const withTrade = (row) => ({
    ...row,
    exportsBcmd: bcm(row.exportsBcfd, row.exportsBcmd),
    importsBcmd: bcm(row.importsBcfd, row.importsBcmd),
});

export function summarizeNaturalGasProductionTrade() {
    const production = PRODUCTION.map(withProduction);
    const trade = TRADE.map(withTrade);
    const provinces = PROVINCE_YEARS.map((yearRow) => ({
        ...yearRow,
        slices: yearRow.slices.map((slice) => ({
            ...slice,
            bcfd: Math.round(yearRow.totalBcfd * slice.pct) / 100,
            bcmd: Math.round(yearRow.totalBcmd * slice.pct) / 100,
        })),
    }));
    const years = production.map((row) => row.year);
    const latestYear = Math.max(...years);
    const provinceYear = provinces.reduce((newest, row) => (row.year > newest.year ? row : newest), provinces[0]);
    const tradeYear = trade.reduce((newest, row) => (row.year > newest.year ? row : newest), trade[0]);
    return {
        production,
        trade,
        provinces,
        provinceKeys: PROVINCE_KEYS,
        latestYear,
        yearSpan: `${years[0]}-${years[years.length - 1]}`,
        provinceYear,
        tradeYear,
    };
}
