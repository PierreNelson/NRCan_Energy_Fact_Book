"""
Apply idempotent DDL from setup_database.sql against the connected database.

Used at the start of `python main.py eedas update` so new tables/procedures appear without
a separate manual SQL run. Skips CREATE DATABASE and USE (DB must already exist and
match the connection). Skips the destructive DELETE/INSERT seed block; empty
nrcan_fb_data_sources is seeded once without wiping existing rows.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from db.connection import DatabaseConnection

SETUP_SQL = Path(__file__).resolve().parent / "setup_database.sql"

# Inserted only when nrcan_fb_data_sources has zero rows (keep in sync with setup_database.sql seed).
DEFAULT_DATA_SOURCES_INSERT = """
INSERT INTO nrcan_fb_data_sources (source_key, source_name, section_id, section_name, source_url, is_enabled)
VALUES
('economic_contributions', 'Economic Contributions (GDP, Jobs, Income)', 1, 'Key Indicators', N'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610061001', 1),
('nominal_gdp', 'Nominal GDP Contributions', 1, 'Key Indicators', N'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610010301', 1),
('provincial_gdp', 'Provincial GDP Data', 1, 'Key Indicators', N'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610062401', 1),
('world_energy_production', 'World Energy Production', 1, 'Key Indicators', N'https://www.iea.org/data-and-statistics/data-tools/world-energy-balances', 1),
('canadian_energy_assets', 'Canadian Energy Assets (CEA)', 1, 'Key Indicators', N'https://www.nrcan.gc.ca/energy/energy-sources-distribution/energy-facts/canadian-energy-assets/20064', 1),
('capital_expenditures', 'Capital Expenditures', 2, 'Investment', N'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3410003601', 1),
('infrastructure', 'Infrastructure Stock', 2, 'Investment', N'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610060801', 1),
('investment_by_asset', 'Investment by Asset Type', 2, 'Investment', N'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3410035801', 1),
('international_investment', 'International Investment (FDI/CDIA)', 2, 'Investment', N'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610000901', 1),
('foreign_control', 'Foreign Control', 2, 'Investment', N'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3310057001', 1),
('environmental_protection', 'Environmental Protection Expenditures', 2, 'Investment', N'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3810013001', 1),
('major_projects', 'Major Projects Inventory', 2, 'Investment', N'https://natural-resources.canada.ca/science-data/data-analysis/natural-resources-major-projects-planned-under-construction-2024-2034', 1),
('clean_tech', 'Clean Technology Projects', 2, 'Investment', N'https://natural-resources.canada.ca/science-data/data-analysis/natural-resources-major-projects-planned-under-construction-2024-2034', 1),
('energy_use', 'Energy use (OEE NEUD + Primary Energy Use Demand)', 4, 'Energy Efficiency', N'https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/data_e.html', 1),
('residential_pie_charts', 'Residential pie charts (OEE)', 4, 'Energy Efficiency', N'https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=HB&sector=res&juris=00&rn=1&year=2023&page=1', 1),
('residential_daily_lives', 'Residential daily lives (OEE)', 4, 'Energy Efficiency', N'https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=AN&sector=res&juris=00&rn=11&year=2023&page=1', 1),
('commercial_institutional', 'Commercial / institutional (OEE)', 4, 'Energy Efficiency', N'https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=HB&sector=com&juris=00&rn=1&year=2023&page=1', 1),
('industrial_sector', 'Industrial sector energy use by fuel type (OEE)', 4, 'Energy Efficiency', N'https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=CP&sector=agg&juris=ca&rn=1&page=0', 1),
('seu_by_fuel', 'SEU by fuel (OEE)', 4, 'Energy Efficiency', N'https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=HB&sector=aaa&juris=ca&rn=1&year=2022&page=2', 1),
('ghg_emissions', 'GHG emissions (ECCC)', 1, 'Key Indicators', N'https://www.canada.ca/en/environment-climate-change/services/climate-change/greenhouse-gas-emissions-inventory.html', 1),
('environmental_clean_tech', 'Environmental and clean technology', 5, 'Clean Power and Low Carbon Fuels', N'https://www.statcan.gc.ca/en/topics-start/environmental_and_clean_technology', 1),
('cleantech_companies_geo', 'Cleantech companies by province and region', 5, 'Clean Power and Low Carbon Fuels', N'https://natural-resources.canada.ca/science-innovation/research-development/clean-technology/clean-growth-hub/clean-technology-data-strategy/cleantech-companies', 1),
('cleantech_companies_industry', 'Cleantech companies by industry', 5, 'Clean Power and Low Carbon Fuels', N'https://natural-resources.canada.ca/science-innovation/research-development/clean-technology/clean-growth-hub/clean-technology-data-strategy/cleantech-companies', 1),
('rpp_supply_demand', 'RPP supply and disposition', 6, 'Oil, Natural Gas and Coal', N'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=2510008101', 1),
('rpp_refinery_input', 'Refinery input', 6, 'Oil, Natural Gas and Coal', N'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=2510006301', 1);
"""


def _split_go_batches(sql: str) -> list[str]:
    parts = re.split(r"(?im)^\s*GO\s*$", sql)
    return [p.strip() for p in parts if p.strip()]


def _should_skip_batch(batch: str) -> bool:
    upper = batch.upper()
    # Must connect to an existing database; creating the server database is out of scope here.
    if "CREATE DATABASE" in upper and "SYS.DATABASES" in upper:
        return True
    if re.search(r"\bDELETE\s+FROM\s+nrcan_fb_data_sources\b", batch, re.I):
        return True
    # Standalone USE batch only
    stripped = "\n".join(
        line for line in batch.splitlines()
        if line.strip() and not line.strip().startswith("--")
    ).strip()
    if re.fullmatch(r"USE\s+(\[[^\]]+\]|N?'[^']+'|\w+)\s*;?", stripped, re.I):
        return True
    return False


def ensure_database_schema(db: "DatabaseConnection", verbose: bool = True) -> None:
    """
    Execute setup_database.sql batches (except DB creation, USE, and destructive seed).

    Raises:
        RuntimeError: if setup_database.sql is missing or a batch fails.
    """
    if not SETUP_SQL.is_file():
        raise RuntimeError(f"Schema file not found: {SETUP_SQL}")

    sql_text = SETUP_SQL.read_text(encoding="utf-8")
    batches = _split_go_batches(sql_text)
    to_run = [b for b in batches if not _should_skip_batch(b)]

    if verbose:
        print("\nEnsuring database schema (tables, indexes, procedures as needed)...")

    with db.get_connection() as conn:
        conn.autocommit = True
        cur = conn.cursor()
        for i, batch in enumerate(to_run):
            try:
                cur.execute(batch)
            except Exception as e:
                raise RuntimeError(
                    f"Schema batch {i + 1}/{len(to_run)} failed: {e}\n"
                    f"--- batch preview ---\n{batch[:500]}..."
                ) from e

        cur.execute("SELECT COUNT(*) FROM nrcan_fb_data_sources")
        row = cur.fetchone()
        n = int(row[0]) if row and row[0] is not None else 0
        if n == 0:
            if verbose:
                print("  Seeding default rows in nrcan_fb_data_sources (table was empty).")
            cur.execute(DEFAULT_DATA_SOURCES_INSERT.strip())

    if verbose:
        print("  Schema step complete.\n")
