/**
 * Data Loader Utility
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
 * - oee_neud_*: Energy use (secondary by sector + primary demand components), PJ
 */

import { CANADIAN_GENERATION_PROVINCE_ORDER } from '../components/Page66GenerationInfographic.constants.js';

let dataCache = null;
let metadataCache = null;

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
 * Load vector metadata from metadata.csv (cached)
 */
async function loadMetadata() {
    if (metadataCache !== null) {
        return metadataCache;
    }

    const baseUrl = import.meta.env.BASE_URL || '/';
    const response = await fetch(`${baseUrl}data/metadata.csv`);
    if (!response.ok) {
        throw new Error(`Failed to load metadata.csv: ${response.status} ${response.statusText}`);
    }

    const csvText = await response.text();
    const rows = parseCSV(csvText);
    metadataCache = rows.reduce((acc, row) => {
        if (row.vector) {
            acc[row.vector] = row;
        }
        return acc;
    }, {});
    return metadataCache;
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

    const ghgData = allData.filter(
        (row) =>
            row.vector &&
            row.vector.startsWith('ghg_') &&
            !row.vector.startsWith('ghg_oilgas_spotlight'),
    );

    const yearMap = {};
    ghgData.forEach(row => {
        const year = row.ref_date;
        if (!yearMap[year]) {
            yearMap[year] = { year };
        }
        const field = row.vector.replace('ghg_', '');
        yearMap[year][field] = row.value;
    });

    return Object.values(yearMap)
        .filter((row) => Number(row.year) >= 2020)
        .sort((a, b) => a.year - b.year);
}

export async function getGhgNarrativeStats() {
    const allData = await loadAllData();
    const stats = {};
    allData.forEach((row) => {
        if (!row.vector?.startsWith('ghg_stat_')) return;
        stats[row.vector] = Number(row.value);
    });
    return {
        baseYear: stats.ghg_stat_narrative_base_year ?? 2000,
        endYear: stats.ghg_stat_narrative_end_year ?? 2023,
        electricityPct: stats.ghg_stat_electricity_emissions_pct,
        oilGasEmissionsPct: stats.ghg_stat_oil_gas_emissions_pct,
        heavyIndustryPct: stats.ghg_stat_heavy_industry_emissions_pct,
        crudeProductionPct: stats.ghg_stat_crude_production_pct,
        oilGasSpotlightTotalPct: stats.ghg_stat_oil_gas_spotlight_total_pct,
        convGasPct: stats.ghg_stat_conv_gas_emissions_pct,
        oilSandsRatio: stats.ghg_stat_oil_sands_emissions_ratio,
    };
}

export async function getOilGasGhgSpotlightData() {
    const allData = await loadAllData();
    const vectors = [
        'ghg_oilgas_spotlight_oil_sands',
        'ghg_oilgas_spotlight_natural_gas',
        'ghg_oilgas_spotlight_conventional_oil',
        'ghg_oilgas_spotlight_other'
    ];
    const rows = allData.filter((row) => vectors.includes(row.vector));
    const yearMap = {};
    rows.forEach((row) => {
        const y = row.ref_date;
        if (!yearMap[y]) {
            yearMap[y] = { year: y };
        }
        if (row.vector === 'ghg_oilgas_spotlight_oil_sands') {
            yearMap[y].oil_sands = row.value;
        } else if (row.vector === 'ghg_oilgas_spotlight_natural_gas') {
            yearMap[y].natural_gas = row.value;
        } else if (row.vector === 'ghg_oilgas_spotlight_conventional_oil') {
            yearMap[y].conventional_oil = row.value;
        } else if (row.vector === 'ghg_oilgas_spotlight_other') {
            yearMap[y].other = row.value;
        }
    });
    return Object.values(yearMap)
        .filter((r) => r.oil_sands != null && r.natural_gas != null && r.conventional_oil != null && r.other != null)
        .sort((a, b) => a.year - b.year);
}

/**
 * Environmental and clean technology shows a year only when every infographic stat is populated (excludes partial/future
 * StatCan rows such as market GDP without matching eco-sector indicators).
 */
export function environmentalCleanTechSnapshotHasCompleteData(snap) {
    if (!snap) return false;
    return snap.eco_gdp != null
        && snap.gdp_pct != null
        && snap.eco_jobs_total != null
        && snap.jobs_pct != null
        && snap.eco_exports != null
        && snap.clean_energy_gdp_pct != null
        && snap.eco_jobs_clean_energy != null;
}

