"""Section 6 shared constants: vector IDs, URLs, and metadata tuples."""

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
    ('cp_oil_sands_thousand_m3', 'Oil sands production (Page 111)', 'thousand cubic metres', 'units'),
    ('cp_conventional_thousand_m3', 'Conventional crude production (Page 111)', 'thousand cubic metres', 'units'),
    ('cp_total_thousand_m3', 'Total crude oil production (Page 111)', 'thousand cubic metres', 'units'),
    ('cp_oil_sands_mmbd', 'Oil sands production (Page 111)', 'million barrels per day', 'units'),
    ('cp_conventional_mmbd', 'Conventional crude production (Page 111)', 'million barrels per day', 'units'),
    ('cp_total_mmbd', 'Total crude oil production (Page 111)', 'million barrels per day', 'units'),
    ('cp_share_pct', 'Oil sands share of Canadian oil production (Page 111)', 'percent', 'units'),
    ('cp_prov_canada_thousand_m3', 'Canadian crude oil production by province total', 'thousand cubic metres', 'units'),
    ('cp_prov_ab_thousand_m3', 'Alberta crude oil production', 'thousand cubic metres', 'units'),
    ('cp_prov_sk_thousand_m3', 'Saskatchewan crude oil production', 'thousand cubic metres', 'units'),
    ('cp_prov_nl_thousand_m3', 'Newfoundland and Labrador crude oil production', 'thousand cubic metres', 'units'),
    ('cp_prov_mb_thousand_m3', 'Manitoba crude oil production', 'thousand cubic metres', 'units'),
    ('cp_prov_bc_thousand_m3', 'British Columbia crude oil production', 'thousand cubic metres', 'units'),
    ('cp_prov_other_thousand_m3', 'Other provinces crude oil production', 'thousand cubic metres', 'units'),
    ('cp_prov_ab_pct', 'Alberta share of Canadian crude oil production (Page 111)', 'percent', 'units'),
    ('cp_prov_sk_pct', 'Saskatchewan share of Canadian crude oil production (Page 111)', 'percent', 'units'),
    ('cp_prov_nl_pct', 'Newfoundland and Labrador share of Canadian crude oil production (Page 111)', 'percent', 'units'),
    ('cp_prov_mb_pct', 'Manitoba share of Canadian crude oil production (Page 111)', 'percent', 'units'),
    ('cp_prov_bc_pct', 'British Columbia share of Canadian crude oil production (Page 111)', 'percent', 'units'),
    ('cp_prov_other_pct', 'Other provinces share of Canadian crude oil production (Page 111)', 'percent', 'units'),
]

CP_PROVINCE_GEOS = {
    'cp_prov_ab_thousand_m3': 'Alberta',
    'cp_prov_sk_thousand_m3': 'Saskatchewan',
    'cp_prov_nl_thousand_m3': 'Newfoundland and Labrador',
    'cp_prov_mb_thousand_m3': 'Manitoba',
    'cp_prov_bc_thousand_m3': 'British Columbia',
}

CP_PROVINCE_PCT_VECTORS = {
    'cp_prov_ab_thousand_m3': 'cp_prov_ab_pct',
    'cp_prov_sk_thousand_m3': 'cp_prov_sk_pct',
    'cp_prov_nl_thousand_m3': 'cp_prov_nl_pct',
    'cp_prov_mb_thousand_m3': 'cp_prov_mb_pct',
    'cp_prov_bc_thousand_m3': 'cp_prov_bc_pct',
    'cp_prov_other_thousand_m3': 'cp_prov_other_pct',
}
