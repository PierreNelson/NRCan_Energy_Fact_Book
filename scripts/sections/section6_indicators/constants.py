"""Section 6 shared constants: vector IDs, URLs, and metadata tuples."""

from pathlib import Path
from typing import Dict

# StatCan vector IDs (numeric, without leading v)
SUPPLY_VECTORS = {
    'net_production': 1251227423,
    'imports': 1251227447,
    'exports': 1251227496,
    'domestic_consumption': 1251227512,
}

PRODUCT_VECTORS = {
    'motor_gasoline': 1251227513,
    'distillate': 1251227517,
    'still_gas': 1251227521,
    'jet': 1251227515,
    'coke': 1251227519,
    'residual': 1251227518,
    'asphalt': 1251227520,
}

REFINERY_INPUT_VECTOR = 107757076

MM3_PER_M3 = 6.2898
STATCAN_SUPPLY_URL = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=2510008101'
STATCAN_REFINERY_URL = 'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=2510006301'

STATCAN_OS_CAPEX_VECTOR = 95928097
CAPP_UPGRADER_CAPACITY_URL = (
    'https://www.capp.ca/wp-content/uploads/2026/05/07-01-Refinery-and-Upgrader-Capacity-1.xlsx'
)
CAPP_OIL_SANDS_MINING_RESERVES_URL = (
    'https://www.capp.ca/wp-content/uploads/2025/12/02-07-Mining-and-Upgraded-Historical-Remaining.xlsx'
)
CAPP_OIL_SANDS_INSITU_RESERVES_URL = (
    'https://www.capp.ca/wp-content/uploads/2025/12/02-08-In-Situ-Historical-Remaining.xlsx'
)
CAPP_CONVENTIONAL_RESERVES_URL = (
    'https://www.capp.ca/wp-content/uploads/2025/12/02-02-Crude-Oil-by-Type-Remaining-Established.xlsx'
)
FETCH_UA = {'User-Agent': 'Mozilla/5.0 (compatible; NRCan-Energy-Factbook/1.0)'}
EIA_WTI_XLS = 'https://www.eia.gov/dnav/pet/xls/PET_PRI_SPT_S1_M.xls'
SPROULE_BASE = 'https://sproule-erce.com/wp-content/uploads'
BOC_VALET = 'https://www.bankofcanada.ca/valet/observations/{series}/json'

CRUDE_PRICES_METADATA = [
    ('crude_wti', 'West Texas Intermediate (WTI) spot price', 'US dollars per barrel', 'units'),
    ('crude_wcs_cad', 'Western Canadian Select (WCS) price', 'Canadian dollars per barrel', 'units'),
    ('crude_usd_cad', 'USD to CAD exchange rate', 'CAD per USD', 'units'),
    ('crude_wcs_usd', 'Western Canadian Select (WCS) USD equivalent', 'US dollars per barrel', 'units'),
    ('crude_differential', 'WTI minus WCS (USD) differential', 'US dollars per barrel', 'units'),
]

CAPP_OIL_SANDS_CAPEX: Dict[int, float] = {
    1958: 0.5, 1959: 1.2, 1960: 1.2, 1961: 1.7, 1962: 25.0, 1963: 40.5, 1964: 80.4,
    1965: 81.6, 1966: 131.5, 1967: 72.5, 1968: 38.8, 1969: 16.9, 1970: 24.8, 1971: 26.9,
    1972: 13.7, 1973: 27.5, 1974: 102.0, 1975: 442.5, 1976: 623.0, 1977: 550.3, 1978: 399.8,
    1979: 245.2, 1980: 430.5, 1981: 541.1, 1982: 386.1, 1983: 422.6, 1984: 510.3, 1985: 1131.5,
    1986: 612.8, 1987: 539.5, 1988: 863.6, 1989: 422.4, 1990: 730.7, 1991: 1090.5, 1992: 639.1,
    1993: 340.8, 1994: 272.6, 1995: 571.9, 1996: 1286.3, 1997: 1914.5, 1998: 1542.5, 1999: 2371.7,
    2000: 4222.6, 2001: 5907.3, 2002: 6750.8, 2003: 5048.2, 2004: 6183.1, 2005: 10437.2,
}

