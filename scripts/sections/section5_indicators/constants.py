"""Constants for Section 5: Clean power and low carbon fuels."""

CER_ELECTRICITY_TRADE_URL = (
    "https://www.cer-rec.gc.ca/en/data-analysis/energy-commodities/electricity/statistics/"
    "electricity-trade-summary/electricity-trades-summary-resume-echanges-commerciaux-electricite.xlsm"
)
CER_ELECTRICITY_TRADE_SHEET = "Fig. 1 (a), Fig. 3 (a)"
CER_ELECTRICITY_TRADE_MONTHLY_SHEET = "Fig. 1(m), Fig. 3(m)"
CER_ELECTRICITY_TRADE_REQUIRED_MONTHS = 12

CER_ELECTRICITY_TRADE_METADATA = [
    (
        "elec_trade_exports",
        "Electricity exports to the U.S.",
        "Terawatt hours",
        "terawatt hours",
        "Canada Energy Regulator",
        CER_ELECTRICITY_TRADE_URL,
    ),
    (
        "elec_trade_imports",
        "Electricity imports from the U.S.",
        "Terawatt hours",
        "terawatt hours",
        "Canada Energy Regulator",
        CER_ELECTRICITY_TRADE_URL,
    ),
    (
        "elec_trade_net",
        "Net electricity trade with the U.S.",
        "Terawatt hours",
        "terawatt hours",
        "Canada Energy Regulator",
        CER_ELECTRICITY_TRADE_URL,
    ),
]

EV_SALES_URL_20100021 = "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=2010002101"
EV_SALES_URL_20100025 = "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=2010002501"

EV_SALES_OLD_TOTAL = 1079014832
EV_SALES_OLD_BEV = 1079014835
EV_SALES_OLD_PHEV = 1079014837
EV_SALES_NEW_TOTAL = 1671330686
EV_SALES_NEW_BEV = 1277485216
EV_SALES_NEW_PHEV = 1277490561

EV_SALES_METADATA = [
    (
        "ev_total_regs",
        "Total new vehicle registrations",
        "Number",
        "units",
        "Statistics Canada",
        EV_SALES_URL_20100025,
    ),
    (
        "ev_new_regs",
        "New EV registrations (battery electric + plug-in hybrid electric)",
        "Number",
        "units",
        "Statistics Canada",
        EV_SALES_URL_20100025,
    ),
    (
        "ev_share_pct",
        "Proportion of total new vehicle registrations",
        "Percent",
        "percent",
        "Statistics Canada",
        EV_SALES_URL_20100025,
    ),
]

EV_SALES_VECTORS = {row[0] for row in EV_SALES_METADATA}

TSX_CLEANTECH_URL = "https://www.tsx.com/resource/en/571"

DEFAULT_TMX_XLSX = "tmx_cleantech.xlsx"
DEFAULT_TMX_XLSX_ROOT = "tsx-and-amp-tsxv-listed-companies-2026-02-17-en.xlsx"

CLEANTECH_GEO_URL = "https://natural-resources.canada.ca/science-innovation/research-development/clean-technology/clean-growth-hub/clean-technology-data-strategy/cleantech-companies"

CLEANTECH_GEO_REGIONS = [
    ("alta", "Alberta"),
    ("atl", "Atlantic Provinces"),
    ("bc", "British Columbia"),
    ("man", "Manitoba"),
    ("ont", "Ontario"),
    ("que", "Quebec"),
    ("sask", "Saskatchewan"),
    ("terr", "Territories"),
]

CLEANTECH_INDUSTRIES = [
    ("renewable_energy", "Renewable Energy"),
    ("energy_efficiency", "Energy Efficiency"),
    ("biofuels_bioenergy", "Biofuels, Bioenergy and Bioproducts"),
    ("air_env_remediation", "Air, Environment and Remediation"),
    ("water_wastewater", "Water and Wastewater"),
    ("smart_grid_storage", "Smart Grid and Energy Storage"),
    ("transportation", "Transportation"),
    ("agriculture_forestry", "Agriculture and Forestry"),
    ("waste_recycling", "Waste and Recycling"),
    ("mining_manufacturing", "Mining and Manufacturing"),
]