/**
 * Get environmental and clean technology snapshot data.
 * Returns { snapshots, years, startYear, endYear, tmx }.
 * snapshots/years: only years with complete infographic and table data;
 * tmx: TSX stats if available (from most recent year with tmx data).
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
    const candidateYears = sorted
        .map((s) => Number(s.year))
        .filter((y) => !Number.isNaN(y) && y >= minYear);
    const marketGdpByYear = {};
    ectData.forEach((row) => {
        if (row.vector === 'envcleantech_canada_gdp_market') {
            const yr = typeof row.ref_date === 'number' ? row.ref_date : Number(row.ref_date);
            if (!Number.isNaN(yr)) marketGdpByYear[yr] = Number(row.value);
        }
    });
    allData.forEach((row) => {
        if (row.vector !== 'gdp_nominal_market') return;
        const yr = typeof row.ref_date === 'number' ? row.ref_date : Number(row.ref_date);
        if (!Number.isNaN(yr) && marketGdpByYear[yr] == null) marketGdpByYear[yr] = Number(row.value);
    });
    const snapshots = candidateYears.map((y) => {
        const row = yearMap[y] || { year: y };
        const emp = row.employment_total;
        const ecoGdp = row.eco_gdp;
        const jobsTotal = row.eco_jobs_total;
        const jobsClean = row.eco_jobs_clean_energy;
        const exports = row.eco_exports;
        const gdpBillions = ecoGdp != null ? ecoGdp / 1000 : null;
        const exportsBillions = exports != null ? exports / 1000 : null;
        const jobsPct = emp != null && emp !== 0 && jobsTotal != null ? (jobsTotal / (emp * 1000)) * 100 : null;
        const totalMarketGdp = marketGdpByYear[y];
        const gdp_pct = (ecoGdp != null && totalMarketGdp != null && totalMarketGdp > 0)
            ? Math.round((ecoGdp / totalMarketGdp) * 1000) / 10
            : null;
        const cleanEnergyGdp = row.clean_energy_gdp;
        const clean_energy_gdp_pct = (cleanEnergyGdp != null && totalMarketGdp != null && totalMarketGdp > 0)
            ? Math.round((cleanEnergyGdp / totalMarketGdp) * 1000) / 10
            : null;
        return {
            year: y,
            employment_total: emp,
            eco_gdp: ecoGdp,
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
    const snapshotsComplete = snapshots.filter(environmentalCleanTechSnapshotHasCompleteData);
    const years = snapshotsComplete.map((s) => s.year);
    const startYear = years.length ? years[0] : null;
    const endYear = years.length ? years[years.length - 1] : null;
    // TMX: from the most recent year that has tmx data
    const withTmx = sorted.filter((y) => y.tmx_count != null || y.tmx_mcap_total != null);
    const tmxSource = withTmx.length ? withTmx[withTmx.length - 1] : null;
    const tmxCount = tmxSource?.tmx_count;
    const tmxMcap = tmxSource?.tmx_mcap_total;
    const tmxCanCount = tmxSource?.tmx_can_count;
    const tmxCanMcap = tmxSource?.tmx_can_mcap;
    return {
        snapshots: snapshotsComplete,
        years,
        startYear,
        endYear,
        tmx: (tmxCount != null || tmxMcap != null) ? { count: tmxCount, mcap_total: tmxMcap, can_count: tmxCanCount, can_mcap: tmxCanMcap } : null,
    };
}

const RETAIL_GASOLINE_LOCATION_KEYS = ['canada', 'vancouver', 'calgary', 'toronto', 'montreal', 'halifax'];
const RETAIL_GASOLINE_COMPONENTS = ['crude', 'refining', 'marketing', 'taxes'];

export async function getRetailGasolinePricesData() {
    const allData = await loadAllData();
    const rows = allData.filter((row) => row.vector && row.vector.startsWith('kal_'));
    const dataByYear = {};
    rows.forEach((row) => {
        const match = row.vector.match(/^kal_([a-z]+)_(crude|refining|marketing|taxes|price)$/);
        if (!match) return;
        const [, market, component] = match;
        const year = Number(row.ref_date);
        if (Number.isNaN(year)) return;
        if (!dataByYear[year]) dataByYear[year] = {};
        if (!dataByYear[year][market]) {
            dataByYear[year][market] = { crude: null, refining: null, marketing: null, taxes: null };
        }
        if (RETAIL_GASOLINE_COMPONENTS.includes(component)) {
            dataByYear[year][market][component] = Number(row.value);
        }
    });
    const years = Object.keys(dataByYear)
        .map(Number)
        .filter((y) =>
            RETAIL_GASOLINE_LOCATION_KEYS.every((loc) => {
                const bundle = dataByYear[y]?.[loc];
                return bundle && RETAIL_GASOLINE_COMPONENTS.every((c) => bundle[c] != null);
            }),
        )
        .sort((a, b) => b - a);
    return { years, dataByYear };
}

const REFINERY_CAPACITY_PROVINCE_KEYS = ['ab', 'bc', 'nb', 'on', 'qc', 'sk'];
const REFINERY_CAPACITY_TYPES = ['petroleum', 'asphalt', 'lubricant', 'total'];

export async function getRefineryCapacityData() {
    const allData = await loadAllData();
    const rows = allData.filter((row) => row.vector && row.vector.startsWith('refcap_'));
    if (rows.length === 0) {
        return { vintage: null, tableRows: [], totalRow: null };
    }
    const vintages = [...new Set(rows.map((r) => String(r.ref_date)))].sort();
    const vintage = vintages[vintages.length - 1];
    const latest = rows.filter((r) => String(r.ref_date) === vintage);
    const valueMap = {};
    latest.forEach((row) => {
        valueMap[row.vector] = Number(row.value);
    });

    const pair = (prov, type) => ({
        count: valueMap[`refcap_${prov}_${type}_count`] ?? null,
        capacity: valueMap[`refcap_${prov}_${type}_capacity`] ?? null,
    });

    const tableRows = REFINERY_CAPACITY_PROVINCE_KEYS.map((key) => {
        const petroleum = pair(key, 'petroleum');
        const asphalt = pair(key, 'asphalt');
        const lubricant = pair(key, 'lubricant');
        const total = pair(key, 'total');
        const hasPetroleum = petroleum.count != null && petroleum.count > 0;
        const hasAsphalt = asphalt.count != null && asphalt.count > 0;
        const hasLubricant = lubricant.count != null && lubricant.count > 0;
        return {
            key,
            petroleum: hasPetroleum ? petroleum : null,
            asphalt: hasAsphalt ? asphalt : null,
            lubricant: hasLubricant ? lubricant : null,
            total: total.count != null ? total : null,
        };
    });

    const totalRow = {
        petroleum: pair('total', 'petroleum'),
        asphalt: pair('total', 'asphalt'),
        lubricant: pair('total', 'lubricant'),
        total: pair('total', 'total'),
    };

    return { vintage, tableRows, totalRow };
}

const CLEANTECH_GEO_REGION_KEYS = ['terr', 'atl', 'que', 'ont', 'man', 'sask', 'alta', 'bc'];

export async function getCleantechCompaniesByRegionData() {
    const allData = await loadAllData();
    const rows = allData.filter(row => row.vector && row.vector.startsWith('cleantech_geo_'));
    const byYear = {};
    rows.forEach((row) => {
        const year = typeof row.ref_date === 'number' ? row.ref_date : Number(row.ref_date);
        if (Number.isNaN(year)) return;
        if (!byYear[year]) byYear[year] = { year };
        const field = row.vector.replace('cleantech_geo_', '');
        byYear[year][field] = row.value;
    });
    const data = Object.values(byYear)
        .map((row) => {
            const total = row.total;
            const slices = CLEANTECH_GEO_REGION_KEYS.map((key) => {
                const count = row[`${key}_count`];
                const pct = row[`${key}_pct`];
                return {
                    key,
                    count,
                    pct: pct != null ? pct : (total && count != null ? (count / total) * 100 : null)
                };
            });
            return { ...row, total, slices };
        })
        .filter((row) => row.total != null && row.slices.every((slice) => slice.count != null && slice.pct != null))
        .sort((a, b) => a.year - b.year);
    const years = data.map((row) => row.year);
    return {
        data,
        years,
        latestYear: years.length ? years[years.length - 1] : null
    };
}

const CLEANTECH_INDUSTRY_KEYS = [
    'renewable_energy',
    'energy_efficiency',
    'biofuels_bioenergy',
    'air_env_remediation',
    'water_wastewater',
    'smart_grid_storage',
    'transportation',
    'agriculture_forestry',
    'waste_recycling',
    'mining_manufacturing'
];

export async function getCleantechCompaniesByIndustryData() {
    const allData = await loadAllData();
    const rows = allData.filter(row => row.vector && row.vector.startsWith('cleantech_ind_'));
    const byYear = {};
    rows.forEach((row) => {
        const year = typeof row.ref_date === 'number' ? row.ref_date : Number(row.ref_date);
        if (Number.isNaN(year)) return;
        if (!byYear[year]) byYear[year] = { year };
        const field = row.vector.replace('cleantech_ind_', '');
        byYear[year][field] = row.value;
    });
    const data = Object.values(byYear)
        .map((row) => {
            const industries = CLEANTECH_INDUSTRY_KEYS.map((key) => {
                const count = row[`${key}_count`];
                const pct = row[`${key}_pct`];
                return { key, count, pct };
            })
                .filter((item) => item.count != null && item.pct != null)
                .sort((a, b) => b.count - a.count);
            return { ...row, industries };
        })
        .filter((row) => row.industries.length === CLEANTECH_INDUSTRY_KEYS.length)
        .sort((a, b) => a.year - b.year);
    const years = data.map((row) => row.year);
    return {
        data,
        years,
        latestYear: years.length ? years[years.length - 1] : null
    };
}

const PEP_REGIONS = ['BC', 'Alta', 'Sask', 'Man', 'Ont', 'Que', 'NL', 'Territories', 'Maritimes'];
const PEP_SOURCES = ['coal', 'crude_oil', 'natural_gas', 'ngls', 'hydro', 'uranium', 'other_renewables'];

function parsePepVector(vector) {
    if (!vector || !vector.startsWith('pep_')) return null;
    const rest = vector.slice(4);
    const parts = rest.split('_');
    if (parts.length < 2) return null;
    const region = parts[0];
    const source = parts.slice(1).join('_');
    if (!PEP_REGIONS.includes(region) || !PEP_SOURCES.includes(source)) return null;
    return { region, source };
}

export async function getPrimaryEnergyProductionData() {
    const allData = await loadAllData();
    const pepData = allData.filter(row => row.vector && row.vector.startsWith('pep_'));
    const byYear = {};
    pepData.forEach(row => {
        const parsed = parsePepVector(row.vector);
        if (!parsed) return;
        const year = typeof row.ref_date === 'number' ? row.ref_date : Number(row.ref_date);
        if (Number.isNaN(year)) return;
        if (!byYear[year]) byYear[year] = {};
        if (!byYear[year][parsed.region]) byYear[year][parsed.region] = {};
        byYear[year][parsed.region][parsed.source] = row.value;
    });
    const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);
    const bestYear = years.length > 0 ? years[years.length - 1] : 2023;
    const regions = byYear[bestYear] || {};
    return { year: bestYear, regions };
}

const OEE_NEUD_VECTOR_SUFFIXES = ['R', 'C', 'I', 'T', 'A', 'P', 'NPC', 'FK', 'EL'];

export async function getEnergyUseData() {
    const allData = await loadAllData();
    const rows = allData.filter(row => row.vector && row.vector.startsWith('oee_neud_'));
    const yearMap = {};
    rows.forEach(row => {
        const year = typeof row.ref_date === 'number' ? row.ref_date : Number(row.ref_date);
        if (Number.isNaN(year)) return;
        const suffix = row.vector.replace('oee_neud_', '');
        if (!OEE_NEUD_VECTOR_SUFFIXES.includes(suffix)) return;
        if (!yearMap[year]) yearMap[year] = { year };
        yearMap[year][suffix] = row.value;
    });
    const yearKeys = Object.keys(yearMap).map(Number).sort((a, b) => a - b);
    const data = yearKeys.map(y => yearMap[y]).filter(row => {
        const hasAll = OEE_NEUD_VECTOR_SUFFIXES.every(v => row[v] != null && !Number.isNaN(Number(row[v])));
        return hasAll;
    });
    const years = data.map((row) => row.year);
    return { years, data };
}

const SEU_VECTOR_MAP = {
    seu_TE: 'TE',
    seu_Ele: 'Ele',
    seu_NG: 'NG',
    seu_mogas: 'mogas',
    seu_Oil: 'Oil',
    seu_OOP: 'OOP',
    seu_BM: 'BM',
    seu_OT: 'OT'
};

export async function getSEUByFuelData() {
    const allData = await loadAllData();
    const rows = allData.filter(row => row.vector && row.vector.startsWith('seu_'));
    const yearMap = {};
    rows.forEach(row => {
        const year = typeof row.ref_date === 'number' ? row.ref_date : Number(row.ref_date);
        if (Number.isNaN(year)) return;
        const key = SEU_VECTOR_MAP[row.vector];
        if (!key) return;
        if (!yearMap[year]) yearMap[year] = { year };
        yearMap[year][key] = row.value;
    });
    const yearKeys = Object.keys(yearMap).map(Number).sort((a, b) => a - b);
    const data = yearKeys.map(y => yearMap[y]).filter(row => row.TE != null && row.TE > 0);
    const years = data.map((row) => row.year);
    const latestYear = data.length > 0 ? data[data.length - 1].year : null;
    const baseline = yearMap[2000];
    const latest = latestYear ? yearMap[latestYear] : null;
    let TEX = null, EleX = null, NGX = null;
    if (baseline && latest && baseline.TE > 0) {
        TEX = Math.round(((latest.TE - baseline.TE) / baseline.TE) * 100);
        if (baseline.Ele > 0) EleX = Math.round(((latest.Ele - baseline.Ele) / baseline.Ele) * 100);
        if (baseline.NG > 0) NGX = Math.round(((latest.NG - baseline.NG) / baseline.NG) * 100);
    }
    const categories = latest && latest.TE > 0 ? [
        { key: 'Ele', value: latest.Ele || 0 },
        { key: 'NG', value: latest.NG || 0 },
        { key: 'mogas', value: latest.mogas || 0 },
        { key: 'Oil', value: latest.Oil || 0 },
        { key: 'OOP', value: latest.OOP || 0 },
        { key: 'BM', value: latest.BM || 0 },
        { key: 'OT', value: latest.OT || 0 }
    ].map(c => ({ ...c, pct: Math.round((c.value / latest.TE) * 100) })) : [];
    return {
        years,
        data,
        latestYear,
        TE: latest ? Math.round(latest.TE) : null,
        categories,
        TEX,
        EleX,
        NGX
    };
}

export async function getResidentialSectorOverviewData() {
    const allData = await loadAllData();
    const byYear = {};
    allData.forEach(row => {
        if (!row.vector) return;
        const rawDate = row.ref_date;
        if (rawDate == null || rawDate === '') return;
        const year = typeof rawDate === 'number' ? (Number.isNaN(rawDate) ? null : Math.trunc(rawDate)) : parseInt(String(rawDate).trim(), 10);
        if (year == null || Number.isNaN(year)) return;
        if (!byYear[year]) byYear[year] = { year };
        const v = row.vector;
        const val = row.value != null ? Number(row.value) : null;
        if (v === 'oee_neud_R') byYear[year].ter = val;
        else if (v === 'res_ter') byYear[year].res_ter = val;
        else if (v === 'res_eee') byYear[year].eee = val;
        else if (v === 'res_space_heating_pj') byYear[year].space_heating_pj = val;
        else if (v === 'res_water_heating_pj') byYear[year].water_heating_pj = val;
        else if (v === 'res_reu_total') byYear[year].reu_total = val;
        else if (v === 'res_reu_space_heating') byYear[year].reu_space_heating = val;
        else if (v === 'res_reu_water_heating') byYear[year].reu_water_heating = val;
        else if (v === 'res_ee_improvement_pct') byYear[year].ingested_ee_improvement_pct = val;
        else if (v === 'res_ee_savings_pj') byYear[year].ee_savings_pj = val;
        else if (v === 'res_ee_savings_billion') byYear[year].ee_savings_billion = val;
    });
    const base2000Row = byYear[2000];
    const baseTer2000 = base2000Row && (base2000Row.ter != null ? base2000Row.ter
        : base2000Row.res_ter != null ? base2000Row.res_ter
            : base2000Row.reu_total != null ? base2000Row.reu_total
                : null);
    const baseEee2000 = base2000Row && base2000Row.eee != null ? base2000Row.eee : 0;
    const baseEux2000 = (baseTer2000 != null && baseEee2000 != null) ? baseTer2000 - baseEee2000 : null;
    const data = Object.values(byYear)
        .sort((a, b) => a.year - b.year)
        .map(r => {
            const ter = (r.ter != null ? r.ter : r.res_ter != null ? r.res_ter : r.reu_total != null ? r.reu_total : null);
            const eee = r.eee != null ? r.eee : null;
            const eux = (ter != null && eee != null) ? ter - eee : null;
            const space = r.space_heating_pj != null ? r.space_heating_pj : r.reu_space_heating != null ? r.reu_space_heating : null;
            const water = r.water_heating_pj != null ? r.water_heating_pj : r.reu_water_heating != null ? r.reu_water_heating : null;
            const sweu = (space != null && water != null) ? space + water : null;
            const swtePct = (sweu != null && ter != null && ter > 0) ? Math.round((sweu / ter) * 100) : null;
            const eeSavingsPj = r.ee_savings_pj != null ? r.ee_savings_pj : (eee != null ? eee : null);
            const terPctRow = (baseTer2000 != null && baseTer2000 > 0 && ter != null)
                ? Math.round(((ter - baseTer2000) / baseTer2000) * 100)
                : null;
            const euxPctRow = (baseEux2000 != null && baseEux2000 > 0 && eux != null)
                ? Math.round(((eux - baseEux2000) / baseEux2000) * 100)
                : null;
            const eeImprovementPctCalc = (terPctRow != null && euxPctRow != null) ? terPctRow - euxPctRow : null;
            const eeImprovementPct = r.ingested_ee_improvement_pct != null ? r.ingested_ee_improvement_pct : eeImprovementPctCalc;
            return {
                year: r.year,
                ter,
                eee,
                eux,
                space_heating_pj: space,
                water_heating_pj: water,
                sweu,
                swte_pct: swtePct,
                ee_improvement_pct: eeImprovementPct,
                ee_savings_pj: eeSavingsPj,
                ee_savings_billion: r.ee_savings_billion != null ? r.ee_savings_billion : null
            };
        });
    const base2000 = data.find(r => r.year === 2000);
    const latestWithEe = [...data].reverse().find(r => r.ee_improvement_pct != null && r.ee_savings_pj != null) || data[data.length - 1];
    const latest = data.length ? data[data.length - 1] : null;
    let terPct = null, euxPct = null;
    if (base2000 && latest && base2000.ter > 0) {
        terPct = Math.round(((latest.ter - base2000.ter) / base2000.ter) * 100);
        if (base2000.eux != null && base2000.eux > 0 && latest.eux != null)
            euxPct = Math.round(((latest.eux - base2000.eux) / base2000.eux) * 100);
    }
    const swtePct = latest && latest.swte_pct != null ? latest.swte_pct : (latest && latest.sweu != null && latest.ter > 0 ? Math.round((latest.sweu / latest.ter) * 100) : null);
    return {
        data,
        latestYear: latest ? latest.year : null,
        terPct,
        euxPct,
        swtePct,
        eeImprovementPct: latestWithEe ? latestWithEe.ee_improvement_pct : null,
        eeSavingsPj: latestWithEe ? latestWithEe.ee_savings_pj : null,
        eeSavingsBillion: latestWithEe ? latestWithEe.ee_savings_billion : null,
        eeEndYear: latestWithEe ? latestWithEe.year : null
    };
}

/**
 * Residential energy use shows a year only when residential end-use totals exist (HB / res_reu_total path).
 * Excludes future or partial CSV years until the pipeline fills a positive total.
 */
