"""One-shot: rewrite setup_database.sql unified ingest + export + seed. Run from db/: python patch_setup_unified.py"""
from __future__ import annotations

import re
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent
SETUP = ROOT / "setup_database.sql"
REG = ROOT / "eedas_registry.yaml"

SOURCE_TABLES = sorted(
    {
        row["source_table"]
        for row in (yaml.safe_load(REG.read_text(encoding="utf-8")) or {}).get("source_tables", {}).values()
        if isinstance(row, dict) and row.get("source_table")
    }
)


def ddl_ingest(name: str) -> str:
    uq = f"UQ_{name}_vd"[:120]
    return f"""IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = '{name}')
BEGIN
    CREATE TABLE [{name}] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [{uq}] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_{name}_vector ON [{name}](vector);
    CREATE INDEX IX_{name}_source ON [{name}](source_key);
    CREATE INDEX IX_{name}_ref_date ON [{name}](ref_date);
    PRINT 'Table {name} created.';
END
GO

"""


_OLD_SPLIT = [
    "iea_web_rankings_data",
    "iea_web_rankings_metadata",
    "nrcan_cea_assets_data",
    "nrcan_cea_assets_metadata",
    "nrcan_cleanenv_semantic_data",
    "nrcan_cleanenv_semantic_metadata",
    "nrcan_cleantech_semantic_data",
    "nrcan_cleantech_semantic_metadata",
    "nrcan_fb_cleanpower_placeholder_data",
    "nrcan_fb_cleanpower_placeholder_metadata",
    "nrcan_fb_oilgas_placeholder_data",
    "nrcan_fb_oilgas_placeholder_metadata",
    "nrcan_fb_skills_placeholder_data",
    "nrcan_fb_skills_placeholder_metadata",
    "nrcan_ghg_semantic_data",
    "nrcan_ghg_semantic_metadata",
    "nrcan_majorproj_semantic_data",
    "nrcan_majorproj_semantic_metadata",
    "nrcan_oee_commercial_data",
    "nrcan_oee_commercial_metadata",
    "nrcan_oee_neud_data",
    "nrcan_oee_neud_metadata",
    "nrcan_oee_res_daily_data",
    "nrcan_oee_res_daily_metadata",
    "nrcan_oee_res_pie_data",
    "nrcan_oee_res_pie_metadata",
    "nrcan_oee_seu_data",
    "nrcan_oee_seu_metadata",
    "stc_capex_3410003601_data",
    "stc_capex_3410003601_metadata",
    "stc_epes_3810013001_data",
    "stc_epes_3810013001_metadata",
    "stc_fdi_3610000901_data",
    "stc_fdi_3610000901_metadata",
    "stc_foreignctrl_misc_data",
    "stc_foreignctrl_misc_metadata",
    "stc_gdpnom_3610010301_data",
    "stc_gdpnom_3610010301_metadata",
    "stc_infra_3610060801_data",
    "stc_infra_3610060801_metadata",
    "stc_invasset_3410003601_data",
    "stc_invasset_3410003601_metadata",
    "stc_nrsa_3610061001_data",
    "stc_nrsa_3610061001_metadata",
    "stc_nrsa_3810028501_data",
    "stc_nrsa_3810028501_metadata",
]

LEGACY_DROPS = """
-- Upgrade: see setup_database.sql (statcan_table_id removal; source_url required for gallery)
IF COL_LENGTH('dbo.nrcan_fb_data_sources', 'statcan_table_id') IS NOT NULL
    ALTER TABLE dbo.nrcan_fb_data_sources DROP COLUMN statcan_table_id;
GO

-- Drop legacy calc_* tables (replaced by nrcan_fb_s* section-scoped tables)
IF OBJECT_ID('dbo.calc_capital_expenditures', 'U') IS NOT NULL DROP TABLE dbo.calc_capital_expenditures;
IF OBJECT_ID('dbo.calc_clean_tech', 'U') IS NOT NULL DROP TABLE dbo.calc_clean_tech;
IF OBJECT_ID('dbo.calc_economic_contributions', 'U') IS NOT NULL DROP TABLE dbo.calc_economic_contributions;
IF OBJECT_ID('dbo.calc_energy_use', 'U') IS NOT NULL DROP TABLE dbo.calc_energy_use;
IF OBJECT_ID('dbo.calc_environmental_protection', 'U') IS NOT NULL DROP TABLE dbo.calc_environmental_protection;
IF OBJECT_ID('dbo.calc_infrastructure', 'U') IS NOT NULL DROP TABLE dbo.calc_infrastructure;
IF OBJECT_ID('dbo.calc_international_investment', 'U') IS NOT NULL DROP TABLE dbo.calc_international_investment;
IF OBJECT_ID('dbo.calc_provincial_gdp', 'U') IS NOT NULL DROP TABLE dbo.calc_provincial_gdp;
IF OBJECT_ID('dbo.calc_world_energy_production', 'U') IS NOT NULL DROP TABLE dbo.calc_world_energy_production;
-- Legacy monolithic ingest names
IF OBJECT_ID('dbo.raw_statcan_metadata', 'U') IS NOT NULL DROP TABLE dbo.raw_statcan_metadata;
IF OBJECT_ID('dbo.raw_statcan_data', 'U') IS NOT NULL DROP TABLE dbo.raw_statcan_data;
-- Old split export staging
IF OBJECT_ID('dbo.nrcan_fb_export_metadata', 'U') IS NOT NULL DROP TABLE dbo.nrcan_fb_export_metadata;
IF OBJECT_ID('dbo.nrcan_fb_export_data', 'U') IS NOT NULL DROP TABLE dbo.nrcan_fb_export_data;
GO

""".lstrip()