WIND_CAPACITY_GENCAP_XLSX = "secondary Master gencap file.xlsx"
WIND_CAPACITY_GENCAP_SHEET = "src_elecap_prov "
WIND_POWER_CANADA_XLSX = "Wind capacity and generation_Canada.xlsx"
WIND_POWER_CAP_SHEET = "cap"
WIND_POWER_GEN_SHEET = "gen"
WIND_POWER_BASE_YEAR = 2011
WIND_POWER_METADATA = [
    ("win_pwr_cap_cum_mw", "Installed wind capacity, cumulative", "MW", "megawatts", "Natural Resources Canada", ""),
    ("win_pwr_cap_add_mw", "Installed wind capacity, annual additions", "MW", "megawatts", "Natural Resources Canada", ""),
    ("win_pwr_cap_cum_gw", "Installed wind capacity, cumulative", "GW", "gigawatts", "Natural Resources Canada", ""),
    ("win_pwr_gen_twh", "Wind electricity generation", "TWh", "terawatt-hours", "Natural Resources Canada", ""),
    ("win_pwr_stat_cap_gw", "Wind capacity, latest year", "GW", "gigawatts", "Natural Resources Canada", ""),
    ("win_pwr_stat_gen_twh", "Wind generation, latest year", "TWh", "terawatt-hours", "Natural Resources Canada", ""),
    ("win_pwr_stat_cap_year", "Wind capacity reference year", "Year", "year", "Natural Resources Canada", ""),
    ("win_pwr_stat_gen_year", "Wind generation reference year", "Year", "year", "Natural Resources Canada", ""),
    ("win_pwr_stat_cap_ratio", "Wind capacity ratio vs 2011", "Ratio", "ratio", "Natural Resources Canada", ""),
    ("win_pwr_stat_gen_ratio", "Wind generation ratio vs 2011", "Ratio", "ratio", "Natural Resources Canada", ""),
    ("win_pwr_stat_cap_mult", "Wind capacity growth multiplier vs 2011", "Multiplier", "multiplier", "Natural Resources Canada", ""),
    ("win_pwr_stat_gen_mult", "Wind generation growth multiplier vs 2011", "Multiplier", "multiplier", "Natural Resources Canada", ""),
]
GENCAP_REN_ELEGEN_XLSX = "secondary Master gencap file.xlsx"
GENCAP_REN_ELEGEN_SHEET = "ren_elegen"

WORLD_WIND_XLSX = "World capacity of wind and solar power.xlsx"
WORLD_WIND_SHEET = "worldcap_wind"
WORLD_WIND_SKIP_LOCATIONS = frozenset({
    "source:",
    "frequency:",
    "timeliness:",
})
WORLD_WIND_COUNTRY_IDS = {
    "china": 1,
    "usa": 2,
    "germany": 3,
    "india": 4,
    "brazil": 5,
    "spain": 6,
    "uk": 7,
    "canada": 8,
}
WORLD_WIND_LOCATION_TO_KEY = {
    "world": "world",
    "china": "china",
    "usa": "usa",
    "united states": "usa",
    "germany": "germany",
    "india": "india",
    "brazil": "brazil",
    "canada": "canada",
    "spain": "spain",
    "uk": "uk",
    "united kingdom": "uk",
}
WORLD_WIND_METADATA = [
    ("win_world_total_gw", "World wind power capacity", "GW", "gigawatts", "Global Wind Energy Council", ""),
    *[
        (f"win_world_top{rank}_share_pct", f"World wind capacity share rank {rank}", "%", "percent", "Global Wind Energy Council", "")
        for rank in range(1, 6)
    ],
    *[
        (f"win_world_top{rank}_country_id", f"World wind capacity country rank {rank}", "ID", "country_id", "Global Wind Energy Council", "")
        for rank in range(1, 6)
    ],
    ("win_world_canada_share_pct", "Canada share of world wind capacity", "%", "percent", "Global Wind Energy Council", ""),
    ("win_world_canada_rank", "Canada rank in world wind capacity", "Rank", "rank", "Global Wind Energy Council", ""),
    ("win_can_wind_elec_share_pct", "Wind share of Canadian electricity generation", "%", "percent", "Natural Resources Canada", ""),
]

