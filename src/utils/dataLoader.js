/**
 * Data Loader Utility
 * 
 * Loads pre-calculated data from data.csv stored in public/data/
 * All calculations are done in the scripts/main.py pipeline - this module just loads and parses.
 * 
 * Data is stored with semantic vector prefixes:
 * - capex_*: Capital expenditure data
 * - infra_*: Infrastructure stock data
 * - econ_*: Economic contributions data
 * - asset_*: Investment by asset type data
 * - projects_*: Major energy projects data
 * - cleantech_*: Clean technology trends data
 * - intl_*: International investment data
 * - foreign_*: Foreign control data
 * - enviro_*: Environmental protection data
 * - gdp_prov_*: Provincial GDP data
 */

let dataCache = null;

/**
 * Parse CSV text into array of objects
 */
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length === 0) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let char of lines[i]) {
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());
        
        const row = {};
        headers.forEach((header, idx) => {
            let val = values[idx] || '';
            const num = parseFloat(val);
            row[header] = isNaN(num) ? val : num;
        });
        data.push(row);
    }
    
    return data;
}

/**
 * Load all data from data.csv (cached)
 * Uses import.meta.env.BASE_URL to work correctly on GitHub Pages
 */
async function loadAllData() {
    if (dataCache !== null) {
        return dataCache;
    }
    
    const baseUrl = import.meta.env.BASE_URL || '/';
    const response = await fetch(`${baseUrl}data/data.csv`);
    if (!response.ok) {
        throw new Error(`Failed to load data.csv: ${response.status} ${response.statusText}`);
    }
    
    const csvText = await response.text();
    dataCache = parseCSV(csvText);
    return dataCache;
}

/**
 * Get capital expenditures data
 * Returns array of objects with raw values (millions), percentages, and billions:
 * { year, oil_gas, electricity, other, total, oil_gas_pct, electricity_pct, other_pct, 
 *   oil_gas_billions, electricity_billions, other_billions, total_billions }
 * Percentages and billions are pre-calculated in the database.
 */
export async function getCapitalExpendituresData() {
    const allData = await loadAllData();
    
    const capexData = allData.filter(row => row.vector && row.vector.startsWith('capex_'));
    
    const yearMap = {};
    capexData.forEach(row => {
        const year = row.ref_date;
        if (!yearMap[year]) {
            yearMap[year] = { year };
        }
        const field = row.vector.replace('capex_', '');
        yearMap[year][field] = row.value;
    });
    
    return Object.values(yearMap).sort((a, b) => a.year - b.year);
}

/**
 * Get infrastructure data
 * Returns array of objects with raw values (millions), percentages, and billions:
 * { year, fuel_energy_pipelines, transport, health_housing, education, public_safety, environmental, total,
 *   fuel_energy_pipelines_pct, transport_pct, health_housing_pct, education_pct, public_safety_pct, environmental_pct,
 *   fuel_energy_pipelines_billions, transport_billions, health_housing_billions, education_billions, 
 *   public_safety_billions, environmental_billions, total_billions }
 * Percentages and billions are pre-calculated in the database.
 */
export async function getInfrastructureData() {
    const allData = await loadAllData();
    
    const infraData = allData.filter(row => row.vector && row.vector.startsWith('infra_'));
    
    const yearMap = {};
    infraData.forEach(row => {
        const year = row.ref_date;
        if (!yearMap[year]) {
            yearMap[year] = { year };
        }
        const field = row.vector.replace('infra_', '');
        yearMap[year][field] = row.value;
    });
    
    return Object.values(yearMap).sort((a, b) => a.year - b.year);
}

/**
 * Get economic contributions data
 * Returns array of objects with raw values and pre-calculated display values:
 * { year, jobs, employment_income, gdp, investment_value,
 *   jobs_thousands, employment_income_billions, gdp_billions, investment_value_billions }
 * Pre-calculated values are computed in the database (thousands for jobs, billions for monetary).
 */
export async function getEconomicContributionsData() {
    const allData = await loadAllData();
    
    const econData = allData.filter(row => row.vector && row.vector.startsWith('econ_'));
    
    const yearMap = {};
    econData.forEach(row => {
        const year = row.ref_date;
        if (!yearMap[year]) {
            yearMap[year] = { year };
        }
        const field = row.vector.replace('econ_', '');
        yearMap[year][field] = row.value;
    });
    
    return Object.values(yearMap).sort((a, b) => a.year - b.year);
}

