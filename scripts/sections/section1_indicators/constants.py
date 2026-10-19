"""Constants for Section 1: Key Indicators."""

ECON_VECTORS = {
    'jobs_direct': 'v1044855486',
    'jobs_indirect': 'v1044855495',
    'income_direct': 'v1044301086',
    'income_indirect': 'v1044301095',
    'gdp_direct': 'v1044578286',
    'gdp_indirect': 'v1044578295',
}

PROVINCE_VECTORS = {
    'Canada': {'code': 'national_total', 'vector': 'v1138541601'},
    'Newfoundland and Labrador': {'code': 'nl', 'vector': 'v1138541630'},
    'Prince Edward Island': {'code': 'pe', 'vector': 'v1138541659'},
    'Nova Scotia': {'code': 'ns', 'vector': 'v1138541688'},
    'New Brunswick': {'code': 'nb', 'vector': 'v1138541717'},
    'Quebec': {'code': 'qc', 'vector': 'v1138541746'},
    'Ontario': {'code': 'on', 'vector': 'v1138541775'},
    'Manitoba': {'code': 'mb', 'vector': 'v1138541804'},
    'Saskatchewan': {'code': 'sk', 'vector': 'v1138541833'},
    'Alberta': {'code': 'ab', 'vector': 'v1138541862'},
    'British Columbia': {'code': 'bc', 'vector': 'v1138541891'},
    'Yukon': {'code': 'yt', 'vector': 'v1138541920'},
    'Northwest Territories': {'code': 'nt', 'vector': 'v1138541949'},
    'Nunavut': {'code': 'nu', 'vector': 'v1138541978'},
}

PROVINCE_NAMES = {
    'nl': 'Newfoundland and Labrador',
    'pe': 'Prince Edward Island',
    'ns': 'Nova Scotia',
    'nb': 'New Brunswick',
    'qc': 'Quebec',
    'on': 'Ontario',
    'mb': 'Manitoba',
    'sk': 'Saskatchewan',
    'ab': 'Alberta',
    'bc': 'British Columbia',
    'yt': 'Yukon',
    'nt': 'Northwest Territories',
    'nu': 'Nunavut',
    'national_total': 'Canada total'
}

WORLD_ENERGY_COUNTRY_MAPPING = {
    "People's Republic of China": 'china',
    'United States': 'united_states',
    'India': 'india',
    'Canada': 'canada',
    'Indonesia': 'indonesia',
    'Australia': 'australia',
    'Brazil': 'brazil',
    'Norway': 'norway',
    'Mexico': 'mexico',
    'South Africa': 'south_africa',
    'Colombia': 'colombia',
    'United Kingdom': 'united_kingdom',
    'Egypt': 'egypt',
    'Argentina': 'argentina',
}

WORLD_ENERGY_AGGREGATES = [
    'World', 'Non-OECD Total', 'IEA Total', 'OECD Total',
    'Non-OECD Asia (including China)', 'Middle East',
    'Non-OECD Europe and Eurasia', 'Africa', 'Non-OECD Americas',
    'IEA and Accession/Association countries', 'OECD Europe',
    'OECD Americas', 'OECD Asia Oceania',
    'European Union - 28 countries', 'European Union - 27 countries',
]

CEA_REGION_MAPPING = {
    'Africa': 'africa',
    'Asia': 'asia',
    'Canada': 'canada',
    'Europe': 'europe',
    'Latin America and Caribbean': 'latin_america',
    'North America (US and Mexico)': 'north_america',
    'Oceania': 'oceania',
}

CEA_XLSX = 'CEA_2023.xlsx'
WORLD_ENERGY_XLSX = 'World Energy Balances Highlights 2025.xlsx'
CANADA_ENERGY_SUPPLY_XLSX = 'oecd_iea_data.xlsx'
CANADA_ENERGY_SUPPLY_SHEET = 'total_energy_supply'