OIL_SANDS_METADATA = [
    ('os_capex_capp_m', 'Oil sands capital expenditures (CAPP)', 'millions of dollars', 'units'),
    ('os_capex_statcan_m', 'Oil sands capital expenditures (StatCan)', 'millions of dollars', 'units'),
    ('os_capex_cumulative_bn', 'Cumulative oil sands capital expenditures', 'billions of dollars', 'units'),
    ('os_oil_sands_thousand_m3', 'Oil sands production', 'thousand cubic metres', 'units'),
    ('os_conventional_thousand_m3', 'Conventional crude production', 'thousand cubic metres', 'units'),
    ('os_total_thousand_m3', 'Total crude oil and equivalent production', 'thousand cubic metres', 'units'),
    ('os_oil_sands_mmbd', 'Oil sands production', 'million barrels per day', 'units'),
    ('os_conventional_mmbd', 'Conventional crude production', 'million barrels per day', 'units'),
    ('os_total_mmbd', 'Total crude oil and equivalent production', 'million barrels per day', 'units'),
    ('os_share_pct', 'Oil sands share of Canadian oil production', 'percent', 'units'),
    ('os_proved_reserves_pct', 'Oil sands share of Canada\'s proved reserves', 'percent', 'units'),
    ('os_upgrading_pct', 'Raw bitumen sent for upgrading in Alberta', 'percent', 'units'),
    ('os_upgrading_capacity_mmbd', 'Total oil sands upgrader capacity in Canada', 'million barrels per day', 'units'),
]

CANADIAN_PRODUCTION_METADATA = [
    ('cp_oil_sands_thousand_m3', 'Oil sands production', 'thousand cubic metres', 'units'),
    ('cp_conventional_thousand_m3', 'Conventional crude production', 'thousand cubic metres', 'units'),
    ('cp_total_thousand_m3', 'Total crude oil production', 'thousand cubic metres', 'units'),
    ('cp_oil_sands_mmbd', 'Oil sands production', 'million barrels per day', 'units'),
    ('cp_conventional_mmbd', 'Conventional crude production', 'million barrels per day', 'units'),
    ('cp_total_mmbd', 'Total crude oil production', 'million barrels per day', 'units'),
    ('cp_share_pct', 'Oil sands share of Canadian oil production', 'percent', 'units'),
    ('cp_prov_canada_thousand_m3', 'Canadian crude oil production by province total', 'thousand cubic metres', 'units'),
    ('cp_prov_ab_thousand_m3', 'Alberta crude oil production', 'thousand cubic metres', 'units'),
    ('cp_prov_sk_thousand_m3', 'Saskatchewan crude oil production', 'thousand cubic metres', 'units'),
    ('cp_prov_nl_thousand_m3', 'Newfoundland and Labrador crude oil production', 'thousand cubic metres', 'units'),
    ('cp_prov_mb_thousand_m3', 'Manitoba crude oil production', 'thousand cubic metres', 'units'),
    ('cp_prov_bc_thousand_m3', 'British Columbia crude oil production', 'thousand cubic metres', 'units'),
    ('cp_prov_other_thousand_m3', 'Other provinces crude oil production', 'thousand cubic metres', 'units'),
    ('cp_prov_ns_thousand_m3', 'Nova Scotia crude oil production', 'thousand cubic metres', 'units'),
    ('cp_prov_on_thousand_m3', 'Ontario crude oil production', 'thousand cubic metres', 'units'),
    ('cp_prov_nt_thousand_m3', 'Northwest Territories crude oil production', 'thousand cubic metres', 'units'),
    ('cp_prov_ab_pct', 'Alberta share of Canadian crude oil production', 'percent', 'units'),
    ('cp_prov_sk_pct', 'Saskatchewan share of Canadian crude oil production', 'percent', 'units'),
    ('cp_prov_nl_pct', 'Newfoundland and Labrador share of Canadian crude oil production', 'percent', 'units'),
    ('cp_prov_mb_pct', 'Manitoba share of Canadian crude oil production', 'percent', 'units'),
    ('cp_prov_bc_pct', 'British Columbia share of Canadian crude oil production', 'percent', 'units'),
    ('cp_prov_other_pct', 'Other provinces share of Canadian crude oil production', 'percent', 'units'),
    ('cp_prov_ns_pct', 'Nova Scotia share of Canadian crude oil production', 'percent', 'units'),
    ('cp_prov_on_pct', 'Ontario share of Canadian crude oil production', 'percent', 'units'),
    ('cp_prov_nt_pct', 'Northwest Territories share of Canadian crude oil production', 'percent', 'units'),
]

CP_PROVINCE_GEOS = {
    'cp_prov_ab_thousand_m3': 'Alberta',
    'cp_prov_sk_thousand_m3': 'Saskatchewan',
    'cp_prov_nl_thousand_m3': 'Newfoundland and Labrador',
    'cp_prov_mb_thousand_m3': 'Manitoba',
    'cp_prov_bc_thousand_m3': 'British Columbia',
}