/**
 * Get investment by asset type data
 * Returns array of objects with breakdown by asset type (raw values in millions and pre-calculated billions):
 * { year, transmission_distribution, pipelines, nuclear, other_electric, hydraulic, wind_solar, steam_thermal, total,
 *   transmission_distribution_billions, pipelines_billions, nuclear_billions, other_electric_billions,
 *   hydraulic_billions, wind_solar_billions, steam_thermal_billions, total_billions }
 * Billions values are pre-calculated in the database.
 */
export async function getInvestmentByAssetData() {
    const allData = await loadAllData();
    
    const assetData = allData.filter(row => row.vector && row.vector.startsWith('asset_'));
    
    const yearMap = {};
    assetData.forEach(row => {
        const year = row.ref_date;
        if (!yearMap[year]) {
            yearMap[year] = { year };
        }
        const field = row.vector.replace('asset_', '');
        yearMap[year][field] = row.value;
    });
    
    return Object.values(yearMap).sort((a, b) => a.year - b.year);
}

/**
 * Get international investment data
 * Returns array of objects: { year, cdia, fdi }
 * CDIA = Canadian Direct Investment Abroad
 * FDI = Foreign Direct Investment in Canada
 * Values are in millions of dollars
 */
export async function getInternationalInvestmentData() {
    const allData = await loadAllData();
    
    const intlData = allData.filter(row => row.vector && row.vector.startsWith('intl_'));
    
    const yearMap = {};
    intlData.forEach(row => {
        const year = row.ref_date;
        if (!yearMap[year]) {
            yearMap[year] = { year };
        }
        const field = row.vector.replace('intl_', '');
        yearMap[year][field] = row.value;
    });
    
    return Object.values(yearMap).sort((a, b) => a.year - b.year);
}

/**
 * Get foreign control data
 * Returns array of objects: { year, utilities, oil_gas, all_non_financial }
 * Values are percentages
 */
export async function getForeignControlData() {
    const allData = await loadAllData();
    
    const foreignData = allData.filter(row => row.vector && row.vector.startsWith('foreign_'));
    
    const yearMap = {};
    foreignData.forEach(row => {
        const year = row.ref_date;
        if (!yearMap[year]) {
            yearMap[year] = { year };
        }
        const field = row.vector.replace('foreign_', '');
        yearMap[year][field] = row.value;
    });
    
    return Object.values(yearMap).sort((a, b) => a.year - b.year);
}

/**
 * Get environmental protection expenditures data
 * Returns array of objects: { 
 *   year, 
 *   oil_gas_total, oil_gas_wastewater, oil_gas_soil, oil_gas_air, oil_gas_solid_waste, oil_gas_other,
 *   electric_total, petroleum_total, all_industries_total 
 * }
 * Values are in millions of dollars
 */
export async function getEnvironmentalProtectionData() {
    const allData = await loadAllData();
    
    const enviroData = allData.filter(row => row.vector && row.vector.startsWith('enviro_'));
    
    const yearMap = {};
    enviroData.forEach(row => {
        const year = row.ref_date;
        if (!yearMap[year]) {
            yearMap[year] = { year };
        }
        const field = row.vector.replace('enviro_', '');
        yearMap[year][field] = row.value;
    });
    
    return Object.values(yearMap).sort((a, b) => a.year - b.year);
}

/**
 * Get provincial GDP data
 * Returns array of objects: { year, nl, pe, ns, nb, qc, on, mb, sk, ab, bc, yt, nt, nu, national_total }
 * Values are in millions of dollars
 */
export async function getProvincialGdpData() {
    const allData = await loadAllData();
    
    const gdpData = allData.filter(row => row.vector && row.vector.startsWith('gdp_prov_'));
    
    const yearMap = {};
    gdpData.forEach(row => {
        const year = row.ref_date;
        if (!yearMap[year]) {
            yearMap[year] = { year };
        }
        const field = row.vector.replace('gdp_prov_', '');
        yearMap[year][field] = row.value;
    });
    
    return Object.values(yearMap).sort((a, b) => a.year - b.year);
}

/**
 * Get major energy projects data
 * Returns object with:
 * - yearlyData: array of { year, oil_gas_value, oil_gas_projects, electricity_value, electricity_projects, other_value, other_projects, total_value, total_projects }
 * - summary: { planned_projects, planned_value, construction_projects, construction_value, clean_tech_projects, clean_tech_value }
 * Values in billions of dollars
 */