WORLD_SOLAR_XLSX = "World capacity of wind and solar power.xlsx"
WORLD_SOLAR_SHEET = "worldcap_solar"
WORLD_SOLAR_SKIP_LOCATIONS = frozenset({
    "source:",
    "frequency:",
    "timeliness:",
})
WORLD_SOLAR_COUNTRY_IDS = {
    "china": 1,
    "usa": 2,
    "germany": 3,
    "india": 4,
    "japan": 5,
    "canada": 6,
}
WORLD_SOLAR_LOCATION_TO_KEY = {
    "world": "world",
    "china": "china",
    "usa": "usa",
    "united states": "usa",
    "germany": "germany",
    "india": "india",
    "japan": "japan",
    "canada": "canada",
}
WORLD_SOLAR_METADATA = [
    ("sol_world_total_gw", "World solar PV capacity", "GW", "gigawatts", "IEA-PVPS", ""),
    *[
        (f"sol_world_top{rank}_share_pct", f"World solar PV capacity share rank {rank}", "%", "percent", "IEA-PVPS", "")
        for rank in range(1, 6)
    ],
    *[
        (f"sol_world_top{rank}_country_id", f"World solar PV capacity country rank {rank}", "ID", "country_id", "IEA-PVPS", "")
        for rank in range(1, 6)
    ],
    ("sol_world_canada_share_pct", "Canada share of world solar PV capacity", "%", "percent", "IEA-PVPS", ""),
    ("sol_world_canada_rank", "Canada rank in world solar PV capacity", "Rank", "rank", "IEA-PVPS", ""),
]

RENEWABLE_ELECAP_GENCAP_XLSX = "secondary Master gencap file.xlsx"
RENEWABLE_ELECAP_GENCAP_SHEET = "ren_elecap"
RENEWABLE_ELECAP_MIN_YEAR = 2018
RENEWABLE_ELECAP_SOURCE_TO_KEY = {
    "hydro": "hydro",
    "wind": "wind",
    "biomass": "biomass",
    "solar & tidal": "solar_tidal",
}
RENEWABLE_ELECAP_METADATA = [
    ("ren_cap_hydro", "Hydro renewable electricity capacity", "MW", "megawatts", "Natural Resources Canada", ""),
    ("ren_cap_wind", "Wind renewable electricity capacity", "MW", "megawatts", "Natural Resources Canada", ""),
    ("ren_cap_biomass", "Biomass renewable electricity capacity", "MW", "megawatts", "Natural Resources Canada", ""),
    ("ren_cap_solar_tidal", "Solar and tidal renewable electricity capacity", "MW", "megawatts", "Natural Resources Canada", ""),
]

GHG_ELECTRICITY_INDICATORS_PAGE = (
    "https://www.canada.ca/en/environment-climate-change/services/environmental-indicators/greenhouse-gas-emissions.html"
)
GHG_ELECTRICITY_SOURCE_URL = GHG_ELECTRICITY_INDICATORS_PAGE
GHG_ELECTRICITY_CSV_DEFAULT = (
    "https://www.canada.ca/content/dam/eccc/documents/csv/cesindicators/ghg-emissions/2026/ghg-emissions-electricity-en.csv"
)
GHG_ELECTRICITY_COAL_ELEGEN_XLSX = "secondary Master gencap file.xlsx"
GHG_ELECTRICITY_COAL_ELEGEN_SHEET = "coal_elegen"
GHG_ELECTRICITY_MIN_YEAR = 2000
GHG_ELECTRICITY_NARRATIVE_BASE_YEAR = 2000
GHG_ELECTRICITY_SOURCE_ORG = "Environment and Climate Change Canada"

GHG_ELECTRICITY_METADATA = [
    ("elec_ghg_coal", "Electricity sector GHG emissions, coal", "Mt CO2 eq", "megatonnes", GHG_ELECTRICITY_SOURCE_ORG, GHG_ELECTRICITY_SOURCE_URL),
    ("elec_ghg_natural_gas", "Electricity sector GHG emissions, natural gas", "Mt CO2 eq", "megatonnes", GHG_ELECTRICITY_SOURCE_ORG, GHG_ELECTRICITY_SOURCE_URL),
    ("elec_ghg_other", "Electricity sector GHG emissions, other", "Mt CO2 eq", "megatonnes", GHG_ELECTRICITY_SOURCE_ORG, GHG_ELECTRICITY_SOURCE_URL),
    ("elec_ghg_total", "Electricity sector GHG emissions, total", "Mt CO2 eq", "megatonnes", GHG_ELECTRICITY_SOURCE_ORG, GHG_ELECTRICITY_SOURCE_URL),
]