CP_OTHER_SUB_GEOS = {
    'cp_prov_ns_thousand_m3': 'Nova Scotia',
    'cp_prov_on_thousand_m3': 'Ontario',
    'cp_prov_nt_thousand_m3': 'Northwest Territories',
}

CP_PROVINCE_PCT_VECTORS = {
    'cp_prov_ab_thousand_m3': 'cp_prov_ab_pct',
    'cp_prov_sk_thousand_m3': 'cp_prov_sk_pct',
    'cp_prov_nl_thousand_m3': 'cp_prov_nl_pct',
    'cp_prov_mb_thousand_m3': 'cp_prov_mb_pct',
    'cp_prov_bc_thousand_m3': 'cp_prov_bc_pct',
    'cp_prov_ns_thousand_m3': 'cp_prov_ns_pct',
    'cp_prov_on_thousand_m3': 'cp_prov_on_pct',
    'cp_prov_nt_thousand_m3': 'cp_prov_nt_pct',
    'cp_prov_other_thousand_m3': 'cp_prov_other_pct',
}

# petroleum reserves and Western Canada oil wells
PETROLEUM_EMP_XLSX = 'energy_rankings_and_petroleum_emp.xlsx'
PETROLEUM_RESERVES_SUMMARY_SHEET = 'petroleum_reserves_summary'
MB_OIL_WELLS_SHEET = 'mb_oil_wells_count_depth'
PETROLEUM_RESERVES_SEED_DIR = Path(__file__).resolve().parents[3].parent / 'NRCan_Energy_Factbook_data'

AER_ST59_URL = 'https://www.aer.ca/data-and-performance-reports/statistical-reports/st59'
SK_OIL_WELLS_URL = (
    'https://www.petrinex.gov.ab.ca/publicdata/API/Files/SK/Infra/Well%20Infrastructure/CSV'
)
# BC ER data centre landing page lists several downloads; completion/workover
# data for oil wells is in the IRIS "Drilling Data for All Wells" CSV zip.
BC_OIL_WELLS_URL = 'https://iris.bcogc.ca/download/drill_csv.zip'
BC_OIL_WELLS_COMPLETIONS_CSV = 'compl_wo.csv'

BROWSER_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-CA,en;q=0.9',
    'Referer': 'https://www.aer.ca/',
}

PETROLEUM_RESERVES_METADATA = [
    ('cr_res_total_bb', 'Total remaining established crude oil reserves', 'billion barrels', 'units'),
    ('cr_res_conventional_bb', 'Conventional remaining established crude oil reserves', 'billion barrels', 'units'),
    ('cr_res_oil_sands_bb', 'Oil sands remaining established crude oil reserves', 'billion barrels', 'units'),
    ('cr_res_mining_bb', 'Mining remaining established crude oil reserves', 'billion barrels', 'units'),
    ('cr_res_insitu_bb', 'In situ remaining established crude oil reserves', 'billion barrels', 'units'),
    ('cr_res_reporting_year', 'Petroleum reserves reporting year', 'year', 'units'),
]

WESTERN_CANADA_OIL_WELLS_METADATA = [
    ('wc_oil_wells_completed', 'Western Canada oil wells completed', 'wells', 'units'),
    ('wc_oil_total_metres', 'Western Canada oil wells total metres drilled', 'metres', 'units'),
    ('wc_oil_avg_depth_m', 'Western Canada oil wells average depth', 'metres', 'units'),
]

# petroleum sector employment by region
PETROLEUM_EMPLOYMENT_SHEET = 'petroleum_sector_employment'
PETROLEUM_EMPLOYMENT_SHEET_ALIASES = (
    'petroleum_sector_employment',
    'statcan_petroleum_sector_employment_summary',
)
PETROLEUM_EMP_REGION_KEYS = ('bc', 'alta', 'sask', 'man', 'ont', 'que', 'maritimes', 'nl')
PETROLEUM_EMP_REGION_MAP: Dict[str, str] = {
    'bc': 'bc',
    'b.c.': 'bc',
    'british columbia': 'bc',
    'colombie-britannique': 'bc',
    'alta': 'alta',
    'ab': 'alta',
    'alberta': 'alta',
    'sask': 'sask',
    'sk': 'sask',
    'saskatchewan': 'sask',
    'man': 'man',
    'mb': 'man',
    'manitoba': 'man',
    'ont': 'ont',
    'on': 'ont',
    'ontario': 'ont',
    'que': 'que',
    'qc': 'que',
    'quebec': 'que',
    'québec': 'que',
    'maritimes': 'maritimes',
    'maritime region': 'maritimes',
    'maritime': 'maritimes',
    'nl': 'nl',
    'n.l.': 'nl',
    'newfoundland and labrador': 'nl',
    'terre-neuve-et-labrador': 'nl',
    'canada': 'canada',
}

