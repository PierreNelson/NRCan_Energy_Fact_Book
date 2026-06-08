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