GHG_ELECTRICITY_STAT_METADATA = [
    ("elec_ghg_stat_base_year", "Electricity GHG narrative base year", "year", "none"),
    ("elec_ghg_stat_reference_year", "Electricity GHG narrative reference year", "year", "none"),
    ("elec_ghg_stat_total_pct_change", "Electricity GHG total percent change (base to reference year)", "percent", "units"),
    ("elec_ghg_stat_coal_gen_share_pct", "Coal electricity generation share (reference year)", "percent", "units"),
    ("elec_ghg_stat_coal_ghg_share_pct", "Coal share of electricity-related GHG emissions (reference year)", "percent", "units"),
]
ELECTRICITY_GENERATION_GENCAP_XLSX = "secondary Master gencap file.xlsx"
ELECTRICITY_GENERATION_CAN_SHEET = "src_elegen_can"
ELECTRICITY_GENERATION_PROV_SHEET = "src_elegen_prov"
ELECTRICITY_GENERATION_SOURCE_ORG = "Natural Resources Canada"
ELECTRICITY_GENERATION_SOURCE_URL = ""

ELECTRICITY_GENERATION_CAN_SOURCE_TO_KEY = {
    "coal": "coal",
    "natural gas": "natural_gas",
    "petroleum/others": "petroleum",
    "nuclear": "nuclear",
    "hydro": "hydro",
    "other renewables": "other_renewables",
    "total": "total",
}

ELECTRICITY_GENERATION_PROV_SOURCE_TO_KEY = {
    "coal": "coal",
    "natural gas": "natural_gas",
    "petroleum": "petroleum",
    "biomass": "biomass",
    "other": "other",
    "hydro": "hydro",
    "nuclear": "nuclear",
    "wind": "wind",
    "solar": "solar",
}

ELECTRICITY_GENERATION_LOCATION_TO_KEY = {
    "Canada": "canada",
    "B.C.": "bc",
    "N.B.": "nb",
    "N.S.": "ns",
    "Alta.": "alta",
    "Que.": "que",
    "P.E.I.": "pei",
    "Ont.": "ont",
    "Sask.": "sask",
    "Man.": "man",
    "N.L.": "nl",
    "Y.T.": "yt",
    "N.W.T.": "nwt",
    "Nvt.": "nvt",
}

ELECTRICITY_GENERATION_METADATA = [
    ("elegen_can_total_twh", "Total Canadian electricity generation", "TWh", "terawatt hours", ELECTRICITY_GENERATION_SOURCE_ORG, ELECTRICITY_GENERATION_SOURCE_URL),
    ("elegen_can_coal_pct", "Canadian electricity generation share — coal", "Percent", "percent", ELECTRICITY_GENERATION_SOURCE_ORG, ELECTRICITY_GENERATION_SOURCE_URL),
    ("elegen_can_natural_gas_pct", "Canadian electricity generation share — natural gas", "Percent", "percent", ELECTRICITY_GENERATION_SOURCE_ORG, ELECTRICITY_GENERATION_SOURCE_URL),
    ("elegen_can_petroleum_pct", "Canadian electricity generation share — petroleum/others", "Percent", "percent", ELECTRICITY_GENERATION_SOURCE_ORG, ELECTRICITY_GENERATION_SOURCE_URL),
    ("elegen_can_nuclear_pct", "Canadian electricity generation share — nuclear", "Percent", "percent", ELECTRICITY_GENERATION_SOURCE_ORG, ELECTRICITY_GENERATION_SOURCE_URL),
    ("elegen_can_hydro_pct", "Canadian electricity generation share — hydro", "Percent", "percent", ELECTRICITY_GENERATION_SOURCE_ORG, ELECTRICITY_GENERATION_SOURCE_URL),
    ("elegen_can_other_renewables_pct", "Canadian electricity generation share — other renewables", "Percent", "percent", ELECTRICITY_GENERATION_SOURCE_ORG, ELECTRICITY_GENERATION_SOURCE_URL),
]

LARGEST_WIND_PROJECTS_XLSX = "Largest hydrofac, wind and solar projects.xlsx"
LARGEST_WIND_PROJECTS_SHEET = "windprojects"
MIN_WIND_PROJECT_MW = 200

LARGEST_SOLAR_PROJECTS_XLSX = LARGEST_WIND_PROJECTS_XLSX
LARGEST_SOLAR_PROJECTS_SHEET = "solprojects"
MIN_SOLAR_PROJECT_MW = 50