export function residentialEnergyUseRowHasCompleteData(row) {
    const t = row?.reuByType?.total;
    return t != null && !Number.isNaN(Number(t)) && Number(t) > 0;
}

export async function getResidentialEnergyUseData() {
    const allData = await loadAllData();
    const resData = allData.filter(row => row.vector && row.vector.startsWith('res_'));
    const byYear = {};
    resData.forEach(row => {
        const rawDate = row.ref_date;
        const year = typeof rawDate === 'number' ? (Number.isNaN(rawDate) ? null : Math.trunc(rawDate)) : parseInt(String(rawDate).trim(), 10);
        if (year == null || Number.isNaN(year)) return;
        if (!byYear[year]) byYear[year] = {};
        const v = row.vector;
        const val = row.value != null ? Number(row.value) : null;
        if (v === 'res_ter') byYear[year].res_ter = val;
        else if (v === 'res_reu_total') byYear[year].res_reu_total = val;
        else if (v === 'res_reu_space_heating') byYear[year].res_reu_space_heating = val;
        else if (v === 'res_reu_water_heating') byYear[year].res_reu_water_heating = val;
        else if (v === 'res_space_heating_pj') byYear[year].res_space_heating_pj = val;
        else if (v === 'res_water_heating_pj') byYear[year].res_water_heating_pj = val;
        else if (v === 'res_appliances_pj') byYear[year].res_appliances_pj = val;
        else if (v === 'res_lighting_pj') byYear[year].res_lighting_pj = val;
        else if (v === 'res_space_cooling_pj') byYear[year].res_space_cooling_pj = val;
        else if (v === 'res_sh_total') byYear[year].res_sh_total = val;
        else if (v === 'res_sh_ele') byYear[year].res_sh_ele = val;
        else if (v === 'res_sh_ng') byYear[year].res_sh_ng = val;
        else if (v === 'res_sh_ho') byYear[year].res_sh_ho = val;
        else if (v === 'res_sh_ot') byYear[year].res_sh_ot = val;
        else if (v === 'res_sh_wd') byYear[year].res_sh_wd = val;
        else if (v === 'res_wh_total') byYear[year].res_wh_total = val;
        else if (v === 'res_wh_ele') byYear[year].res_wh_ele = val;
        else if (v === 'res_wh_ng') byYear[year].res_wh_ng = val;
        else if (v === 'res_wh_ho') byYear[year].res_wh_ho = val;
        else if (v === 'res_wh_ot') byYear[year].res_wh_ot = val;
        else if (v === 'res_wh_wd') byYear[year].res_wh_wd = val;
    });
    const years = Object.keys(byYear).map(Number).filter(y => !Number.isNaN(y)).sort((a, b) => a - b);
    const data = years.map(year => {
        const r = byYear[year] || {};
        const total = r.res_reu_total != null ? r.res_reu_total : (r.res_ter != null ? r.res_ter : null);
        const shTotal = r.res_sh_total != null ? r.res_sh_total : (r.res_space_heating_pj != null ? r.res_space_heating_pj : null);
        const whTotal = r.res_wh_total != null ? r.res_wh_total : (r.res_water_heating_pj != null ? r.res_water_heating_pj : null);
        const reuByType = {
            total,
            space_heating: r.res_reu_space_heating != null ? r.res_reu_space_heating : (r.res_space_heating_pj != null ? r.res_space_heating_pj : null),
            water_heating: r.res_reu_water_heating != null ? r.res_reu_water_heating : (r.res_water_heating_pj != null ? r.res_water_heating_pj : null),
            appliances: r.res_appliances_pj != null ? r.res_appliances_pj : null,
            lighting: r.res_lighting_pj != null ? r.res_lighting_pj : null,
            space_cooling: r.res_space_cooling_pj != null ? r.res_space_cooling_pj : null
        };
        const spaceHeating = {
            total: shTotal,
            electricity: r.res_sh_ele,
            natural_gas: r.res_sh_ng,
            heating_oil: r.res_sh_ho,
            other: r.res_sh_ot,
            wood: r.res_sh_wd
        };
        const waterHeating = {
            total: whTotal,
            electricity: r.res_wh_ele,
            natural_gas: r.res_wh_ng,
            heating_oil: r.res_wh_ho,
            other: r.res_wh_ot,
            wood: r.res_wh_wd
        };
        return { year, reuByType, spaceHeating, waterHeating };
    });
    const dataComplete = data.filter(residentialEnergyUseRowHasCompleteData);
    const yearsComplete = dataComplete.map((r) => r.year);
    const latestYear = yearsComplete.length ? yearsComplete[yearsComplete.length - 1] : null;
    return { years: yearsComplete, data: dataComplete, latestYear };
}

const CIEU_END_USE_KEYS = ['sh', 'wh', 'ae', 'am', 'lt', 'sc'];

/**
 * Commercial and institutional sector shows a year only when total energy use (TEU / pie) exists and is positive.
 * Excludes future or partial CSV years until the pipeline fills a positive total.
 */
export function commercialInstitutionalEnergyUseRowHasCompleteData(row) {
    const t = row?.teu;
    return t != null && !Number.isNaN(Number(t)) && Number(t) > 0;
}

export async function getCommercialInstitutionalEnergyUseData() {
    const allData = await loadAllData();
    const byYear = {};
    allData.forEach(row => {
        if (!row.vector) return;
        const rawDate = row.ref_date;
        const year = typeof rawDate === 'number' ? (Number.isNaN(rawDate) ? null : Math.trunc(rawDate)) : parseInt(String(rawDate).trim(), 10);
        if (year == null || Number.isNaN(year)) return;
        if (!byYear[year]) byYear[year] = { year };
        const v = row.vector;
        const val = row.value != null ? Number(row.value) : null;
        if (v === 'com_teu_cieu') byYear[year].teu = val;
        else if (v === 'oee_neud_C' && byYear[year].teu == null) byYear[year].teu = val;
        else if (v === 'com_sh') byYear[year].sh = val;
        else if (v === 'com_wh') byYear[year].wh = val;
        else if (v === 'com_ae') byYear[year].ae = val;
        else if (v === 'com_am') byYear[year].am = val;
        else if (v === 'com_lt') byYear[year].lt = val;
        else if (v === 'com_sc') byYear[year].sc = val;
        else if (v === 'com_eee') byYear[year].eee = val;
        else if (v === 'com_ei') byYear[year].ei = val;
        else if (v === 'com_ee_improvement_pct') byYear[year].ee_improvement_pct = val;
        else if (v === 'com_ee_savings_pj') byYear[year].ee_savings_pj = val;
        else if (v === 'com_ee_savings_billion') byYear[year].ee_savings_billion = val;
    });
    const years = Object.keys(byYear).map(Number).filter(y => !Number.isNaN(y)).sort((a, b) => a - b);
    const base2000 = byYear[2000];
    const eu2000 = base2000 && (base2000.teu != null) ? base2000.teu : null;
    const eee2000 = base2000 && base2000.eee != null ? base2000.eee : 0;
    const hyp2000 = (eu2000 != null && eee2000 != null) ? eu2000 + eee2000 : null;
    const ei2000 = base2000 && base2000.ei != null ? base2000.ei : null;
    const data = years.map(y => {
        const r = byYear[y] || {};
        const teu = r.teu != null ? r.teu : null;
        const eee = r.eee != null ? r.eee : 0;
        const hyp = (teu != null && eee != null) ? teu + eee : null;
        const ei = r.ei != null ? r.ei : null;
        let chEuPct = null;
        if (eu2000 != null && eu2000 > 0 && teu != null) chEuPct = Math.round(((teu - eu2000) / eu2000) * 100);
        let chEuWeiPct = null;
        if (hyp2000 != null && hyp2000 > 0 && hyp != null) chEuWeiPct = Math.round(((hyp - hyp2000) / hyp2000) * 100);
        let eiPct = null;
        if (ei2000 != null && ei2000 > 0 && ei != null) eiPct = Math.round(((ei - ei2000) / ei2000) * 100);
        const endUsePj = { sh: r.sh, wh: r.wh, ae: r.ae, am: r.am, lt: r.lt, sc: r.sc };
        const totalPie = teu != null && teu > 0 ? teu : null;
        const slices = totalPie != null ? CIEU_END_USE_KEYS.map(k => ({
            key: k,
            pj: endUsePj[k] != null ? endUsePj[k] : 0,
            pct: endUsePj[k] != null && totalPie > 0 ? Number(((endUsePj[k] / totalPie) * 100).toFixed(1)) : 0
        })) : [];
        const ee_savings_pj = r.ee_savings_pj != null ? r.ee_savings_pj : (r.eee != null ? r.eee : null);
        const ee_improvement_pct_calc = (chEuWeiPct != null && chEuPct != null) ? chEuWeiPct - chEuPct : null;
        const ee_improvement_pct = ee_improvement_pct_calc != null ? ee_improvement_pct_calc : (r.ee_improvement_pct != null ? r.ee_improvement_pct : null);
        return {
            year: y,
            teu,
            eee,
            hyp,
            ei,
            chEuPct,
            chEuWeiPct,
            eiPct,
            slices,
            ee_improvement_pct,
            ee_savings_pj,
            ee_savings_billion: r.ee_savings_billion != null ? r.ee_savings_billion : null
        };
    });
    const dataComplete = data.filter(commercialInstitutionalEnergyUseRowHasCompleteData);
    const yearsComplete = dataComplete.map((r) => r.year);
    const latestYear = yearsComplete.length ? yearsComplete[yearsComplete.length - 1] : null;
    return { data: dataComplete, years: yearsComplete, latestYear };
}

const INDUSTRIAL_ENERGY_FUEL_KEYS = ['Ele', 'NG', 'DFOx', 'SGPC', 'WWPL', 'Other_x'];

export function industrialEnergyUseRowHasCompleteData(row) {
    const t = row?.teu;
    return (
        t != null &&
        !Number.isNaN(Number(t)) &&
        Number(t) > 0 &&
        INDUSTRIAL_ENERGY_FUEL_KEYS.every((k) => row[k] != null && !Number.isNaN(Number(row[k]))) &&
        row.ee_improvement_pct != null &&
        row.ee_savings_pj != null &&
        row.ee_savings_billion != null
    );
}