PETROLEUM_EMPLOYMENT_METADATA = [
    ('pet_emp_reporting_year', 'Petroleum sector employment reporting year', 'year', 'units'),
    ('pet_emp_direct_total', 'Direct petroleum sector employment total', 'persons', 'units'),
    ('pet_emp_indirect_total', 'Indirect petroleum sector employment total', 'persons', 'units'),
    ('pet_emp_bc_direct_pct', 'British Columbia direct petroleum employment share', 'percent', 'units'),
    ('pet_emp_bc_indirect_pct', 'British Columbia indirect petroleum employment share', 'percent', 'units'),
    ('pet_emp_alta_direct_pct', 'Alberta direct petroleum employment share', 'percent', 'units'),
    ('pet_emp_alta_indirect_pct', 'Alberta indirect petroleum employment share', 'percent', 'units'),
    ('pet_emp_sask_direct_pct', 'Saskatchewan direct petroleum employment share', 'percent', 'units'),
    ('pet_emp_sask_indirect_pct', 'Saskatchewan indirect petroleum employment share', 'percent', 'units'),
    ('pet_emp_man_direct_pct', 'Manitoba direct petroleum employment share', 'percent', 'units'),
    ('pet_emp_man_indirect_pct', 'Manitoba indirect petroleum employment share', 'percent', 'units'),
    ('pet_emp_ont_direct_pct', 'Ontario direct petroleum employment share', 'percent', 'units'),
    ('pet_emp_ont_indirect_pct', 'Ontario indirect petroleum employment share', 'percent', 'units'),
    ('pet_emp_que_direct_pct', 'Quebec direct petroleum employment share', 'percent', 'units'),
    ('pet_emp_que_indirect_pct', 'Quebec indirect petroleum employment share', 'percent', 'units'),
    ('pet_emp_maritimes_direct_pct', 'Maritime region direct petroleum employment share', 'percent', 'units'),
    ('pet_emp_maritimes_indirect_pct', 'Maritime region indirect petroleum employment share', 'percent', 'units'),
    ('pet_emp_nl_direct_pct', 'Newfoundland and Labrador direct petroleum employment share', 'percent', 'units'),
    ('pet_emp_nl_indirect_pct', 'Newfoundland and Labrador indirect petroleum employment share', 'percent', 'units'),
]

PETROLEUM_EMPLOYMENT_SEED_ROWS = [
    {'reporting_year': 2024, 'metric': 'direct', 'province_territory': 'bc', 'value': 5},
    {'reporting_year': 2024, 'metric': 'direct', 'province_territory': 'alta', 'value': 73},
    {'reporting_year': 2024, 'metric': 'direct', 'province_territory': 'sask', 'value': 6},
    {'reporting_year': 2024, 'metric': 'direct', 'province_territory': 'man', 'value': 1},
    {'reporting_year': 2024, 'metric': 'direct', 'province_territory': 'ont', 'value': 8},
    {'reporting_year': 2024, 'metric': 'direct', 'province_territory': 'que', 'value': 4},
    {'reporting_year': 2024, 'metric': 'direct', 'province_territory': 'maritimes', 'value': 1},
    {'reporting_year': 2024, 'metric': 'direct', 'province_territory': 'nl', 'value': 2},
    {'reporting_year': 2024, 'metric': 'indirect', 'province_territory': 'bc', 'value': 11},
    {'reporting_year': 2024, 'metric': 'indirect', 'province_territory': 'alta', 'value': 46},
    {'reporting_year': 2024, 'metric': 'indirect', 'province_territory': 'sask', 'value': 5},
    {'reporting_year': 2024, 'metric': 'indirect', 'province_territory': 'man', 'value': 2},
    {'reporting_year': 2024, 'metric': 'indirect', 'province_territory': 'ont', 'value': 24},
    {'reporting_year': 2024, 'metric': 'indirect', 'province_territory': 'que', 'value': 6},
    {'reporting_year': 2024, 'metric': 'indirect', 'province_territory': 'maritimes', 'value': 4},
    {'reporting_year': 2024, 'metric': 'indirect', 'province_territory': 'nl', 'value': 2},
    {'reporting_year': 2024, 'metric': 'direct_total', 'province_territory': 'canada', 'value': 190000},
    {'reporting_year': 2024, 'metric': 'indirect_total', 'province_territory': 'canada', 'value': 313000},
]