SOLAR_PROJECT_PROV_TO_KEY = {
    "AB": "ab",
    "ON": "on",
}

LARGEST_HYDRO_FACILITIES_XLSX = LARGEST_WIND_PROJECTS_XLSX
LARGEST_HYDRO_FACILITIES_SHEET = "hydrofac"
MIN_HYDRO_FAC_MW = 1000
HYDRO_FAC_PROV_TO_KEY = {
    "ONTARIO": "on",
    "QUEBEC": "qc",
    "BRITISH COLUMBIA": "bc",
    "MANITOBA": "man",
    "NEWFOUNDLAND AND LABRADOR": "nl",
}
HYDRO_FAC_PROV_TO_CODE = {
    "on": 1,
    "qc": 2,
    "bc": 3,
    "man": 4,
    "nl": 5,
}

WIND_LOCATION_TO_KEY = {
    "B.C.": "bc",
    "Alta.": "alta",
    "Sask.": "sask",
    "Man.": "man",
    "Ont.": "ont",
    "Que.": "que",
    "N.B.": "nb",
    "N.S.": "ns",
    "P.E.I.": "pei",
    "N.L.": "nl",
    "Y.T.": "yt",
    "N.W.T.": "nwt",
    "Nvt.": "nvt",
}

WIND_CAPACITY_BY_PROV_METADATA = [
    ("bc", "B.C."),
    ("alta", "Alta."),
    ("sask", "Sask."),
    ("man", "Man."),
    ("ont", "Ont."),
    ("que", "Que."),
    ("nb", "N.B."),
    ("ns", "N.S."),
    ("pei", "P.E.I."),
    ("nl", "N.L."),
    ("yt", "Y.T."),
    ("nwt", "N.W.T."),
    ("nvt", "Nvt."),
]

WIND_PROJECT_PROV_TO_KEY = {
    "AB": "ab",
    "QC": "qc",
    "ON": "on",
    "SK": "sk",
}

LARGEST_WIND_PROJECTS_METADATA = [
    ("wind_proj", "Largest wind projects (200 MW+)", "MW", "megawatts", "Natural Resources Canada", ""),
]

RENAQ_XLSX = "RenAQ.xlsx"
SBIO_STATCAN_WOOD_WASTE_TABLE = "25100031"
SBIO_STATCAN_WOOD_WASTE_URL = (
    "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=2510003101"
)
SBIO_WOOD_WASTE_CF = 0.8
SBIO_WOOD_LIQUOR_CF = 0.7
SBIO_RAW_PREFIX = "sbio_raw"

SBIO_METADATA = [
    ("sbio_prod_pulping", "Pulping liquor production", "PJ", "petajoules", "Natural Resources Canada", ""),
    ("sbio_prod_swr", "Solid wood residues production", "PJ", "petajoules", "Natural Resources Canada", ""),
    ("sbio_prod_firewood", "Firewood production", "PJ", "petajoules", "Natural Resources Canada", ""),
    ("sbio_prod_pellets", "Wood pellets production", "PJ", "petajoules", "Natural Resources Canada", ""),
    ("sbio_use_industrial", "Industrial wood fuel use", "PJ", "petajoules", "Natural Resources Canada", SBIO_STATCAN_WOOD_WASTE_URL),
    ("sbio_use_electricity", "Electricity sector wood fuel use", "PJ", "petajoules", "Natural Resources Canada", ""),
    ("sbio_use_residential", "Residential wood fuel use", "PJ", "petajoules", "Natural Resources Canada", ""),
    ("sbio_use_total", "Total wood fuel use", "PJ", "petajoules", "Natural Resources Canada", ""),
]

ELEC_EU_SOURCE_URL = "https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/data_e.html"
ELEC_EU_RAW_PREFIX = "raw_elec_eu"
ELEC_EU_SECTOR_KEYS = ["R", "C", "I", "T", "A"]
ELEC_EU_PROVINCE_KEYS = ["ATL", "BC_TERR", "ALTA", "SASK", "MAN", "ONT", "QUE"]