export async function getIndustrialEnergyUseData() {
    const allData = await loadAllData();
    const byYear = {};
    allData.forEach(row => {
        if (!row.vector) return;
        const rawDate = row.ref_date;
        const year = typeof rawDate === 'number' ? (Number.isNaN(rawDate) ? null : Math.trunc(rawDate)) : parseInt(String(rawDate).trim(), 10);
        if (year == null || Number.isNaN(year)) return;
        if (!byYear[year]) byYear[year] = { year };
        const v = row.vector;
        const val = row.value != null ? Number(row.value) : null;
        if (v === 'ind_teu') byYear[year].teu = val;
        else if (v === 'oee_neud_I' && byYear[year].teu == null) byYear[year].teu = val;
        else if (v === 'ind_ele') byYear[year].Ele = val;
        else if (v === 'ind_ng') byYear[year].NG = val;
        else if (v === 'ind_dfox') byYear[year].DFOx = val;
        else if (v === 'ind_hfo') byYear[year].HFO = val;
        else if (v === 'ind_sgpc') byYear[year].SGPC = val;
        else if (v === 'ind_lgp') byYear[year].LGP = val;
        else if (v === 'ind_cl') byYear[year].CL = val;
        else if (v === 'ind_ccog') byYear[year].CCOG = val;
        else if (v === 'ind_wwpl') byYear[year].WWPL = val;
        else if (v === 'ind_ot') byYear[year].OT = val;
        else if (v === 'ind_other_x') byYear[year].Other_x = val;
        else if (v === 'ind_ee_improvement_pct') byYear[year].ee_improvement_pct = val;
        else if (v === 'ind_ee_savings_pj') byYear[year].ee_savings_pj = val;
        else if (v === 'ind_ee_savings_billion') byYear[year].ee_savings_billion = val;
    });
    const years = Object.keys(byYear).map(Number).filter(y => !Number.isNaN(y)).sort((a, b) => a - b);
    const base2000 = byYear[2000];
    const data = years.map(y => {
        const r = byYear[y] || {};
        const other = r.Other_x != null ? r.Other_x : (Number(r.HFO || 0) + Number(r.LGP || 0) + Number(r.CL || 0) + Number(r.CCOG || 0) + Number(r.OT || 0));
        const row = {
            year: y,
            teu: r.teu != null ? r.teu : null,
            Ele: r.Ele != null ? r.Ele : null,
            NG: r.NG != null ? r.NG : null,
            DFOx: r.DFOx != null ? r.DFOx : null,
            HFO: r.HFO != null ? r.HFO : null,
            SGPC: r.SGPC != null ? r.SGPC : null,
            LGP: r.LGP != null ? r.LGP : null,
            CL: r.CL != null ? r.CL : null,
            CCOG: r.CCOG != null ? r.CCOG : null,
            WWPL: r.WWPL != null ? r.WWPL : null,
            OT: r.OT != null ? r.OT : null,
            Other_x: other > 0 ? Number(other.toFixed(2)) : (r.Other_x != null ? r.Other_x : null),
            ee_improvement_pct: r.ee_improvement_pct != null ? r.ee_improvement_pct : null,
            ee_savings_pj: r.ee_savings_pj != null ? r.ee_savings_pj : null,
            ee_savings_billion: r.ee_savings_billion != null ? r.ee_savings_billion : null
        };
        if (base2000?.teu != null && base2000.teu > 0 && row.teu != null) {
            row.change_since_2000_pct = Math.round(((row.teu - base2000.teu) / base2000.teu) * 100);
        } else {
            row.change_since_2000_pct = null;
        }
        row.slices = INDUSTRIAL_ENERGY_FUEL_KEYS.map(k => ({
            key: k,
            pj: row[k],
            pct: row.teu != null && row.teu > 0 && row[k] != null ? Number(((row[k] / row.teu) * 100).toFixed(1)) : null
        }));
        return row;
    });
    const dataComplete = data.filter(industrialEnergyUseRowHasCompleteData);
    const yearsComplete = dataComplete.filter((r) => r.year >= 2022).map((r) => r.year);
    const latestYear = yearsComplete.length ? yearsComplete[yearsComplete.length - 1] : null;
    return { data, years: yearsComplete, latestYear };
}

const RPP_SUPPLY_PRODUCT_KEYS = [
    'asphalt',
    'other',
    'motor_gasoline',
    'distillate',
    'still_gas',
    'jet',
    'coke',
    'residual',
];

const RPP_SUPPLY_FIELDS = [
    { key: 'net_production', mmbd: 'rpp_net_prod_mmbd', bl: 'rpp_net_prod_bl' },
    { key: 'exports', mmbd: 'rpp_exports_mmbd', bl: 'rpp_exports_bl' },
    { key: 'imports', mmbd: 'rpp_imports_mmbd', bl: 'rpp_imports_bl' },
    { key: 'domestic_consumption', mmbd: 'rpp_domestic_mmbd', bl: 'rpp_domestic_bl' },
    { key: 'refinery_input', mmbd: 'rpp_refinery_mmbd', bl: 'rpp_refinery_bl' },
];

const RPP_SUPPLY_PCT_VECTORS = {
    motor_gasoline: 'rpp_motor_gasoline_pct',
    distillate: 'rpp_distillate_pct',
    still_gas: 'rpp_still_gas_pct',
    jet: 'rpp_jet_pct',
    coke: 'rpp_coke_pct',
    residual: 'rpp_residual_pct',
    asphalt: 'rpp_asphalt_pct',
    other: 'rpp_other_pct',
};

export async function getRppSupplyDemandData() {
    const allData = await loadAllData();
    const rppRows = allData.filter((row) => row.vector && row.vector.startsWith('rpp_'));
    const byYear = {};
    rppRows.forEach((row) => {
        const year = typeof row.ref_date === 'number' ? row.ref_date : Number(row.ref_date);
        if (Number.isNaN(year)) return;
        if (!byYear[year]) byYear[year] = { year };
        byYear[year][row.vector] = row.value;
    });
    const data = Object.values(byYear)
        .map((raw) => {
            const supply = {};
            RPP_SUPPLY_FIELDS.forEach(({ key, mmbd, bl }) => {
                supply[key] = {
                    mmbd: raw[mmbd] != null ? Number(raw[mmbd]) : null,
                    billion_l: raw[bl] != null ? Number(raw[bl]) : null,
                };
            });
            const products = RPP_SUPPLY_PRODUCT_KEYS.map((key) => ({
                key,
                pct: raw[RPP_SUPPLY_PCT_VECTORS[key]] != null ? Number(raw[RPP_SUPPLY_PCT_VECTORS[key]]) : null,
            }));
            const complete =
                RPP_SUPPLY_FIELDS.every(({ key }) => supply[key].mmbd != null && supply[key].billion_l != null) &&
                products.every((p) => p.pct != null);
            return { year: raw.year, supply, products, complete };
        })
        .filter((row) => row.complete)
        .sort((a, b) => a.year - b.year);
    const years = data.map((row) => row.year);
    return {
        data,
        years,
        latestYear: years.length ? years[years.length - 1] : null,
        referenceYear: 2024,
    };
}

export async function getCanadianCrudeProductionData() {
    const allData = await loadAllData();
    const cpRows = allData.filter((row) => row.vector && row.vector.startsWith('cp_'));
    const byYear = {};
    cpRows.forEach((row) => {
        const year = typeof row.ref_date === 'number' ? row.ref_date : Number(row.ref_date);
        if (Number.isNaN(year)) return;
        if (!byYear[year]) byYear[year] = { year };
        byYear[year][row.vector] = row.value;
    });

    const production = Object.values(byYear)
        .filter((row) => row.cp_oil_sands_mmbd != null && row.cp_conventional_mmbd != null && row.cp_total_mmbd != null)
        .map((row) => ({
            year: row.year,
            oilSandsThousandM3: row.cp_oil_sands_thousand_m3 != null ? Number(row.cp_oil_sands_thousand_m3) : null,
            conventionalThousandM3: row.cp_conventional_thousand_m3 != null ? Number(row.cp_conventional_thousand_m3) : null,
            totalThousandM3: row.cp_total_thousand_m3 != null ? Number(row.cp_total_thousand_m3) : null,
            oilSandsMmbd: row.cp_oil_sands_mmbd != null ? Number(row.cp_oil_sands_mmbd) : null,
            conventionalMmbd: row.cp_conventional_mmbd != null ? Number(row.cp_conventional_mmbd) : null,
            totalMmbd: row.cp_total_mmbd != null ? Number(row.cp_total_mmbd) : null,
            sharePct: row.cp_share_pct != null ? Number(row.cp_share_pct) : null,
        }))
        .sort((a, b) => a.year - b.year);

    const provinceFieldMap = {
        ab: { thousandM3: 'cp_prov_ab_thousand_m3', sharePct: 'cp_prov_ab_pct' },
        sk: { thousandM3: 'cp_prov_sk_thousand_m3', sharePct: 'cp_prov_sk_pct' },
        nl: { thousandM3: 'cp_prov_nl_thousand_m3', sharePct: 'cp_prov_nl_pct' },
        mb: { thousandM3: 'cp_prov_mb_thousand_m3', sharePct: 'cp_prov_mb_pct' },
        bc: { thousandM3: 'cp_prov_bc_thousand_m3', sharePct: 'cp_prov_bc_pct' },
        ns: { thousandM3: 'cp_prov_ns_thousand_m3', sharePct: 'cp_prov_ns_pct' },
        on: { thousandM3: 'cp_prov_on_thousand_m3', sharePct: 'cp_prov_on_pct' },
        nt: { thousandM3: 'cp_prov_nt_thousand_m3', sharePct: 'cp_prov_nt_pct' },
        other: { thousandM3: 'cp_prov_other_thousand_m3', sharePct: 'cp_prov_other_pct' },
    };

    const provinces = Object.values(byYear)
        .filter((row) => row.year >= 2016 && row.cp_prov_canada_thousand_m3 != null)
        .map((row) => {
            const canadaThousandM3 = Number(row.cp_prov_canada_thousand_m3);
            const entries = Object.entries(provinceFieldMap).map(([key, fields]) => {
                const thousandM3 = row[fields.thousandM3] != null ? Number(row[fields.thousandM3]) : null;
                const pipelinePct = row[fields.sharePct] != null ? Number(row[fields.sharePct]) : null;
                const sharePct = pipelinePct != null
                    ? pipelinePct
                    : thousandM3 != null && canadaThousandM3 > 0
                        ? Math.round((thousandM3 / canadaThousandM3) * 1000) / 10
                        : null;
                return { key, thousandM3, sharePct };
            });
            return {
                year: row.year,
                canadaThousandM3,
                provinces: Object.fromEntries(entries.map(({ key, thousandM3, sharePct }) => [key, { thousandM3, sharePct }])),
            };
        })
        .filter((row) => Object.values(row.provinces).every((entry) => entry.thousandM3 != null && entry.sharePct != null))
        .sort((a, b) => a.year - b.year);

    const chartProduction = production.filter((row) => row.year >= 2006);
    const provinceYearSet = new Set(provinces.map((row) => row.year));
    const selectorYears = production
        .filter((row) => provinceYearSet.has(row.year))
        .map((row) => row.year)
        .sort((a, b) => b - a);
    const referenceYear = selectorYears.length ? selectorYears[0] : null;
    const referenceRow = referenceYear != null
        ? production.find((row) => row.year === referenceYear) ?? null
        : null;

    return {
        production: chartProduction,
        provinces,
        selectorYears,
        referenceYear,
        referenceRow,
        chartStartYear: chartProduction.length ? chartProduction[0].year : 2006,
        chartEndYear: chartProduction.length ? chartProduction[chartProduction.length - 1].year : null,
        provinceStartYear: provinces.length ? provinces[0].year : 2016,
        provinceEndYear: provinces.length ? provinces[provinces.length - 1].year : null,
    };
}

export async function getElectricityTradeData() {
    const allData = await loadAllData();
    const tradeRows = allData.filter((row) => row.vector && row.vector.startsWith('elec_trade_'));
    const byYear = {};
    tradeRows.forEach((row) => {
        const year = typeof row.ref_date === 'number' ? row.ref_date : Number(row.ref_date);
        if (Number.isNaN(year)) return;
        if (!byYear[year]) byYear[year] = { year };
        if (row.vector === 'elec_trade_exports') byYear[year].exports = Number(row.value);
        if (row.vector === 'elec_trade_imports') byYear[year].imports = Number(row.value);
        if (row.vector === 'elec_trade_net') byYear[year].net = Number(row.value);
    });

    const data = Object.values(byYear)
        .filter((row) => row.exports != null && row.imports != null && row.net != null)
        .sort((a, b) => a.year - b.year);

    const referenceYear = data.length ? data[data.length - 1].year : null;
    const referenceRow = referenceYear != null ? data.find((row) => row.year === referenceYear) : null;
    const chartStartYear = data.length ? data[0].year : null;
    const chartEndYear = referenceYear;

    return {
        data,
        referenceYear,
        referenceRow,
        chartStartYear,
        chartEndYear,
    };
}

export async function getEvSalesRegistrationsData() {
    const allData = await loadAllData();
    const evRows = allData.filter((row) => row.vector && row.vector.startsWith('ev_'));
    const byYear = {};
    evRows.forEach((row) => {
        const year = typeof row.ref_date === 'number' ? row.ref_date : Number(row.ref_date);
        if (Number.isNaN(year)) return;
        if (!byYear[year]) byYear[year] = { year };
        byYear[year][row.vector] = row.value;
    });

    const data = Object.values(byYear)
        .filter(
            (row) =>
                row.year >= 2011 &&
                row.ev_total_regs != null &&
                row.ev_new_regs != null &&
                row.ev_share_pct != null,
        )
        .map((row) => ({
            year: row.year,
            totalRegs: Number(row.ev_total_regs),
            evRegs: Number(row.ev_new_regs),
            evRegsThousands: Math.round(Number(row.ev_new_regs) / 1000),
            sharePct: Number(row.ev_share_pct),
        }))
        .sort((a, b) => a.year - b.year);

    const referenceYear = data.length ? data[data.length - 1].year : null;
    const referenceRow = referenceYear != null ? data.find((row) => row.year === referenceYear) ?? null : null;
    const base2017 = data.find((row) => row.year === 2017) ?? null;
    const multiplier =
        referenceRow && base2017 && base2017.evRegs > 0
            ? Math.round(referenceRow.evRegs / base2017.evRegs)
            : null;

    return {
        data,
        referenceYear,
        referenceRow,
        multiplier,
        chartStartYear: data.length ? data[0].year : 2011,
        chartEndYear: data.length ? data[data.length - 1].year : null,
    };
}