# world proved reserves of crude oil
WORLD_CRUDE_RES_CRUDE_SHEET = 'proved_reserves_crude_oil'
WORLD_CRUDE_RES_CRUDE_SHEET_ALIASES = (
    'proved_reserves_crude_oil',
    'ogj_petroleum_world_proved_reserves',
)
WORLD_CRUDE_RES_METRICS_SHEET = 'proved_reserves_metrics'
WORLD_CRUDE_RES_METRICS_SHEET_ALIASES = (
    'proved_reserves_metrics',
    'proved_reserves_crude_oil_metrics',
)
WORLD_CRUDE_RES_COUNTRY_KEYS = ('other', 'venezuela', 'saudi', 'iran', 'canada', 'iraq')
WORLD_CRUDE_RES_COUNTRY_MAP: Dict[str, str] = {
    'other': 'other',
    'others': 'other',
    'autres': 'other',
    'venezuela': 'venezuela',
    'vénezuela': 'venezuela',
    'saudi': 'saudi',
    'saudi arabia': 'saudi',
    'saudi_arabia': 'saudi',
    'arabie saoudite': 'saudi',
    'iran': 'iran',
    'canada': 'canada',
    'iraq': 'iraq',
    'irak': 'iraq',
}
WORLD_CRUDE_RES_OIL_SANDS_METRIC = 'canada_oil_sands_share_of_proved_reserves'
WORLD_CRUDE_RES_METRIC_MAP: Dict[str, str] = {
    'canada_oil_sands_share_of_proved_reserves': WORLD_CRUDE_RES_OIL_SANDS_METRIC,
    'oil_sands_share': WORLD_CRUDE_RES_OIL_SANDS_METRIC,
    'canada_oil_sands_share': WORLD_CRUDE_RES_OIL_SANDS_METRIC,
}

WORLD_CRUDE_RES_METADATA = [
    ('wr_crude_res_reporting_year', 'World crude proved reserves reporting year', 'year', 'units'),
    ('wr_crude_res_total_bb', 'World crude proved reserves total', 'billion barrels', 'units'),
    ('wr_crude_res_oil_sands_share_pct', 'Canada oil sands share of proved reserves', 'percent', 'units'),
    ('wr_crude_res_other_bb', 'Other world crude proved reserves', 'billion barrels', 'units'),
    ('wr_crude_res_other_pct', 'Other world crude proved reserves share', 'percent', 'units'),
    ('wr_crude_res_venezuela_bb', 'Venezuela crude proved reserves', 'billion barrels', 'units'),
    ('wr_crude_res_venezuela_pct', 'Venezuela crude proved reserves share', 'percent', 'units'),
    ('wr_crude_res_saudi_bb', 'Saudi Arabia crude proved reserves', 'billion barrels', 'units'),
    ('wr_crude_res_saudi_pct', 'Saudi Arabia crude proved reserves share', 'percent', 'units'),
    ('wr_crude_res_iran_bb', 'Iran crude proved reserves', 'billion barrels', 'units'),
    ('wr_crude_res_iran_pct', 'Iran crude proved reserves share', 'percent', 'units'),
    ('wr_crude_res_canada_bb', 'Canada crude proved reserves', 'billion barrels', 'units'),
    ('wr_crude_res_canada_pct', 'Canada crude proved reserves share', 'percent', 'units'),
    ('wr_crude_res_iraq_bb', 'Iraq crude proved reserves', 'billion barrels', 'units'),
    ('wr_crude_res_iraq_pct', 'Iraq crude proved reserves share', 'percent', 'units'),
]

WORLD_CRUDE_RES_SEED_CRUDE_ROWS = [
    {'reporting_year': 2023, 'country_category': 'other', 'value_bb': 672},
    {'reporting_year': 2023, 'country_category': 'venezuela', 'value_bb': 301},
    {'reporting_year': 2023, 'country_category': 'saudi', 'value_bb': 265},
    {'reporting_year': 2023, 'country_category': 'iran', 'value_bb': 212},
    {'reporting_year': 2023, 'country_category': 'canada', 'value_bb': 177},
    {'reporting_year': 2023, 'country_category': 'iraq', 'value_bb': 141},
]

WORLD_CRUDE_RES_SEED_METRICS_ROWS = [
    {
        'reporting_year': 2023,
        'metric': 'canada_oil_sands_share_of_proved_reserves',
        'value': 97,
    },
]