ELEC_EU_METADATA = [
    ("elec_eu_total", "Total electrical energy use", "PJ", "petajoules", "Natural Resources Canada (OEE)", ELEC_EU_SOURCE_URL),
    ("elec_eu_R", "Electrical energy use - Residential", "PJ", "petajoules", "Natural Resources Canada (OEE)", ELEC_EU_SOURCE_URL),
    ("elec_eu_C", "Electrical energy use - Commercial", "PJ", "petajoules", "Natural Resources Canada (OEE)", ELEC_EU_SOURCE_URL),
    ("elec_eu_I", "Electrical energy use - Industrial", "PJ", "petajoules", "Natural Resources Canada (OEE)", ELEC_EU_SOURCE_URL),
    ("elec_eu_T", "Electrical energy use - Transportation", "PJ", "petajoules", "Natural Resources Canada (OEE)", ELEC_EU_SOURCE_URL),
    ("elec_eu_A", "Electrical energy use - Agriculture", "PJ", "petajoules", "Natural Resources Canada (OEE)", ELEC_EU_SOURCE_URL),
    ("elec_eu_R_pct", "Electrical energy use share - Residential", "Percent", "percent", "Natural Resources Canada (OEE)", ELEC_EU_SOURCE_URL),
    ("elec_eu_C_pct", "Electrical energy use share - Commercial", "Percent", "percent", "Natural Resources Canada (OEE)", ELEC_EU_SOURCE_URL),
    ("elec_eu_I_pct", "Electrical energy use share - Industrial", "Percent", "percent", "Natural Resources Canada (OEE)", ELEC_EU_SOURCE_URL),
    ("elec_eu_T_pct", "Electrical energy use share - Transportation", "Percent", "percent", "Natural Resources Canada (OEE)", ELEC_EU_SOURCE_URL),
    ("elec_eu_A_pct", "Electrical energy use share - Agriculture", "Percent", "percent", "Natural Resources Canada (OEE)", ELEC_EU_SOURCE_URL),
    ("elec_eu_ATL", "Electrical energy use - Atlantic provinces", "PJ", "petajoules", "Natural Resources Canada (OEE)", ELEC_EU_SOURCE_URL),
    ("elec_eu_BC_TERR", "Electrical energy use - B.C. and Territories", "PJ", "petajoules", "Natural Resources Canada (OEE)", ELEC_EU_SOURCE_URL),
    ("elec_eu_ALTA", "Electrical energy use - Alberta", "PJ", "petajoules", "Natural Resources Canada (OEE)", ELEC_EU_SOURCE_URL),
    ("elec_eu_SASK", "Electrical energy use - Saskatchewan", "PJ", "petajoules", "Natural Resources Canada (OEE)", ELEC_EU_SOURCE_URL),
    ("elec_eu_MAN", "Electrical energy use - Manitoba", "PJ", "petajoules", "Natural Resources Canada (OEE)", ELEC_EU_SOURCE_URL),
    ("elec_eu_ONT", "Electrical energy use - Ontario", "PJ", "petajoules", "Natural Resources Canada (OEE)", ELEC_EU_SOURCE_URL),
    ("elec_eu_QUE", "Electrical energy use - Quebec", "PJ", "petajoules", "Natural Resources Canada (OEE)", ELEC_EU_SOURCE_URL),
    ("elec_eu_ATL_pct", "Electrical energy use share - Atlantic provinces", "Percent", "percent", "Natural Resources Canada (OEE)", ELEC_EU_SOURCE_URL),
    ("elec_eu_BC_TERR_pct", "Electrical energy use share - B.C. and Territories", "Percent", "percent", "Natural Resources Canada (OEE)", ELEC_EU_SOURCE_URL),
    ("elec_eu_ALTA_pct", "Electrical energy use share - Alberta", "Percent", "percent", "Natural Resources Canada (OEE)", ELEC_EU_SOURCE_URL),
    ("elec_eu_SASK_pct", "Electrical energy use share - Saskatchewan", "Percent", "percent", "Natural Resources Canada (OEE)", ELEC_EU_SOURCE_URL),
    ("elec_eu_MAN_pct", "Electrical energy use share - Manitoba", "Percent", "percent", "Natural Resources Canada (OEE)", ELEC_EU_SOURCE_URL),
    ("elec_eu_ONT_pct", "Electrical energy use share - Ontario", "Percent", "percent", "Natural Resources Canada (OEE)", ELEC_EU_SOURCE_URL),
    ("elec_eu_QUE_pct", "Electrical energy use share - Quebec", "Percent", "percent", "Natural Resources Canada (OEE)", ELEC_EU_SOURCE_URL),
]
