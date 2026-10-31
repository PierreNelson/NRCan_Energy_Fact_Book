/**
 * Canada–U.S. natural gas market (factbook page 125).
 * Hardcoded stand-in until a source workbook is wired. Displayed figures,
 * the chart title, and download filenames read these fields.
 */
export const CANADA_US_GAS_MARKET = {
    year: 2025,
    productionBcfd: 127.2,
    productionBcmd: 3.6,
    canadaBcfd: 19.5,
    canadaBcmd: 0.55,
    canadaConventionalPct: 9,
    canadaUnconventionalPct: 91,
    usBcfd: 107.7,
    usBcmd: 3.05,
    usConventionalPct: 16,
    usUnconventionalPct: 84,
    lngImportCanadaMmcfd: 91,
    lngImportUsMmcfd: 38,
    lngExportCanadaMmcfd: 304,
    lngExportUsMmcfd: 15091,
};

export function summarizeCanadaUsGasMarket(bundle = CANADA_US_GAS_MARKET) {
    return { ...bundle };
}
