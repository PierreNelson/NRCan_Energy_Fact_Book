/**
 * Canada–U.S. natural gas resources (factbook page 124).
 * Hardcoded stand-in until a source workbook is wired. The newest value in
 * each field is what the infographic, table, and filenames read.
 */
export const CANADA_US_GAS_RESOURCES = {
    provedYear: 2024,
    canadaProvedTcf: 196,
    usProvedTcf: 604,
    provedTotalTcf: 800,
    canadaYear: 2023,
    canadaTotalTcf: 1368,
    canadaConventionalTcf: 380,
    canadaUnconventionalTcf: 988,
    worldYear: 2022,
    worldTotalTcf: 28358,
    worldConventionalTcf: 14867,
    worldUnconventionalTcf: 13490,
    usYear: 2020,
    usTotalTcf: 2973,
    usShaleTightTcf: 2172,
    usOtherTcf: 801,
};

export function summarizeCanadaUsGasResources(bundle = CANADA_US_GAS_RESOURCES) {
    const years = [bundle.provedYear, bundle.canadaYear, bundle.worldYear, bundle.usYear]
        .map(Number)
        .filter((year) => Number.isFinite(year));
    const startYear = years.length ? Math.min(...years) : null;
    const endYear = years.length ? Math.max(...years) : null;
    return { ...bundle, startYear, endYear };
}
