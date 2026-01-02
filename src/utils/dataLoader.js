/**
 * Data Loader Utility
 * 
 * Loads pre-calculated data from data.csv stored in public/statcan_data/
 * All calculations are done in data_retrieval.py - this module just loads and parses.
 * 
 * Data is stored with virtual vectors like:
 * - page24_oil_gas, page24_electricity, page24_other, page24_total
 * - page25_fuel_energy_pipelines, page25_transport, etc.
 * - page26_jobs, page26_employment_income, page26_gdp, page26_investment_value
 */

// Cache for loaded data
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
    
    // Use Vite's BASE_URL to handle GitHub Pages subdirectory hosting
    const baseUrl = import.meta.env.BASE_URL || '/';
    const response = await fetch(`${baseUrl}statcan_data/data.csv`);
    if (!response.ok) {
        throw new Error(`Failed to load data.csv: ${response.status} ${response.statusText}`);
    }
    
    const csvText = await response.text();
    dataCache = parseCSV(csvText);
    return dataCache;
}

/**
 * Get capital expenditures data for Page 24
 * Returns array of objects: { year, oil_gas, electricity, other, total }
 */
export async function getCapitalExpendituresData() {
    const allData = await loadAllData();
    
    // Filter for page24 vectors
    const page24Data = allData.filter(row => row.vector && row.vector.startsWith('page24_'));
    
    // Group by year
    const yearMap = {};
    page24Data.forEach(row => {
        const year = row.ref_date;
        if (!yearMap[year]) {
            yearMap[year] = { year };
        }
        // Extract field name from vector (e.g., 'page24_oil_gas' -> 'oil_gas')
        const field = row.vector.replace('page24_', '');
        yearMap[year][field] = row.value;
    });
    
    return Object.values(yearMap).sort((a, b) => a.year - b.year);
}

/**
 * Get infrastructure data for Page 25
 * Returns array of objects: { year, fuel_energy_pipelines, transport, health_housing, education, public_safety, environmental, total }
 */
export async function getInfrastructureData() {
    const allData = await loadAllData();
    
    // Filter for page25 vectors
    const page25Data = allData.filter(row => row.vector && row.vector.startsWith('page25_'));
    
    // Group by year
    const yearMap = {};
    page25Data.forEach(row => {
        const year = row.ref_date;
        if (!yearMap[year]) {
            yearMap[year] = { year };
        }
        const field = row.vector.replace('page25_', '');
        yearMap[year][field] = row.value;
    });
    
    return Object.values(yearMap).sort((a, b) => a.year - b.year);
}

/**
 * Get economic contributions data for Page 26
 * Returns array of objects: { year, jobs, employment_income, gdp, investment_value }
 */
export async function getEconomicContributionsData() {
    const allData = await loadAllData();
    
    // Filter for page26 vectors
    const page26Data = allData.filter(row => row.vector && row.vector.startsWith('page26_'));
    
    // Group by year
    const yearMap = {};
    page26Data.forEach(row => {
        const year = row.ref_date;
        if (!yearMap[year]) {
            yearMap[year] = { year };
        }
        const field = row.vector.replace('page26_', '');
        yearMap[year][field] = row.value;
    });
    
    return Object.values(yearMap).sort((a, b) => a.year - b.year);
}

/**
 * Get investment by asset type data for Page 27
 * Returns array of objects with breakdown by asset type:
 * { year, transmission_distribution, pipelines, nuclear, other_electric, hydraulic, wind_solar, steam_thermal, total }
 */
export async function getInvestmentByAssetData() {
    const allData = await loadAllData();
    
    // Filter for page27 vectors
    const page27Data = allData.filter(row => row.vector && row.vector.startsWith('page27_'));
    
    // Group by year
    const yearMap = {};
    page27Data.forEach(row => {
        const year = row.ref_date;
        if (!yearMap[year]) {
            yearMap[year] = { year };
        }
        const field = row.vector.replace('page27_', '');
        yearMap[year][field] = row.value;
    });
    
    return Object.values(yearMap).sort((a, b) => a.year - b.year);
}