# ENERGY_PRODUCT groups from the page 6 indicator spec (sheet total_energy_supply).
TES_COAL_PRODUCTS = (
    'BLAST_FURNACE_GAS', 'GAS_COKE', 'COKING_COAL', 'COAL_TAR', 'HARDCOAL_ND',
    'OTH_BITCOAL', 'BKB', 'COKE_OVEN_GAS', 'ANTHRACITE', 'GASWORKS_GAS',
    'SUB_BITCOAL', 'PATENT_FUEL', 'LIGNITE', 'COKE_OVEN_COKE_OTH',
    'MANUFACTURED_GAS_OUTPUT', 'BROWNCOAL_ND',
)
TES_PEAT = ('PEAT', 'PEAT_PRODUCTS')
TES_OIL_SHALE = ('OIL_SHALE',)
TES_CRUDE_NGL = (
    'REFINERY_FEEDSTOCKS', 'ADDITIVES', 'HYDROCARBONS_OTHER', 'NGL', 'CRUDE_OIL',
)
TES_OIL_PRODUCTS = (
    'REFINERY_GAS', 'ETHANE', 'LPG', 'MOTOR_GASOLINE_NONBIO', 'AVIATION_GASOLINE',
    'GASOLINE_JET', 'KEROSENE_JET_NONBIO', 'KEROSENE_OTHER', 'GAS_DIESEL_OIL_NONBIO',
    'FUEL_OIL_RESIDUAL', 'NAPHTHA', 'WHITE_SPIRIT', 'LUBRICANTS', 'BITUMEN',
    'PARAFFIN_WAXES', 'PETROLEUM_COKE', 'OTH_SEC_OIL_PRODS_ND',
)
TES_SOLAR_WIND_OTHER = (
    'SOLAR_PV', 'SOLAR_THERMAL', 'TIDE_WAVE_OCEAN', 'WIND', 'OTHER_ENSOURC',
)
TES_BIOFUELS_WASTE = (
    'WASTE_INDUSTRIAL_NONREN', 'WASTE_MUNICIPAL_REN', 'WASTE_MUNICIPAL_NONREN',
    'PRIMARY_SOLID_BIOFUEL', 'BIOGASES', 'BIOGASOLINE', 'BIODIESEL',
    'LIQBIOFUEL_OTHER', 'BIOFUEL_NONSPEC', 'CHARCOAL',
)
TES_CANADA_TOTAL = ('TOTAL', 'ELECTRICITY')
TES_WORLD_TOTAL = ('TOTAL',)
TES_RENEWABLES_MEMO = ('RENEWABLES_TOTAL',)
TES_MEMO_PEAT_COAL_SHALE = TES_COAL_PRODUCTS + ('PEAT', 'OIL_SHALE')
TES_MEMO_PRIMARY_SECONDARY_OIL = TES_OIL_PRODUCTS + TES_CRUDE_NGL + ('OIL_PRIM_PRODUCTS_ND',)
TES_MEMO_GEO_SOLAR_HEAT_ELEC = TES_SOLAR_WIND_OTHER + (
    'GEOTHERMAL', 'HEAT', 'ELECTRICITY',
)

US_STATE_ENERGY_EXPORTS_XLSX = '2025 Energy Exports by US State.xlsx'
US_STATE_NAME_TO_CODE = {
    'alabama': 'AL',
    'alaska': 'AK',
    'arizona': 'AZ',
    'arkansas': 'AR',
    'california': 'CA',
    'colorado': 'CO',
    'connecticut': 'CT',
    'delaware': 'DE',
    'district of columbia': 'DC',
    'florida': 'FL',
    'georgia': 'GA',
    'hawaii': 'HI',
    'idaho': 'ID',
    'illinois': 'IL',
    'indiana': 'IN',
    'iowa': 'IA',
    'kansas': 'KS',
    'kentucky': 'KY',
    'louisiana': 'LA',
    'maine': 'ME',
    'maryland': 'MD',
    'massachusetts': 'MA',
    'michigan': 'MI',
    'minnesota': 'MN',
    'mississippi': 'MS',
    'missouri': 'MO',
    'montana': 'MT',
    'nebraska': 'NE',
    'nevada': 'NV',
    'new hampshire': 'NH',
    'new jersey': 'NJ',
    'new mexico': 'NM',
    'new york': 'NY',
    'north carolina': 'NC',
    'north dakota': 'ND',
    'ohio': 'OH',
    'oklahoma': 'OK',
    'oregon': 'OR',
    'pennsylvania': 'PA',
    'rhode island': 'RI',
    'south carolina': 'SC',
    'south dakota': 'SD',
    'tennessee': 'TN',
    'texas': 'TX',
    'utah': 'UT',
    'vermont': 'VT',
    'virginia': 'VA',
    'washington': 'WA',
    'washington state': 'WA',
    'west virginia': 'WV',
    'wisconsin': 'WI',
    'wyoming': 'WY',
}

GLOBAL_ENERGY_TRADE_XLSX = 'Canada_s Global Energy Trade.xlsx'