export async function getMajorProjectsData() {
    const allData = await loadAllData();
    
    const projectsData = allData.filter(row => row.vector && row.vector.startsWith('projects_'));
    
    const yearlyFieldMap = {
        'oil_gas_value': 'oil_gas_value',
        'oil_gas_count': 'oil_gas_projects',
        'electricity_value': 'electricity_value',
        'electricity_count': 'electricity_projects',
        'other_value': 'other_value',
        'other_count': 'other_projects',
        'total_value': 'total_value',
        'total_count': 'total_projects'
    };
    
    const summaryFieldMap = {
        'planned_count': 'planned_projects',
        'planned_value': 'planned_value',
        'construction_count': 'construction_projects',
        'construction_value': 'construction_value',
        'cleantech_count': 'clean_tech_projects',
        'cleantech_value': 'clean_tech_value'
    };
    
    const yearMap = {};
    const summary = {};
    
    projectsData.forEach(row => {
        const year = row.ref_date;
        const rawField = row.vector.replace('projects_', '');
        
        if (summaryFieldMap[rawField]) {
            summary[summaryFieldMap[rawField]] = row.value;
        } else if (yearlyFieldMap[rawField]) {
            if (!yearMap[year]) {
                yearMap[year] = { year };
            }
            yearMap[year][yearlyFieldMap[rawField]] = row.value;
        }
    });
    
    return {
        yearlyData: Object.values(yearMap).sort((a, b) => a.year - b.year),
        summary
    };
}

/**
 * Get clean technology project trends data
 * Returns array of objects with yearly data for each technology category:
 * { year, total_projects, total_value, hydro_projects, hydro_value, wind_projects, wind_value, ... }
 * Values in billions of dollars
 */
export async function getCleanTechTrendsData() {
    const allData = await loadAllData();
    
    const cleantechData = allData.filter(row => row.vector && row.vector.startsWith('cleantech_'));
    
    const yearMap = {};
    
    cleantechData.forEach(row => {
        const year = row.ref_date;
        const rawField = row.vector.replace('cleantech_', '');
        
        const field = rawField.replace('_count', '_projects');
        
        if (!yearMap[year]) {
            yearMap[year] = { year };
        }
        yearMap[year][field] = row.value;
    });
    
    return Object.values(yearMap).sort((a, b) => a.year - b.year);
}

export async function getNominalGDPData() {
    const allData = await loadAllData();
    
    const gdpData = allData.filter(row => row.vector && row.vector.startsWith('gdp_nominal_'));
    
    const yearMap = {};
    gdpData.forEach(row => {
        const year = row.ref_date;
        if (!yearMap[year]) {
            yearMap[year] = { year };
        }
        const field = row.vector.replace('gdp_nominal_', '');
        yearMap[year][field] = row.value;
    });
    
    return Object.values(yearMap).sort((a, b) => a.year - b.year);
}

/**
 * Get Canadian Energy Assets (CEA) data
 * Returns array of objects: { 
 *   year, total, domestic, abroad, 
 *   africa, asia, canada, europe, latin_america, north_america, oceania 
 * }
 * Values are in billions of dollars
 */
export async function getCEAData() {
    const allData = await loadAllData();
    
    const ceaData = allData.filter(row => row.vector && row.vector.startsWith('cea_'));
    
    const yearMap = {};
    ceaData.forEach(row => {
        const year = row.ref_date;
        if (!yearMap[year]) {
            yearMap[year] = { year };
        }
        const field = row.vector.replace('cea_', '');
        yearMap[year][field] = row.value;
    });
    
    return Object.values(yearMap).sort((a, b) => a.year - b.year);
}

export async function getWorldEnergyProductionData() {
    const allData = await loadAllData();
    
    const energyData = allData.filter(row => row.vector && row.vector.startsWith('energy_prod_'));
    
    const yearMap = {};
    energyData.forEach(row => {
        const year = row.ref_date;
        if (!yearMap[year]) {
            yearMap[year] = { year };
        }
        const field = row.vector.replace('energy_prod_', '');
        yearMap[year][field] = row.value;
    });
    
    return Object.values(yearMap).sort((a, b) => a.year - b.year);
}

/**
 * Get GHG emissions by economic sector data
 * Returns array of objects: { 
 *   year, oil_gas, electricity, transportation, heavy_industry, 
 *   buildings, agriculture, waste_others 
 * }
 * Values are in megatonnes of CO2 equivalent
 */