export async function getOilSandsProductionData() {
    const allData = await loadAllData();
    const osRows = allData.filter((row) => row.vector && row.vector.startsWith('os_'));
    const byYear = {};
    osRows.forEach((row) => {
        const year = typeof row.ref_date === 'number' ? row.ref_date : Number(row.ref_date);
        if (Number.isNaN(year)) return;
        if (!byYear[year]) byYear[year] = { year };
        byYear[year][row.vector] = row.value;
    });

    const production = Object.values(byYear)
        .filter((row) => row.year >= 2000 && row.os_oil_sands_mmbd != null && row.os_share_pct != null)
        .map((row) => {
            const cappCapexM = row.os_capex_capp_m != null ? Number(row.os_capex_capp_m) : null;
            const statcanCapexM = row.os_capex_statcan_m != null ? Number(row.os_capex_statcan_m) : null;
            const annualCapexM = statcanCapexM ?? cappCapexM;
            return {
                year: row.year,
                oilSandsThousandM3: row.os_oil_sands_thousand_m3 != null ? Number(row.os_oil_sands_thousand_m3) : null,
                conventionalThousandM3: row.os_conventional_thousand_m3 != null ? Number(row.os_conventional_thousand_m3) : null,
                totalThousandM3: row.os_total_thousand_m3 != null ? Number(row.os_total_thousand_m3) : null,
                oilSandsMmbd: row.os_oil_sands_mmbd != null ? Number(row.os_oil_sands_mmbd) : null,
                conventionalMmbd: row.os_conventional_mmbd != null ? Number(row.os_conventional_mmbd) : null,
                totalMmbd: row.os_total_mmbd != null ? Number(row.os_total_mmbd) : null,
                sharePct: row.os_share_pct != null ? Number(row.os_share_pct) : null,
                cumulativeCapexBn: row.os_capex_cumulative_bn != null ? Number(row.os_capex_cumulative_bn) : null,
                provedReservesPct: row.os_proved_reserves_pct != null ? Number(row.os_proved_reserves_pct) : null,
                upgradingPct: row.os_upgrading_pct != null ? Number(row.os_upgrading_pct) : null,
                upgradingCapacityMmbd: row.os_upgrading_capacity_mmbd != null
                    ? Number(row.os_upgrading_capacity_mmbd)
                    : null,
                cappCapexM,
                statcanCapexM,
                annualCapexM,
            };
        })
        .sort((a, b) => a.year - b.year);

    const isRowComplete = (row) =>
        row.oilSandsThousandM3 != null
        && row.conventionalThousandM3 != null
        && row.totalThousandM3 != null
        && row.oilSandsMmbd != null
        && row.conventionalMmbd != null
        && row.totalMmbd != null
        && row.sharePct != null
        && row.cumulativeCapexBn != null
        && row.annualCapexM != null
        && row.provedReservesPct != null
        && row.upgradingPct != null
        && row.upgradingCapacityMmbd != null;

    const selectorYears = production.filter(isRowComplete).map((row) => row.year).sort((a, b) => b - a);
    const tableYears = production.filter(isRowComplete);

    return {
        production: tableYears,
        selectorYears,
        latestYear: selectorYears.length ? selectorYears[0] : null,
        startYear: tableYears.length ? tableYears[0].year : 2000,
        endYear: tableYears.length ? tableYears[tableYears.length - 1].year : null,
    };
}

const PETROLEUM_EMPLOYMENT_REGION_KEYS = ['bc', 'alta', 'sask', 'man', 'ont', 'que', 'maritimes', 'nl'];

export async function getPetroleumEmploymentByRegionData() {
    const allData = await loadAllData();
    const rows = allData.filter((row) => row.vector && row.vector.startsWith('pet_emp_'));

    const byYear = {};
    rows.forEach((row) => {
        const year = typeof row.ref_date === 'number' ? row.ref_date : Number(row.ref_date);
        if (Number.isNaN(year)) return;
        if (!byYear[year]) {
            byYear[year] = { reportingYear: year, regionPcts: {}, directTotal: null, indirectTotal: null };
        }
        const bucket = byYear[year];
        const val = Number(row.value);

        if (row.vector === 'pet_emp_reporting_year') bucket.reportingYear = val;
        if (row.vector === 'pet_emp_direct_total') bucket.directTotal = val;
        if (row.vector === 'pet_emp_indirect_total') bucket.indirectTotal = val;

        const shareMatch = row.vector.match(/^pet_emp_(.+)_(direct|indirect)_pct$/);
        if (shareMatch) {
            const [, region, metric] = shareMatch;
            if (!bucket.regionPcts[region]) bucket.regionPcts[region] = {};
            bucket.regionPcts[region][metric] = val;
        }
    });

    const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);
    const latestYear = years[0];
    if (latestYear == null) return null;

    const latest = byYear[latestYear];
    const topIndirect = PETROLEUM_EMPLOYMENT_REGION_KEYS.map((key) => ({
        key,
        share: latest.regionPcts[key]?.indirect ?? 0,
    }))
        .filter((entry) => entry.share > 0)
        .sort((a, b) => b.share - a.share)
        .slice(0, 5);

    return { ...latest, topIndirect };
}

const WORLD_CRUDE_RESERVES_SLICE_KEYS = ['other', 'venezuela', 'saudi', 'iran', 'canada', 'iraq'];

export async function getWorldProvedCrudeReservesData() {
    const allData = await loadAllData();
    const rows = allData.filter((row) => row.vector && row.vector.startsWith('wr_crude_res_'));

    const byYear = {};
    rows.forEach((row) => {
        const year = typeof row.ref_date === 'number' ? row.ref_date : Number(row.ref_date);
        if (Number.isNaN(year)) return;
        if (!byYear[year]) {
            byYear[year] = {
                reportingYear: year,
                totalBb: null,
                oilSandsSharePct: null,
                slices: [],
            };
        }
        const bucket = byYear[year];
        const val = Number(row.value);

        if (row.vector === 'wr_crude_res_reporting_year') bucket.reportingYear = val;
        if (row.vector === 'wr_crude_res_total_bb') bucket.totalBb = val;
        if (row.vector === 'wr_crude_res_oil_sands_share_pct') bucket.oilSandsSharePct = val;

        const bbMatch = row.vector.match(/^wr_crude_res_(.+)_bb$/);
        if (bbMatch && bbMatch[1] !== 'total') {
            const key = bbMatch[1];
            let slice = bucket.slices.find((s) => s.key === key);
            if (!slice) {
                slice = { key, valueBb: null, sharePct: null };
                bucket.slices.push(slice);
            }
            slice.valueBb = val;
        }

        const pctMatch = row.vector.match(/^wr_crude_res_(.+)_pct$/);
        if (pctMatch && pctMatch[1] !== 'oil_sands_share') {
            const key = pctMatch[1];
            let slice = bucket.slices.find((s) => s.key === key);
            if (!slice) {
                slice = { key, valueBb: null, sharePct: null };
                bucket.slices.push(slice);
            }
            slice.sharePct = val;
        }
    });

    const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);
    const latestYear = years[0];
    if (latestYear == null) return null;

    const latest = byYear[latestYear];
    const orderedSlices = WORLD_CRUDE_RESERVES_SLICE_KEYS.map((key) => latest.slices.find((s) => s.key === key)).filter(Boolean);

    return {
        years,
        byYear,
        reportingYear: latest.reportingYear ?? latestYear,
        totalBb: latest.totalBb,
        oilSandsSharePct: latest.oilSandsSharePct,
        slices: orderedSlices,
    };
}

export async function getCanadianCrudeReservesData() {
    const allData = await loadAllData();
    const crRows = allData.filter((row) => row.vector && row.vector.startsWith('cr_res_'));
    const wcRows = allData.filter((row) => row.vector && row.vector.startsWith('wc_oil_'));

    const reservesByYear = {};
    crRows.forEach((row) => {
        const year = typeof row.ref_date === 'number' ? row.ref_date : Number(row.ref_date);
        if (Number.isNaN(year)) return;
        if (!reservesByYear[year]) reservesByYear[year] = { reportingYear: year };
        const key = row.vector.replace('cr_res_', '').replace('_bb', 'Bb').replace('_year', 'Year');
        if (row.vector === 'cr_res_total_bb') reservesByYear[year].totalBb = Number(row.value);
        if (row.vector === 'cr_res_conventional_bb') reservesByYear[year].conventionalBb = Number(row.value);
        if (row.vector === 'cr_res_oil_sands_bb') reservesByYear[year].oilSandsBb = Number(row.value);
        if (row.vector === 'cr_res_mining_bb') reservesByYear[year].miningBb = Number(row.value);
        if (row.vector === 'cr_res_insitu_bb') reservesByYear[year].insituBb = Number(row.value);
    });

    const reserveYears = Object.keys(reservesByYear).map(Number).sort((a, b) => b - a);
    const latestReserveYear = reserveYears[0];
    const reserves = latestReserveYear != null ? reservesByYear[latestReserveYear] : null;

    const wellsByYear = {};
    wcRows.forEach((row) => {
        const year = typeof row.ref_date === 'number' ? row.ref_date : Number(row.ref_date);
        if (Number.isNaN(year)) return;
        if (!wellsByYear[year]) wellsByYear[year] = { year };
        if (row.vector === 'wc_oil_wells_completed') wellsByYear[year].wellsCompleted = Number(row.value);
        if (row.vector === 'wc_oil_total_metres') wellsByYear[year].totalMetres = Number(row.value);
        if (row.vector === 'wc_oil_avg_depth_m') wellsByYear[year].avgDepthM = Number(row.value);
    });

    const wells = Object.values(wellsByYear)
        .filter((row) => row.year >= 2000 && row.wellsCompleted != null && row.avgDepthM != null)
        .sort((a, b) => a.year - b.year);

    return {
        reserves,
        wells,
        startYear: wells.length ? wells[0].year : 2000,
        endYear: wells.length ? wells[wells.length - 1].year : null,
    };
}

export async function getCrudeOilPricesData() {
    const allData = await loadAllData();
    const crudeRows = allData.filter((row) => row.vector && row.vector.startsWith('crude_'));
    const byMonth = {};
    crudeRows.forEach((row) => {
        const ref = typeof row.ref_date === 'number' ? row.ref_date : Number(row.ref_date);
        if (Number.isNaN(ref)) return;
        if (!byMonth[ref]) byMonth[ref] = { refDate: ref };
        const key = row.vector.replace('crude_', '');
        byMonth[ref][key] = row.value;
    });
    const data = Object.values(byMonth)
        .filter((row) => row.wti != null && row.wcs_usd != null && row.differential != null)
        .sort((a, b) => a.refDate - b.refDate)
        .map((row) => {
            const year = Math.floor(row.refDate / 100);
            const month = row.refDate % 100;
            return {
                refDate: row.refDate,
                year,
                month,
                dateLabel: `${year}-${String(month).padStart(2, '0')}-01`,
                wti: Number(row.wti),
                wcsCad: row.wcs_cad != null ? Number(row.wcs_cad) : null,
                usdCad: row.usd_cad != null ? Number(row.usd_cad) : null,
                wcsUsd: Number(row.wcs_usd),
                differential: Number(row.differential),
            };
        });
    const chartData = data.filter((row) => row.refDate >= 201501);
    const chartEndYear = chartData.length ? chartData[chartData.length - 1].year : 2025;
    return {
        data,
        chartData,
        chartStartYear: 2015,
        chartEndYear,
    };
}

const WIND_PROJECT_PROV_FROM_CODE = {
    1: 'ab',
    2: 'qc',
    3: 'on',
    4: 'sk',
};

const ELEC_GHG_SERIES = {
    elec_ghg_coal: 'coal',
    elec_ghg_natural_gas: 'naturalGas',
    elec_ghg_other: 'other',
};