LEGACY_DROPS += (
    "-- Drop former per-source _data / _metadata pairs\n"
    + "\n".join(
        f"IF OBJECT_ID('dbo.{name}', 'U') IS NOT NULL DROP TABLE dbo.{name};" for name in _OLD_SPLIT
    )
    + "\nGO\n\n"
)

UNIFIED_HEADER = """-- ============================================================================
-- UNIFIED INGEST TABLES (single table per source; see eedas_registry.yaml)
-- ============================================================================

"""

EXPORT_BLOCK = """-- ============================================================================
-- EXPORT STAGING (wide table: replaces nrcan_fb_export_data + _metadata)
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_fb_export')
BEGIN
    CREATE TABLE nrcan_fb_export (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(100) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value NVARCHAR(100) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL
    );
    CREATE INDEX IX_nrcan_fb_export_vector ON nrcan_fb_export(vector);
    CREATE INDEX IX_nrcan_fb_export_ref_date ON nrcan_fb_export(ref_date);
    PRINT 'Table nrcan_fb_export created.';
END
GO

"""

SEED_BLOCK = """DELETE FROM nrcan_fb_data_sources;

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
('cleantech_companies_industry', 'Cleantech companies by industry', 5, 'Clean Power and Low Carbon Fuels', N'https://natural-resources.canada.ca/science-innovation/research-development/clean-technology/clean-growth-hub/clean-technology-data-strategy/cleantech-companies', 1);

PRINT 'Default data sources inserted.';
GO
"""


def main() -> None:
    text = SETUP.read_text(encoding="utf-8")

    text = re.sub(
        r"statcan_table_id NVARCHAR\(50\) NULL,\s*\n\s*source_url NVARCHAR\(1000\) NULL,\s*\n",
        "",
        text,
        count=1,
    )

    start = text.index("-- ============================================================================\n-- RAW / SEMANTIC INGEST TABLES")
    end = text.index("-- ============================================================================\n-- CONSOLIDATED EXPORT TABLES")

    middle = UNIFIED_HEADER + LEGACY_DROPS + "".join(ddl_ingest(n) for n in SOURCE_TABLES)
    text = text[:start] + middle + text[end:]

    exp_start = text.index("-- ============================================================================\n-- CONSOLIDATED EXPORT TABLES")
    exp_end = text.index("-- Remove obsolete legacy tables", exp_start)

    text = text[:exp_start] + EXPORT_BLOCK + text[exp_end:]

    seed_mark = "-- ============================================================================\n-- INSERT DEFAULT DATA SOURCES"
    si = text.index(seed_mark)
    go_after_seed = text.index("GO\n\n-- ============================================================================\n-- UTILITY STORED PROCEDURES", si)

    pre = text[: si + len(seed_mark)]
    rest = text[go_after_seed:]
    mid = """

-- ============================================================================
-- INSERT DEFAULT DATA SOURCES
-- ============================================================================
-- Refresh skips destructive re-seed; see scripts/db/ensure_schema.py

"""
    text = pre + mid + SEED_BLOCK + "\n" + rest

    SETUP.write_text(text, encoding="utf-8")
    print(f"Patched {SETUP} with {len(SOURCE_TABLES)} per-source tables.")


if __name__ == "__main__":
    main()