export async function getGHGEmissionsData() {
    const allData = await loadAllData();
    
    const ghgData = allData.filter(row => row.vector && row.vector.startsWith('ghg_'));
    
    const yearMap = {};
    ghgData.forEach(row => {
        const year = row.ref_date;
        if (!yearMap[year]) {
            yearMap[year] = { year };
        }
        const field = row.vector.replace('ghg_', '');
        yearMap[year][field] = row.value;
    });
    
    return Object.values(yearMap).sort((a, b) => a.year - b.year);
}

/**
 * Get environmental and clean technology snapshot data.
 * Returns { snapshots, years, tmx }. snapshots: array of snapshot objects (one per year 2007..latest);
 * years: [2007, ..., latest]; tmx: TSX stats if available (from most recent year with tmx data).
 */
export async function getEnvironmentalCleanTechData() {
    const allData = await loadAllData();
    const ectData = allData.filter(row => row.vector && row.vector.startsWith('envcleantech_'));
    const yearMap = {};
    ectData.forEach(row => {
        const rawYear = row.ref_date;
        const year = typeof rawYear === 'number' && !Number.isNaN(rawYear) ? rawYear : Number(rawYear) || rawYear;
        if (!yearMap[year]) {
            yearMap[year] = { year };
        }
        const field = row.vector.replace('envcleantech_', '');
        yearMap[year][field] = row.value;
    });
    const sorted = Object.values(yearMap).sort((a, b) => Number(a.year) - Number(b.year));
    const minYear = 2007;
    const maxYear = sorted.length ? Math.max(...sorted.map((s) => Number(s.year))) : minYear;
    const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);
    const marketGdpByYear = {};
    allData.forEach((row) => {
        if (row.vector !== 'gdp_nominal_market') return;
        const yr = typeof row.ref_date === 'number' ? row.ref_date : Number(row.ref_date);
        if (!Number.isNaN(yr)) marketGdpByYear[yr] = Number(row.value);
    });
    const snapshots = years.map((y) => {
        const row = yearMap[y] || { year: y };
        const emp = row.employment_total;
        const gdp = row.gdp_annual;
        const jobsTotal = row.eco_jobs_total;
        const jobsClean = row.eco_jobs_clean_energy;
        const exports = row.eco_exports;
        const gdpBillions = gdp != null ? gdp / 1000 : null;
        const exportsBillions = exports != null ? exports / 1000 : null;
        const jobsPct = emp != null && emp !== 0 && jobsTotal != null ? (jobsTotal / (emp * 1000)) * 100 : null;
        const totalMarketGdp = marketGdpByYear[y];
        const gdp_pct = (gdp != null && totalMarketGdp != null && totalMarketGdp > 0)
            ? Math.round((gdp / totalMarketGdp) * 1000) / 10
            : null;
        const cleanEnergyGdp = row.clean_energy_gdp;
        const clean_energy_gdp_pct = (cleanEnergyGdp != null && totalMarketGdp != null && totalMarketGdp > 0)
            ? Math.round((cleanEnergyGdp / totalMarketGdp) * 1000) / 10
            : null;
        return {
            year: y,
            employment_total: emp,
            gdp_annual: gdp,
            gdp_billions: gdpBillions,
            gdp_pct: gdp_pct ?? null,
            clean_energy_gdp_pct: clean_energy_gdp_pct ?? null,
            eco_jobs_total: jobsTotal,
            eco_jobs_clean_energy: jobsClean,
            eco_exports: exports,
            eco_exports_billions: exportsBillions,
            jobs_pct: jobsPct,
        };
    });
    // TMX: from the most recent year that has tmx data
    const withTmx = sorted.filter((y) => y.tmx_count != null || y.tmx_mcap_total != null);
    const tmxSource = withTmx.length ? withTmx[withTmx.length - 1] : null;
    const tmxCount = tmxSource?.tmx_count;
    const tmxMcap = tmxSource?.tmx_mcap_total;
    const tmxCanCount = tmxSource?.tmx_can_count;
    const tmxCanMcap = tmxSource?.tmx_can_mcap;
    return {
        snapshots,
        years,
        tmx: (tmxCount != null || tmxMcap != null) ? { count: tmxCount, mcap_total: tmxMcap, can_count: tmxCanCount, can_mcap: tmxCanMcap } : null,
    };
}