export async function getElectricityGhgSpotlightData() {
    const allData = await loadAllData();
    const byYear = {};
    const stats = {};

    allData.forEach((row) => {
        if (!row.vector || !row.vector.startsWith('elec_ghg_')) return;
        if (row.vector.startsWith('elec_ghg_stat_')) {
            stats[row.vector] = Number(row.value);
            return;
        }
        const key = ELEC_GHG_SERIES[row.vector];
        if (!key) return;
        const year = parseInt(String(row.ref_date).trim(), 10);
        if (Number.isNaN(year)) return;
        if (!byYear[year]) byYear[year] = { year };
        byYear[year][key] = Number(row.value);
    });

    const data = Object.values(byYear)
        .filter((row) =>
            row.coal != null
            && row.naturalGas != null
            && row.other != null,
        )
        .sort((a, b) => a.year - b.year)
        .map((row) => ({
            ...row,
            total: row.coal + row.naturalGas + row.other,
        }));

    const years = data.map((row) => row.year);

    return {
        data,
        years,
        startYear: years[0] ?? null,
        endYear: years.length ? years[years.length - 1] : null,
        baseYear: stats.elec_ghg_stat_base_year ?? years[0] ?? null,
        referenceYear: stats.elec_ghg_stat_reference_year ?? years[years.length - 1] ?? null,
        totalPctChange: stats.elec_ghg_stat_total_pct_change ?? null,
        coalGenSharePct: stats.elec_ghg_stat_coal_gen_share_pct ?? null,
        coalGhgSharePct: stats.elec_ghg_stat_coal_ghg_share_pct ?? null,
    };
}

const REN_CAP_VECTORS = {
    ren_cap_hydro: 'hydro',
    ren_cap_wind: 'wind',
    ren_cap_biomass: 'biomass',
    ren_cap_solar_tidal: 'solarTidal',
};

export async function getRenewableElectricityCapacityData() {
    const allData = await loadAllData();
    const byYear = {};

    allData.forEach((row) => {
        if (!row.vector || !row.vector.startsWith('ren_cap_')) return;
        const key = REN_CAP_VECTORS[row.vector];
        if (!key) return;
        const year = parseInt(String(row.ref_date).trim(), 10);
        if (Number.isNaN(year)) return;
        if (!byYear[year]) byYear[year] = { year };
        byYear[year][key] = Number(row.value);
    });

    const data = Object.values(byYear)
        .filter((row) =>
            row.hydro != null
            && row.wind != null
            && row.biomass != null
            && row.solarTidal != null,
        )
        .sort((a, b) => a.year - b.year);

    const years = data.map((row) => row.year);

    return {
        data,
        years,
        startYear: years[0] ?? null,
        endYear: years.length ? years[years.length - 1] : null,
    };
}

const WORLD_WIND_COUNTRY_IDS = {
    1: 'china',
    2: 'usa',
    3: 'germany',
    4: 'india',
    5: 'brazil',
    6: 'spain',
    7: 'uk',
    8: 'canada',
};

export async function getWorldWindPowerData() {
    const allData = await loadAllData();
    const byYear = {};
    const windShareByYear = {};

    allData.forEach((row) => {
        if (!row.vector) return;
        const year = parseInt(String(row.ref_date).trim(), 10);
        if (Number.isNaN(year)) return;
        const value = Number(row.value);
        if (Number.isNaN(value)) return;

        if (row.vector === 'win_world_total_gw') {
            if (!byYear[year]) byYear[year] = { year, topSlots: {} };
            byYear[year].totalGw = value;
            return;
        }
        if (row.vector === 'win_world_canada_rank') {
            if (!byYear[year]) byYear[year] = { year, topSlots: {} };
            byYear[year].canadaRank = value;
            return;
        }
        if (row.vector === 'win_world_canada_share_pct') {
            if (!byYear[year]) byYear[year] = { year, topSlots: {} };
            byYear[year].canadaSharePct = value;
            return;
        }
        const topShareMatch = row.vector.match(/^win_world_top([1-5])_share_pct$/);
        if (topShareMatch) {
            const rank = Number(topShareMatch[1]);
            if (!byYear[year]) byYear[year] = { year, topSlots: {} };
            if (!byYear[year].topSlots[rank]) byYear[year].topSlots[rank] = {};
            byYear[year].topSlots[rank].sharePct = value;
            return;
        }
        const topCountryMatch = row.vector.match(/^win_world_top([1-5])_country_id$/);
        if (topCountryMatch) {
            const rank = Number(topCountryMatch[1]);
            if (!byYear[year]) byYear[year] = { year, topSlots: {} };
            if (!byYear[year].topSlots[rank]) byYear[year].topSlots[rank] = {};
            byYear[year].topSlots[rank].countryId = value;
            return;
        }
        if (row.vector === 'win_can_wind_elec_share_pct') {
            windShareByYear[year] = value;
        }
    });

    const rows = Object.values(byYear)
        .filter((row) => row.totalGw != null)
        .map((row) => {
            const top5 = [1, 2, 3, 4, 5]
                .map((rank) => {
                    const slot = row.topSlots?.[rank];
                    if (!slot || slot.sharePct == null || slot.countryId == null) return null;
                    const key = WORLD_WIND_COUNTRY_IDS[Math.round(slot.countryId)];
                    if (!key) return null;
                    return { rank, key, sharePct: slot.sharePct };
                })
                .filter(Boolean);
            return { ...row, top5 };
        })
        .sort((a, b) => a.year - b.year);

    const years = rows.map((row) => row.year);
    const windShareYears = Object.keys(windShareByYear).map(Number).sort((a, b) => a - b);
    const latestWindShareYear = windShareYears.length ? windShareYears[windShareYears.length - 1] : null;

    return {
        rows,
        years,
        startYear: years[0] ?? null,
        endYear: years.length ? years[years.length - 1] : null,
        windShareByYear,
        latestWindShareYear,
        latestWindSharePct: latestWindShareYear != null ? windShareByYear[latestWindShareYear] : null,
    };
}

const WORLD_SOLAR_COUNTRY_IDS = {
    1: 'china',
    2: 'usa',
    3: 'germany',
    4: 'india',
    5: 'japan',
    6: 'canada',
};

export async function getWorldSolarPowerData() {
    const allData = await loadAllData();
    const byYear = {};

    allData.forEach((row) => {
        if (!row.vector) return;
        const year = parseInt(String(row.ref_date).trim(), 10);
        if (Number.isNaN(year)) return;
        const value = Number(row.value);
        if (Number.isNaN(value)) return;

        if (row.vector === 'sol_world_total_gw') {
            if (!byYear[year]) byYear[year] = { year, topSlots: {} };
            byYear[year].totalGw = value;
            return;
        }
        if (row.vector === 'sol_world_canada_rank') {
            if (!byYear[year]) byYear[year] = { year, topSlots: {} };
            byYear[year].canadaRank = value;
            return;
        }
        if (row.vector === 'sol_world_canada_share_pct') {
            if (!byYear[year]) byYear[year] = { year, topSlots: {} };
            byYear[year].canadaSharePct = value;
            return;
        }
        const topShareMatch = row.vector.match(/^sol_world_top([1-5])_share_pct$/);
        if (topShareMatch) {
            const rank = Number(topShareMatch[1]);
            if (!byYear[year]) byYear[year] = { year, topSlots: {} };
            if (!byYear[year].topSlots[rank]) byYear[year].topSlots[rank] = {};
            byYear[year].topSlots[rank].sharePct = value;
            return;
        }
        const topCountryMatch = row.vector.match(/^sol_world_top([1-5])_country_id$/);
        if (topCountryMatch) {
            const rank = Number(topCountryMatch[1]);
            if (!byYear[year]) byYear[year] = { year, topSlots: {} };
            if (!byYear[year].topSlots[rank]) byYear[year].topSlots[rank] = {};
            byYear[year].topSlots[rank].countryId = value;
            return;
        }
    });

    const rows = Object.values(byYear)
        .filter((row) => row.totalGw != null)
        .map((row) => {
            const top5 = [1, 2, 3, 4, 5]
                .map((rank) => {
                    const slot = row.topSlots?.[rank];
                    if (!slot || slot.sharePct == null || slot.countryId == null) return null;
                    const key = WORLD_SOLAR_COUNTRY_IDS[Math.round(slot.countryId)];
                    if (!key) return null;
                    return { rank, key, sharePct: slot.sharePct };
                })
                .filter(Boolean);
            return { ...row, top5 };
        })
        .sort((a, b) => a.year - b.year);

    const chartRows = rows.filter(
        (row) =>
            row.canadaRank != null
            && row.canadaSharePct != null
            && row.top5?.length >= 5,
    );
    const years = chartRows.map((row) => row.year);

    return {
        rows: chartRows,
        years,
        startYear: years[0] ?? null,
        endYear: years.length ? years[years.length - 1] : null,
    };
}

const URANIUM_COUNTRY_IDS = {
    1: 'kazakhstan',
    2: 'canada',
    3: 'namibia',
    4: 'australia',
    5: 'uzbekistan',
    6: 'russia',
    7: 'niger',
    8: 'china',
    9: 'india',
    10: 'south_africa',
    11: 'ukraine',
    12: 'usa',
    13: 'pakistan',
    14: 'brazil',
};

function parseUraniumRankingSeries(allData, vectorPrefix, totalVector) {
    const byYear = {};

    allData.forEach((row) => {
        if (!row.vector?.startsWith(vectorPrefix)) return;
        const year = parseInt(String(row.ref_date).trim(), 10);
        if (Number.isNaN(year)) return;
        const value = Number(row.value);
        if (Number.isNaN(value)) return;

        if (!byYear[year]) byYear[year] = { year, topSlots: {} };

        if (row.vector === totalVector) {
            byYear[year].total = value;
            return;
        }
        if (row.vector === `${vectorPrefix}canada_share_pct`) {
            byYear[year].canadaSharePct = value;
            return;
        }
        if (row.vector === `${vectorPrefix}canada_rank`) {
            byYear[year].canadaRank = value;
            return;
        }

        const topShareMatch = row.vector.match(new RegExp(`^${vectorPrefix}top([1-5])_share_pct$`));
        if (topShareMatch) {
            const rank = Number(topShareMatch[1]);
            if (!byYear[year].topSlots[rank]) byYear[year].topSlots[rank] = {};
            byYear[year].topSlots[rank].sharePct = value;
            return;
        }

        const topCountryMatch = row.vector.match(new RegExp(`^${vectorPrefix}top([1-5])_country_id$`));
        if (topCountryMatch) {
            const rank = Number(topCountryMatch[1]);
            if (!byYear[year].topSlots[rank]) byYear[year].topSlots[rank] = {};
            byYear[year].topSlots[rank].countryId = value;
        }
    });

    const rows = Object.values(byYear)
        .filter((row) => row.total != null)
        .map((row) => {
            const top5 = [1, 2, 3, 4, 5]
                .map((rank) => {
                    const slot = row.topSlots?.[rank];
                    if (!slot || slot.sharePct == null || slot.countryId == null) return null;
                    const key = URANIUM_COUNTRY_IDS[Math.round(slot.countryId)];
                    if (!key) return null;
                    return { rank, key, sharePct: slot.sharePct };
                })
                .filter(Boolean);
            return { ...row, top5 };
        })
        .filter((row) => row.top5?.length >= 5 && row.canadaRank != null && row.canadaSharePct != null)
        .sort((a, b) => a.year - b.year);

    const years = rows.map((row) => row.year);

    return {
        rows,
        years,
        startYear: years[0] ?? null,
        endYear: years.length ? years[years.length - 1] : null,
        defaultYear: years.length ? years[years.length - 1] : null,
    };
}

export async function getUraniumInternationalData() {
    const allData = await loadAllData();
    return {
        exports: parseUraniumRankingSeries(allData, 'urani_exp_', 'urani_exp_total_kt'),
        production: parseUraniumRankingSeries(allData, 'urani_prod_', 'urani_prod_total_kt'),
        resources: parseUraniumRankingSeries(allData, 'urani_res_', 'urani_res_total_mt'),
    };
}

