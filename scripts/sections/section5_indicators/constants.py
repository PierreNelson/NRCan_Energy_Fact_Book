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
