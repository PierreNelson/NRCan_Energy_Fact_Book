"""Constants for Section 5: Clean power and low carbon fuels."""

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