export async function getCanadianWindPowerData() {
    const allData = await loadAllData();
    const stats = {};
    const byYear = {};

    allData.forEach((row) => {
        if (!row.vector?.startsWith('win_pwr_')) return;
        const year = parseInt(String(row.ref_date).trim(), 10);
        const value = Number(row.value);
        if (Number.isNaN(value)) return;

        if (row.vector.startsWith('win_pwr_stat_')) {
            stats[row.vector.replace('win_pwr_stat_', '')] = value;
            return;
        }

        if (row.vector === 'win_pwr_cap_cum_mw' || row.vector === 'win_pwr_cap_add_mw') {
            if (!byYear[year]) byYear[year] = { year };
            if (row.vector === 'win_pwr_cap_cum_mw') byYear[year].cumulativeMw = value;
            if (row.vector === 'win_pwr_cap_add_mw') byYear[year].annualMw = value;
        }
    });

    const chartRows = Object.values(byYear)
        .filter((row) => row.cumulativeMw != null)
        .sort((a, b) => a.year - b.year);

    const capRatio = stats.cap_ratio ?? null;
    const genRatio = stats.gen_ratio ?? null;

    const growthKey = (ratio) => {
        if (ratio == null) return 'increased';
        if (ratio >= 3.5) return 'quadrupled';
        if (ratio >= 3) return 'more_than_tripled';
        if (ratio >= 2.5) return 'tripled';
        if (ratio >= 1.75) return 'doubled';
        return 'increased';
    };

    const multLabel = (ratio) => {
        if (ratio == null) return '';
        if (ratio >= 3.5) return '= 4x';
        if (ratio > 3) return '> 3x';
        if (ratio >= 2.5) return '= 3x';
        if (ratio >= 1.75) return '= 2x';
        return `= ${Math.max(1, Math.round(ratio))}x`;
    };

    const years = chartRows.map((row) => row.year);

    return {
        chartRows,
        years,
        startYear: years[0] ?? null,
        endYear: years.length ? years[years.length - 1] : null,
        stats: {
            capYear: stats.cap_year ?? null,
            capGw: stats.cap_gw ?? null,
            capRatio,
            capMult: stats.cap_mult ?? null,
            capGrowthKey: growthKey(capRatio),
            capMultLabel: multLabel(capRatio),
            genYear: stats.gen_year ?? null,
            genTwh: stats.gen_twh ?? null,
            genRatio,
            genMult: stats.gen_mult ?? null,
            genGrowthKey: growthKey(genRatio),
            genMultLabel: multLabel(genRatio),
        },
    };
}

export async function getWindProjectsMapData() {
    const [allData, metadata] = await Promise.all([loadAllData(), loadMetadata()]);

    const provinces = allData
        .filter((row) => row.vector && row.vector.startsWith('wind_cap_'))
        .map((row) => ({
            key: row.vector.replace('wind_cap_', ''),
            capacity: Number(row.value),
            year: row.ref_date,
        }))
        .filter((row) => !Number.isNaN(row.capacity) && row.capacity > 0)
        .sort((a, b) => b.capacity - a.capacity);

    const projects = allData
        .filter((row) => row.vector && /^wind_proj_\d+_mw$/.test(row.vector))
        .map((row) => {
            const match = row.vector.match(/^wind_proj_(\d+)_mw$/);
            const index = match ? match[1] : '';
            const provRow = allData.find((item) => item.vector === `wind_proj_${index}_prov`);
            const provCode = provRow != null ? Number(provRow.value) : null;
            const provKey = WIND_PROJECT_PROV_FROM_CODE[provCode] || null;
            const facility = metadata[row.vector]?.title || row.vector;
            return {
                index,
                facility,
                capacity: Number(row.value),
                provKey,
                year: row.ref_date,
            };
        })
        .filter((row) => !Number.isNaN(row.capacity) && row.capacity > 0)
        .sort((a, b) => b.capacity - a.capacity);

    const referenceYear = provinces.length ? provinces[0].year : projects.length ? projects[0].year : null;

    return {
        referenceYear,
        provinces,
        projects,
    };
}

const SOLAR_PROJECT_PROV_FROM_CODE = {
    1: 'ab',
    2: 'on',
};

const HYDRO_FAC_PROV_FROM_CODE = {
    1: 'on',
    2: 'qc',
    3: 'bc',
    4: 'man',
    5: 'nl',
};

export async function getHydroelectricCapacityData() {
    const [allData, metadata] = await Promise.all([loadAllData(), loadMetadata()]);

    const facilities = allData
        .filter((row) => row.vector && /^hydro_fac_\d+_mw$/.test(row.vector))
        .map((row) => {
            const match = row.vector.match(/^hydro_fac_(\d+)_mw$/);
            const index = match ? match[1] : '';
            const provRow = allData.find((item) => item.vector === `hydro_fac_${index}_prov`);
            const provCode = provRow != null ? Number(provRow.value) : null;
            const provKey = HYDRO_FAC_PROV_FROM_CODE[provCode] || null;
            const facility = metadata[row.vector]?.title || row.vector;
            return {
                index,
                facility,
                capacity: Number(row.value),
                provKey,
                year: row.ref_date,
            };
        })
        .filter((row) => !Number.isNaN(row.capacity) && row.capacity > 0)
        .sort((a, b) => b.capacity - a.capacity);

    const referenceYear = facilities.length ? facilities[0].year : null;
    const hydroRow = referenceYear != null
        ? allData.find((row) => row.vector === 'ren_cap_hydro' && String(row.ref_date) === String(referenceYear))
        : null;
    const totalHydroMw = hydroRow != null ? Number(hydroRow.value) : null;

    return {
        referenceYear,
        totalHydroMw: totalHydroMw != null && !Number.isNaN(totalHydroMw) ? totalHydroMw : null,
        facilities,
    };
}

export async function getLargestSolarProjectsData() {
    const [allData, metadata] = await Promise.all([loadAllData(), loadMetadata()]);

    const projects = allData
        .filter((row) => row.vector && /^solar_proj_\d+_mw$/.test(row.vector))
        .map((row) => {
            const match = row.vector.match(/^solar_proj_(\d+)_mw$/);
            const index = match ? match[1] : '';
            const provRow = allData.find((item) => item.vector === `solar_proj_${index}_prov`);
            const provCode = provRow != null ? Number(provRow.value) : null;
            const provKey = SOLAR_PROJECT_PROV_FROM_CODE[provCode] || null;
            const facility = metadata[row.vector]?.title || row.vector;
            return {
                index,
                facility,
                capacity: Number(row.value),
                provKey,
                year: row.ref_date,
            };
        })
        .filter((row) => !Number.isNaN(row.capacity) && row.capacity > 0)
        .sort((a, b) => b.capacity - a.capacity);

    const referenceYear = projects.length ? projects[0].year : null;

    return {
        referenceYear,
        projects,
    };
}

const SBIO_BAR_VECTORS = {
    sbio_prod_pulping: 'pulping',
    sbio_prod_swr: 'swr',
    sbio_prod_firewood: 'firewood',
    sbio_prod_pellets: 'pellets',
};

const SBIO_PIE_VECTORS = {
    sbio_use_industrial: 'industrial',
    sbio_use_electricity: 'electricity',
    sbio_use_residential: 'residential',
    sbio_use_total: 'total',
};

export async function getSolidBiofuelsProductionData() {
    const allData = await loadAllData();
    const byYear = {};

    allData.forEach((row) => {
        if (!row.vector || !row.vector.startsWith('sbio_')) return;
        const year = parseInt(String(row.ref_date).trim(), 10);
        if (Number.isNaN(year)) return;
        if (!byYear[year]) byYear[year] = { year };

        const barKey = SBIO_BAR_VECTORS[row.vector];
        if (barKey) {
            byYear[year][barKey] = Number(row.value);
            return;
        }
        const pieKey = SBIO_PIE_VECTORS[row.vector];
        if (pieKey) {
            byYear[year][pieKey] = Number(row.value);
        }
    });

    const data = Object.values(byYear)
        .filter((row) =>
            row.pulping != null
            && row.swr != null
            && row.firewood != null
            && row.pellets != null
            && row.industrial != null
            && row.electricity != null
            && row.residential != null
            && row.total != null,
        )
        .sort((a, b) => a.year - b.year)
        .map((row) => ({
            ...row,
            barTotal: row.pulping + row.swr + row.firewood + row.pellets,
            pieSlices: [
                {
                    key: 'industrial',
                    pj: row.industrial,
                    pct: row.total > 0 ? Math.round((row.industrial / row.total) * 100) : null,
                },
                {
                    key: 'electricity',
                    pj: row.electricity,
                    pct: row.total > 0 ? Math.round((row.electricity / row.total) * 100) : null,
                },
                {
                    key: 'residential',
                    pj: row.residential,
                    pct: row.total > 0 ? Math.round((row.residential / row.total) * 100) : null,
                },
            ],
        }));

    const years = data.map((row) => row.year);
    const referenceYear = years.length ? years[years.length - 1] : null;

    return {
        data,
        years,
        startYear: years[0] ?? null,
        endYear: referenceYear,
        referenceYear,
    };
}

const CANADIAN_GENERATION_PIE_ORDER = ['petroleum', 'hydro', 'nuclear', 'other_renewables', 'natural_gas', 'coal'];

const CANADIAN_GENERATION_PIE_VECTORS = {
    petroleum: 'elegen_can_petroleum_pct',
    hydro: 'elegen_can_hydro_pct',
    nuclear: 'elegen_can_nuclear_pct',
    other_renewables: 'elegen_can_other_renewables_pct',
    natural_gas: 'elegen_can_natural_gas_pct',
    coal: 'elegen_can_coal_pct',
};

const CANADIAN_GENERATION_INFOGRAPHIC_SOURCES = ['hydro', 'nuclear', 'wind'];

const PROVINCIAL_GENERATION_SOURCE_PIPELINE = {
    biomass: 'biomass',
    naturalGas: 'natural_gas',
    petroleum: 'petroleum',
    solar: 'solar',
    coal: 'coal',
    other: 'other',
};

const PROVINCIAL_GENERATION_SOURCE_KEYS = Object.keys(PROVINCIAL_GENERATION_SOURCE_PIPELINE);

const ELEGEN_PROVINCE_LOC_KEYS = [
    'bc', 'nb', 'ns', 'alta', 'ont', 'que', 'pei', 'man', 'sask', 'nl', 'nwt', 'yt', 'nvt',
];

function normalizeSharePct(pct, { floorDisplay = false } = {}) {
    if (pct == null || Number.isNaN(Number(pct))) return null;
    const n = Number(pct);
    if (floorDisplay && n > 0) {
        if (n < 0.1) return 'lt0.1';
        if (n > 0.1 && n <= 0.2) return 'lt0.2';
    }
    return n;
}

function elegenRows(allData, prefix) {
    return allData.filter((row) => row.vector && row.vector.startsWith(prefix));
}

function latestYearFromRows(rows) {
    const years = rows
        .map((row) => Number(row.ref_date))
        .filter((y) => !Number.isNaN(y));
    return years.length ? Math.max(...years) : null;
}

function valueForVector(rows, vector, year) {
    const match = rows.find((row) => row.vector === vector && Number(row.ref_date) === year);
    return match != null ? Number(match.value) : null;
}

function elegenPctSortValue(value) {
    if (value === 'lt0.1') return 0.05;
    if (value === 'lt0.2') return 0.15;
    return Number(value);
}

function buildProvincialBlock(allData, pipelineSourceKey, year, { excludeZeroProvinces = false, floorDisplay = false, keepZeroProvinces = [] } = {}) {
    const canadaVec = `elegen_prov_${pipelineSourceKey}_canada_pct`;
    const canadaRaw = valueForVector(allData, canadaVec, year);
    const canada = normalizeSharePct(canadaRaw);

    const provinces = ELEGEN_PROVINCE_LOC_KEYS.map((key) => {
        const vec = `elegen_prov_${pipelineSourceKey}_${key}_pct`;
        const raw = valueForVector(allData, vec, year);
        if (raw == null || Number.isNaN(raw)) return null;
        if (excludeZeroProvinces && raw === 0 && !keepZeroProvinces.includes(key)) return null;
        const value = normalizeSharePct(raw, { floorDisplay });
        if (value == null) return null;
        return { key, value, sortPct: elegenPctSortValue(value) };
    })
        .filter(Boolean)
        .sort((a, b) => b.sortPct - a.sortPct);

    return { canada, provinces };
}

