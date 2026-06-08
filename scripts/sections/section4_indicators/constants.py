"""OEE URLs, default filenames, and residential label helpers for Section 4."""

# OEE NEUD: all sectors use comprehensive ZIPs (direct Excel XLS URLs often 404/500).
OEE_NEUD_ZIP_BASE = "https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/data_e/downloads/comprehensive/zip/2022"
OEE_NEUD_ZIP_URLS = {
    'R': f"{OEE_NEUD_ZIP_BASE}/resca2022e.zip",
    'C': f"{OEE_NEUD_ZIP_BASE}/comca2022e.zip",
    'I': f"{OEE_NEUD_ZIP_BASE}/aggca2022e.zip",
    'T': f"{OEE_NEUD_ZIP_BASE}/tranca2022e.zip",
    'A': f"{OEE_NEUD_ZIP_BASE}/agrca2022e.zip",
}
OEE_RESIDENTIAL_ANALYSIS_XLS = "https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/data_e/downloads/analysis/Excel/2023/res_00_1_e_1.xls"
OEE_RESIDENTIAL_ANALYSIS_PAGES = [
    "https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=AN&sector=res&juris=00&rn=11&year=2023&page=1",
    "https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=AN&sector=res&juris=00&rn=11&year=2023&page=2",
    "https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=AN&sector=res&juris=00&rn=11&year=2023&page=3",
]
OEE_HB_BASE = "https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=HB&sector=res&juris=00&rn=1&year=2023"
OEE_HB_PAGES = [f"{OEE_HB_BASE}&page=1", f"{OEE_HB_BASE}&page=2", f"{OEE_HB_BASE}&page=3"]
OEE_TABLE7_BASE = "https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=CP&sector=res&juris=ca&rn=7&year=2023"
OEE_TABLE7_PAGES = [f"{OEE_TABLE7_BASE}&page=1", f"{OEE_TABLE7_BASE}&page=2"]
OEE_TABLE14_BASE = "https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=CP&sector=res&juris=ca&rn=14&year=2023"
OEE_TABLE14_PAGES = [f"{OEE_TABLE14_BASE}&page=1", f"{OEE_TABLE14_BASE}&page=2"]

OEE_COM_HB_BASE = "https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=HB&sector=com&juris=00&rn=1&year=2023"
OEE_COM_HB_PAGES = [f"{OEE_COM_HB_BASE}&page=1", f"{OEE_COM_HB_BASE}&page=2"]
OEE_COM_AN_BASE = "https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=AN&sector=com&juris=00&rn=11&year=2023"
OEE_COM_AN_PAGES = [f"{OEE_COM_AN_BASE}&page=1", f"{OEE_COM_AN_BASE}&page=2"]
OEE_INDUSTRIAL_CP_URL = "https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=CP&sector=agg&juris=ca&rn=1&page=0"

DEFAULT_PRIMARY_DEMAND_FILENAME = "Primary Energy Use Demand.xlsx"
REQUEST_TIMEOUT = 60


# OEE Residential Analysis (AN) row labels vary by file version; match broadly.
def _residential_label_ter(label: str) -> bool:
    l = (label or "").strip().lower().replace("\n", " ")
    if not l or "efficiency effect" in l:
        return False
    if "space heating" in l or "water heating" in l:
        return False
    if "share" in l or l.startswith("%"):
        return False
    return (
        ("total energy use" in l or "total energy requirements" in l or "total residential energy" in l)
        and ("pj" in l or "terajoule" in l or "(pj)" in l)
    ) or (l.startswith("ter") and "pj" in l)


def _residential_label_eee(label: str) -> bool:
    l = (label or "").strip().lower().replace("\n", " ")
    return (
        "energy efficiency effect" in l
        or "efficiency effect" in l
        or ("efficiency" in l and "effect" in l and "pj" in l)
    )


def _residential_label_space(label: str) -> bool:
    l = (label or "").strip().lower().replace("\n", " ")
    return "space heating" in l and "water" not in l and "share" not in l


def _residential_label_water(label: str) -> bool:
    l = (label or "").strip().lower().replace("\n", " ")
    return "water heating" in l and "share" not in l