function buildPage66ProvincialBlock(allData, pipelineSourceKey, year) {
    const canadaVec = `elegen_prov_${pipelineSourceKey}_canada_pct`;
    const canada = normalizeSharePct(valueForVector(allData, canadaVec, year));
    const order = CANADIAN_GENERATION_PROVINCE_ORDER[pipelineSourceKey] || [];

    const provinces = order.map((key) => {
        const vec = `elegen_prov_${pipelineSourceKey}_${key}_pct`;
        const raw = valueForVector(allData, vec, year);
        if (raw == null || Number.isNaN(raw)) {
            if (pipelineSourceKey === 'wind' && key === 'nl') {
                return { key, value: 0, sortPct: 0 };
            }
            return null;
        }
        const value = normalizeSharePct(raw);
        if (value == null) return null;
        return { key, value, sortPct: elegenPctSortValue(value) };
    }).filter(Boolean);

    return { canada, provinces };
}

export async function getCanadianElectricityGenerationData() {
    const allData = await loadAllData();
    const rows = elegenRows(allData, 'elegen_');
    const latestYear = latestYearFromRows(rows);
    if (latestYear == null) {
        return { latestYear: null, years: [], national: null, infographic: null };
    }

    const years = [...new Set(rows.map((row) => Number(row.ref_date)).filter((y) => !Number.isNaN(y)))].sort((a, b) => a - b);
    const totalTwh = valueForVector(allData, 'elegen_can_total_twh', latestYear);

    const slices = CANADIAN_GENERATION_PIE_ORDER.map((key) => ({
        key,
        pct: normalizeSharePct(valueForVector(allData, CANADIAN_GENERATION_PIE_VECTORS[key], latestYear)),
    })).filter((slice) => slice.pct != null);

    const infographicSources = {};
    CANADIAN_GENERATION_INFOGRAPHIC_SOURCES.forEach((sourceKey) => {
        infographicSources[sourceKey] = buildPage66ProvincialBlock(allData, sourceKey, latestYear);
    });

    return {
        latestYear,
        years,
        national: {
            year: latestYear,
            totalTwh,
            slices,
        },
        infographic: {
            year: latestYear,
            sources: infographicSources,
        },
    };
}

const ELECTRICAL_ENERGY_SECTOR_KEYS = ['R', 'C', 'I', 'T', 'A'];
const ELECTRICAL_ENERGY_PROVINCE_PIPELINE_KEYS = ['ATL', 'BC_TERR', 'ALTA', 'SASK', 'MAN', 'ONT', 'QUE'];
const ELECTRICAL_ENERGY_PROVINCE_UI_KEYS = ['atl', 'bc_terr', 'alta', 'sask', 'man', 'ont', 'que'];

export async function getElectricalEnergyUseData() {
    const allData = await loadAllData();
    const byYear = {};
    allData.forEach((row) => {
        if (!row.vector || !row.vector.startsWith('elec_eu_')) return;
        const year = typeof row.ref_date === 'number' ? row.ref_date : Number(row.ref_date);
        if (Number.isNaN(year)) return;
        if (!byYear[year]) byYear[year] = { year };
        const field = row.vector.replace('elec_eu_', '');
        byYear[year][field] = row.value;
    });
    const data = Object.values(byYear)
        .map((row) => {
            const sectors = ELECTRICAL_ENERGY_SECTOR_KEYS.map((key) => ({
                key,
                value: row[key] ?? null,
                pct: row[`${key}_pct`] ?? null,
            }));
            const provinces = ELECTRICAL_ENERGY_PROVINCE_PIPELINE_KEYS.map((key, index) => ({
                key: ELECTRICAL_ENERGY_PROVINCE_UI_KEYS[index],
                value: row[key] ?? null,
                pct: row[`${key}_pct`] ?? null,
            }));
            const total = row.total ?? sectors.reduce((sum, sector) => sum + (sector.value || 0), 0);
            return { year: row.year, total, sectors, provinces };
        })
        .filter((row) => row.total != null && row.sectors.every((sector) => sector.value != null && sector.pct != null))
        .filter((row) => row.provinces.every((province) => province.value != null && province.pct != null))
        .sort((a, b) => a.year - b.year);
    const years = data.map((item) => item.year);
    return {
        data,
        years,
        latestYear: years.length ? years[years.length - 1] : null,
    };
}

const ELECTRICITY_PRICES_MAP_CITY_KEYS = [
    'vancouver', 'calgary', 'edmonton', 'regina', 'winnipeg',
    'toronto', 'ottawa', 'montreal', 'moncton', 'halifax',
    'charlottetown', 'st_johns',
];

const ELECTRICITY_PRICES_VECTOR_RE = /^elec_price_(.+)_(industrial|residential)$/;

export async function getElectricityPricesMapData() {
    const [allData, metadata] = await Promise.all([loadAllData(), loadMetadata()]);

    const priceRows = allData.filter((row) => row.vector && ELECTRICITY_PRICES_VECTOR_RE.test(row.vector));
    if (!priceRows.length) {
        return { referenceDate: null, cities: [] };
    }

    const latestYear = Math.max(
        ...priceRows.map((row) => Number(String(row.ref_date).split('-')[0])).filter(Number.isFinite),
    );
    if (!Number.isFinite(latestYear)) {
        return { referenceDate: null, cities: [] };
    }

    const yearRows = priceRows.filter(
        (row) => Number(String(row.ref_date).split('-')[0]) === latestYear,
    );
    const refDatesForYear = [...new Set(yearRows.map((row) => String(row.ref_date)))];
    const referenceDate = refDatesForYear.sort((a, b) => {
        const aParts = a.split('-');
        const bParts = b.split('-');
        if (aParts.length !== bParts.length) {
            return aParts.length - bParts.length;
        }
        return a.localeCompare(b);
    })[0];

    const latestRows = yearRows.filter((row) => String(row.ref_date) === referenceDate);
    const byCity = {};

    latestRows.forEach((row) => {
        const match = row.vector.match(ELECTRICITY_PRICES_VECTOR_RE);
        if (!match) return;
        const [, cityKey, priceType] = match;
        if (!byCity[cityKey]) {
            byCity[cityKey] = { key: cityKey, industrial: null, residential: null };
        }
        const value = Number(row.value);
        if (!Number.isNaN(value)) {
            byCity[cityKey][priceType] = value;
        }
    });

    const cities = ELECTRICITY_PRICES_MAP_CITY_KEYS
        .filter((key) => byCity[key]?.industrial != null && byCity[key]?.residential != null)
        .map((key) => {
            const metaIndustrial = metadata[`elec_price_${key}_industrial`];
            const title = metaIndustrial?.title || key;
            const label = title.split('—')[0]?.trim() || key;
            return {
                key,
                label,
                industrial: byCity[key].industrial,
                residential: byCity[key].residential,
            };
        });

    return { referenceDate, cities };
}

const WIND_SOLAR_RANK_COUNTRY_KEYS = ['canada', 'usa', 'russia', 'china', 'india'];

function windSolarRankingYears(allData) {
    const refDates = new Set();
    allData.forEach((row) => {
        if (!row.vector?.startsWith('ws_elec_rank_') || !row.vector.endsWith('_pct')) return;
        refDates.add(String(row.ref_date));
    });

    return [...refDates]
        .filter((refDate) =>
            WIND_SOLAR_RANK_COUNTRY_KEYS.every((key) => {
                const pct = windSolarScalar(allData, `ws_elec_rank_${key}_pct`, refDate);
                const order = windSolarScalar(allData, `ws_elec_rank_${key}_order`, refDate);
                return pct != null && order != null;
            }),
        )
        .map((refDate) => Number(refDate))
        .filter(Number.isFinite)
        .sort((a, b) => b - a);
}

function windSolarRankingForYear(allData, year) {
    const refDate = String(year);
    return WIND_SOLAR_RANK_COUNTRY_KEYS
        .map((key) => ({
            key,
            rank: Math.round(windSolarScalar(allData, `ws_elec_rank_${key}_order`, refDate) ?? 0),
            pct: Math.round(windSolarScalar(allData, `ws_elec_rank_${key}_pct`, refDate) ?? 0),
        }))
        .filter((row) => row.pct > 0)
        .sort((a, b) => a.rank - b.rank);
}

function windSolarRankingHistoryRows(allData, rankingYears) {
    return rankingYears
        .slice()
        .sort((a, b) => b - a)
        .map((year) => ({
            year,
            pcts: WIND_SOLAR_RANK_COUNTRY_KEYS.map((key) => {
                const pct = windSolarScalar(allData, `ws_elec_rank_${key}_pct`, String(year));
                return pct != null ? Math.round(pct) : '';
            }),
        }));
}

function windSolarScalar(allData, vector, refDate) {
    const rows = allData.filter((row) => row.vector === vector);
    if (!rows.length) return null;
    if (refDate != null) {
        const match = rows.find((row) => String(row.ref_date) === String(refDate));
        if (match?.value != null && !Number.isNaN(Number(match.value))) {
            return Number(match.value);
        }
    }
    const latest = rows
        .slice()
        .sort((a, b) => String(b.ref_date).localeCompare(String(a.ref_date)))[0];
    return latest?.value != null && !Number.isNaN(Number(latest.value)) ? Number(latest.value) : null;
}

export async function getWindSolarElectricityGrowthData() {
    const allData = await loadAllData();

    const endYear = Math.round(windSolarScalar(allData, 'ws_elec_end_year') ?? 0) || null;
    const startYear = Math.round(windSolarScalar(allData, 'ws_elec_start_year') ?? 0) || null;
    const metaYear = endYear != null ? String(endYear) : '2024';

    const rankingYears = windSolarRankingYears(allData);
    const defaultRankingYear = rankingYears[0]
        ?? (Math.round(windSolarScalar(allData, 'ws_elec_ranking_year') ?? 0) || null);

    const rankingsByYear = {};
    rankingYears.forEach((year) => {
        rankingsByYear[year] = windSolarRankingForYear(allData, year);
    });

    const rankingHistoryRows = windSolarRankingHistoryRows(allData, rankingYears);

    return {
        startYear,
        endYear,
        rankingYears,
        defaultRankingYear,
        rankingsByYear,
        rankingHistoryRows,
        pctChange: Math.round(windSolarScalar(allData, 'ws_elec_renewable_pct_change', metaYear) ?? 0),
        nonGhgPct: Math.round(windSolarScalar(allData, 'ws_elec_non_ghg_pct', metaYear) ?? 0),
        hydroPct: Math.round(windSolarScalar(allData, 'ws_elec_hydro_pct', metaYear) ?? 0),
        nuclearPct: Math.round(windSolarScalar(allData, 'ws_elec_nuclear_pct', metaYear) ?? 0),
        otherRenewablesPct: Math.round(windSolarScalar(allData, 'ws_elec_other_renewables_pct', metaYear) ?? 0),
        windStart: startYear != null ? valueForVector(allData, 'ws_elec_wind_gwh', startYear) : null,
        windEnd: endYear != null ? valueForVector(allData, 'ws_elec_wind_gwh', endYear) : null,
        solarStart: startYear != null ? valueForVector(allData, 'ws_elec_solar_gwh', startYear) : null,
        solarEnd: endYear != null ? valueForVector(allData, 'ws_elec_solar_gwh', endYear) : null,
    };
}

export async function getProvincialElectricityGenerationData() {
    const allData = await loadAllData();
    const rows = elegenRows(allData, 'elegen_prov_');
    const latestYear = latestYearFromRows(rows);
    if (latestYear == null) {
        return { latestYear: null, sourceKeys: PROVINCIAL_GENERATION_SOURCE_KEYS, sources: {} };
    }

    const sources = {};
    PROVINCIAL_GENERATION_SOURCE_KEYS.forEach((uiKey) => {
        const pipelineKey = PROVINCIAL_GENERATION_SOURCE_PIPELINE[uiKey];
        sources[uiKey] = buildProvincialBlock(allData, pipelineKey, latestYear, {
            excludeZeroProvinces: true,
            floorDisplay: true,
        });
    });

    return {
        latestYear,
        sourceKeys: PROVINCIAL_GENERATION_SOURCE_KEYS,
        sources,
    };
}
