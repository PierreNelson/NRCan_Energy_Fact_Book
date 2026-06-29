-- ============================================================================
-- NRCan Energy Factbook Database Setup Script
--
-- This script creates the database and all required tables for the
-- Energy Factbook data pipeline.
--
-- EEDAS-style physical names: per-source series tables are listed in
-- eedas_registry.yaml. When adding a source, update that file and the matching
-- CREATE TABLE blocks in this script (see scripts/db/eedas_registry.py).
--
-- Usage:
--   1. Preferred: create an empty database matching config, then run
--      `python main.py eedas update ...` — ensure_schema applies this script's
--      DDL (except CREATE DATABASE / destructive seed) automatically.
--   2. Or connect as an admin and run this script in SSMS/sqlcmd for a full
--      install including CREATE DATABASE and default data-source rows.
--
-- Requirements:
--   - SQL Server 2019+ or SQL Server Developer Edition
--   - Sufficient permissions to create databases
-- ============================================================================

-- Create the database if it doesn't exist
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'NRCanEnergyFactbook')
BEGIN
    CREATE DATABASE NRCanEnergyFactbook;
    PRINT 'Database NRCanEnergyFactbook created.';
END
ELSE
BEGIN
    PRINT 'Database NRCanEnergyFactbook already exists.';
END
GO

USE NRCanEnergyFactbook;
GO

-- ============================================================================
-- CONFIGURATION TABLES
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_fb_data_sources')
BEGIN
    CREATE TABLE nrcan_fb_data_sources (
        source_id INT IDENTITY(1,1) PRIMARY KEY,
        source_key NVARCHAR(100) NOT NULL UNIQUE,
        source_name NVARCHAR(255) NOT NULL,
        section_id INT NOT NULL,
        section_name NVARCHAR(100) NOT NULL,
        source_url NVARCHAR(1000) NOT NULL,
        is_enabled BIT NOT NULL DEFAULT 1,
        last_refresh_at DATETIME2 NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );

    CREATE INDEX IX_nrcan_fb_data_sources_section ON nrcan_fb_data_sources(section_id);
    CREATE INDEX IX_nrcan_fb_data_sources_enabled ON nrcan_fb_data_sources(is_enabled);

    PRINT 'Table nrcan_fb_data_sources created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_fb_run_history')
BEGIN
    CREATE TABLE nrcan_fb_run_history (
        run_id INT IDENTITY(1,1) PRIMARY KEY,
        source_key NVARCHAR(100) NOT NULL,
        run_type NVARCHAR(50) NOT NULL,
        status NVARCHAR(20) NOT NULL,
        rows_affected INT NULL,
        error_message NVARCHAR(MAX) NULL,
        started_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        completed_at DATETIME2 NULL,
        duration_seconds AS DATEDIFF(SECOND, started_at, completed_at)
    );

    CREATE INDEX IX_nrcan_fb_run_history_source ON nrcan_fb_run_history(source_key);
    CREATE INDEX IX_nrcan_fb_run_history_started ON nrcan_fb_run_history(started_at DESC);

    PRINT 'Table nrcan_fb_run_history created.';
END
GO

-- ============================================================================
-- PER-SOURCE SERIES TABLES (single table per source; see eedas_registry.yaml)
-- ============================================================================

-- Upgrade: drop StatCan-only column; add source_url (separate batch from UPDATE — SQL Server
-- compiles the whole batch before running DDL, so UPDATE cannot see a column added earlier in the same batch).

IF COL_LENGTH('dbo.nrcan_fb_data_sources', 'statcan_table_id') IS NOT NULL
    ALTER TABLE dbo.nrcan_fb_data_sources DROP COLUMN statcan_table_id;
IF COL_LENGTH('dbo.nrcan_fb_data_sources', 'source_url') IS NULL
    ALTER TABLE dbo.nrcan_fb_data_sources ADD source_url NVARCHAR(1000) NULL;
GO

UPDATE dbo.nrcan_fb_data_sources SET source_url = CASE source_key
    WHEN N'economic_contributions' THEN N'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610061001'
    WHEN N'nominal_gdp' THEN N'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610010301'
    WHEN N'provincial_gdp' THEN N'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610062401'
    WHEN N'world_energy_production' THEN N'https://www.iea.org/data-and-statistics/data-tools/world-energy-balances'
    WHEN N'canadian_energy_assets' THEN N'https://www.nrcan.gc.ca/energy/energy-sources-distribution/energy-facts/canadian-energy-assets/20064'
    WHEN N'capital_expenditures' THEN N'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3410003601'
    WHEN N'infrastructure' THEN N'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610060801'
    WHEN N'investment_by_asset' THEN N'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3410035801'
    WHEN N'international_investment' THEN N'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610000901'
    WHEN N'foreign_control' THEN N'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3310057001'
    WHEN N'environmental_protection' THEN N'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3810013001'
    WHEN N'major_projects' THEN N'https://natural-resources.canada.ca/science-data/data-analysis/natural-resources-major-projects-planned-under-construction-2024-2034'
    WHEN N'clean_tech' THEN N'https://natural-resources.canada.ca/science-data/data-analysis/natural-resources-major-projects-planned-under-construction-2024-2034'
    WHEN N'energy_use' THEN N'https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/data_e.html'
    WHEN N'residential_pie_charts' THEN N'https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=HB&sector=res&juris=00&rn=1&year=2023&page=1'
    WHEN N'residential_daily_lives' THEN N'https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=AN&sector=res&juris=00&rn=11&year=2023&page=1'
    WHEN N'commercial_institutional' THEN N'https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=HB&sector=com&juris=00&rn=1&year=2023&page=1'
    WHEN N'industrial_sector' THEN N'https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=CP&sector=agg&juris=ca&rn=1&page=0'
    WHEN N'seu_by_fuel' THEN N'https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=HB&sector=aaa&juris=ca&rn=1&year=2022&page=2'
    WHEN N'ghg_emissions' THEN N'https://www.canada.ca/en/environment-climate-change/services/climate-change/greenhouse-gas-emissions-inventory.html'
    WHEN N'environmental_clean_tech' THEN N'https://www.statcan.gc.ca/en/topics-start/environmental_and_clean_technology'
    WHEN N'cleantech_companies_geo' THEN N'https://natural-resources.canada.ca/science-innovation/research-development/clean-technology/clean-growth-hub/clean-technology-data-strategy/cleantech-companies'
    WHEN N'cleantech_companies_industry' THEN N'https://natural-resources.canada.ca/science-innovation/research-development/clean-technology/clean-growth-hub/clean-technology-data-strategy/cleantech-companies'
    ELSE N'https://www.nrcan.gc.ca/energy'
END
WHERE source_url IS NULL OR RTRIM(ISNULL(source_url, N'')) = N'';
UPDATE dbo.nrcan_fb_data_sources SET source_url = N'https://www.nrcan.gc.ca/energy'
WHERE source_url IS NULL OR RTRIM(ISNULL(source_url, N'')) = N'';
IF EXISTS (
    SELECT 1 FROM sys.columns c
    WHERE c.object_id = OBJECT_ID('dbo.nrcan_fb_data_sources') AND c.name = N'source_url' AND c.is_nullable = 1
)
    ALTER TABLE dbo.nrcan_fb_data_sources ALTER COLUMN source_url NVARCHAR(1000) NOT NULL;
GO

-- Legacy registry name (some installs): DDL only, then populate in the following batch
IF OBJECT_ID('dbo.data_sources', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.data_sources', 'statcan_table_id') IS NOT NULL
        ALTER TABLE dbo.data_sources DROP COLUMN statcan_table_id;
    IF COL_LENGTH('dbo.data_sources', 'source_url') IS NULL
        ALTER TABLE dbo.data_sources ADD source_url NVARCHAR(1000) NULL;
END
GO

IF OBJECT_ID('dbo.data_sources', 'U') IS NOT NULL
BEGIN
    UPDATE dbo.data_sources SET source_url = CASE source_key
        WHEN N'economic_contributions' THEN N'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610061001'
        WHEN N'nominal_gdp' THEN N'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610010301'
        WHEN N'provincial_gdp' THEN N'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610062401'
        WHEN N'world_energy_production' THEN N'https://www.iea.org/data-and-statistics/data-tools/world-energy-balances'
        WHEN N'canadian_energy_assets' THEN N'https://www.nrcan.gc.ca/energy/energy-sources-distribution/energy-facts/canadian-energy-assets/20064'
        WHEN N'capital_expenditures' THEN N'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3410003601'
        WHEN N'infrastructure' THEN N'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610060801'
        WHEN N'investment_by_asset' THEN N'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3410035801'
        WHEN N'international_investment' THEN N'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610000901'
        WHEN N'foreign_control' THEN N'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3310057001'
        WHEN N'environmental_protection' THEN N'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3810013001'
        WHEN N'major_projects' THEN N'https://natural-resources.canada.ca/science-data/data-analysis/natural-resources-major-projects-planned-under-construction-2024-2034'
        WHEN N'clean_tech' THEN N'https://natural-resources.canada.ca/science-data/data-analysis/natural-resources-major-projects-planned-under-construction-2024-2034'
        WHEN N'energy_use' THEN N'https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/data_e.html'
        WHEN N'residential_pie_charts' THEN N'https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=HB&sector=res&juris=00&rn=1&year=2023&page=1'
        WHEN N'residential_daily_lives' THEN N'https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=AN&sector=res&juris=00&rn=11&year=2023&page=1'
        WHEN N'commercial_institutional' THEN N'https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=HB&sector=com&juris=00&rn=1&year=2023&page=1'
        WHEN N'industrial_sector' THEN N'https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=CP&sector=agg&juris=ca&rn=1&page=0'
        WHEN N'seu_by_fuel' THEN N'https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=HB&sector=aaa&juris=ca&rn=1&year=2022&page=2'
        WHEN N'ghg_emissions' THEN N'https://www.canada.ca/en/environment-climate-change/services/climate-change/greenhouse-gas-emissions-inventory.html'
        WHEN N'environmental_clean_tech' THEN N'https://www.statcan.gc.ca/en/topics-start/environmental_and_clean_technology'
        WHEN N'cleantech_companies_geo' THEN N'https://natural-resources.canada.ca/science-innovation/research-development/clean-technology/clean-growth-hub/clean-technology-data-strategy/cleantech-companies'
        WHEN N'cleantech_companies_industry' THEN N'https://natural-resources.canada.ca/science-innovation/research-development/clean-technology/clean-growth-hub/clean-technology-data-strategy/cleantech-companies'
        ELSE N'https://www.nrcan.gc.ca/energy'
    END
    WHERE source_url IS NULL OR RTRIM(ISNULL(source_url, N'')) = N'';
    UPDATE dbo.data_sources SET source_url = N'https://www.nrcan.gc.ca/energy'
    WHERE source_url IS NULL OR RTRIM(ISNULL(source_url, N'')) = N'';
    IF EXISTS (
        SELECT 1 FROM sys.columns c
        WHERE c.object_id = OBJECT_ID('dbo.data_sources') AND c.name = N'source_url' AND c.is_nullable = 1
    )
        ALTER TABLE dbo.data_sources ALTER COLUMN source_url NVARCHAR(1000) NOT NULL;
END
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
-- Legacy monolithic raw_statcan names
IF OBJECT_ID('dbo.raw_statcan_metadata', 'U') IS NOT NULL DROP TABLE dbo.raw_statcan_metadata;
IF OBJECT_ID('dbo.raw_statcan_data', 'U') IS NOT NULL DROP TABLE dbo.raw_statcan_data;
-- Old split export staging
IF OBJECT_ID('dbo.nrcan_fb_export_metadata', 'U') IS NOT NULL DROP TABLE dbo.nrcan_fb_export_metadata;
IF OBJECT_ID('dbo.nrcan_fb_export_data', 'U') IS NOT NULL DROP TABLE dbo.nrcan_fb_export_data;
GO

-- Drop former per-source _data / _metadata pairs
IF OBJECT_ID('dbo.iea_web_rankings_data', 'U') IS NOT NULL DROP TABLE dbo.iea_web_rankings_data;
IF OBJECT_ID('dbo.iea_web_rankings_metadata', 'U') IS NOT NULL DROP TABLE dbo.iea_web_rankings_metadata;
IF OBJECT_ID('dbo.nrcan_cea_assets_data', 'U') IS NOT NULL DROP TABLE dbo.nrcan_cea_assets_data;
IF OBJECT_ID('dbo.nrcan_cea_assets_metadata', 'U') IS NOT NULL DROP TABLE dbo.nrcan_cea_assets_metadata;
IF OBJECT_ID('dbo.nrcan_cleanenv_semantic_data', 'U') IS NOT NULL DROP TABLE dbo.nrcan_cleanenv_semantic_data;
IF OBJECT_ID('dbo.nrcan_cleanenv_semantic_metadata', 'U') IS NOT NULL DROP TABLE dbo.nrcan_cleanenv_semantic_metadata;
IF OBJECT_ID('dbo.nrcan_cleantech_semantic_data', 'U') IS NOT NULL DROP TABLE dbo.nrcan_cleantech_semantic_data;
IF OBJECT_ID('dbo.nrcan_cleantech_semantic_metadata', 'U') IS NOT NULL DROP TABLE dbo.nrcan_cleantech_semantic_metadata;
IF OBJECT_ID('dbo.nrcan_fb_cleanpower_placeholder_data', 'U') IS NOT NULL DROP TABLE dbo.nrcan_fb_cleanpower_placeholder_data;
IF OBJECT_ID('dbo.nrcan_fb_cleanpower_placeholder_metadata', 'U') IS NOT NULL DROP TABLE dbo.nrcan_fb_cleanpower_placeholder_metadata;
IF OBJECT_ID('dbo.nrcan_fb_oilgas_placeholder_data', 'U') IS NOT NULL DROP TABLE dbo.nrcan_fb_oilgas_placeholder_data;
IF OBJECT_ID('dbo.nrcan_fb_oilgas_placeholder_metadata', 'U') IS NOT NULL DROP TABLE dbo.nrcan_fb_oilgas_placeholder_metadata;
IF OBJECT_ID('dbo.nrcan_fb_skills_placeholder_data', 'U') IS NOT NULL DROP TABLE dbo.nrcan_fb_skills_placeholder_data;
IF OBJECT_ID('dbo.nrcan_fb_skills_placeholder_metadata', 'U') IS NOT NULL DROP TABLE dbo.nrcan_fb_skills_placeholder_metadata;
IF OBJECT_ID('dbo.nrcan_ghg_semantic_data', 'U') IS NOT NULL DROP TABLE dbo.nrcan_ghg_semantic_data;
IF OBJECT_ID('dbo.nrcan_ghg_semantic_metadata', 'U') IS NOT NULL DROP TABLE dbo.nrcan_ghg_semantic_metadata;
IF OBJECT_ID('dbo.nrcan_majorproj_semantic_data', 'U') IS NOT NULL DROP TABLE dbo.nrcan_majorproj_semantic_data;
IF OBJECT_ID('dbo.nrcan_majorproj_semantic_metadata', 'U') IS NOT NULL DROP TABLE dbo.nrcan_majorproj_semantic_metadata;
IF OBJECT_ID('dbo.nrcan_oee_commercial_data', 'U') IS NOT NULL DROP TABLE dbo.nrcan_oee_commercial_data;
IF OBJECT_ID('dbo.nrcan_oee_commercial_metadata', 'U') IS NOT NULL DROP TABLE dbo.nrcan_oee_commercial_metadata;
IF OBJECT_ID('dbo.nrcan_oee_industrial_data', 'U') IS NOT NULL DROP TABLE dbo.nrcan_oee_industrial_data;
IF OBJECT_ID('dbo.nrcan_oee_industrial_metadata', 'U') IS NOT NULL DROP TABLE dbo.nrcan_oee_industrial_metadata;
IF OBJECT_ID('dbo.nrcan_oee_neud_data', 'U') IS NOT NULL DROP TABLE dbo.nrcan_oee_neud_data;
IF OBJECT_ID('dbo.nrcan_oee_neud_metadata', 'U') IS NOT NULL DROP TABLE dbo.nrcan_oee_neud_metadata;
IF OBJECT_ID('dbo.nrcan_oee_res_daily_data', 'U') IS NOT NULL DROP TABLE dbo.nrcan_oee_res_daily_data;
IF OBJECT_ID('dbo.nrcan_oee_res_daily_metadata', 'U') IS NOT NULL DROP TABLE dbo.nrcan_oee_res_daily_metadata;
IF OBJECT_ID('dbo.nrcan_oee_res_pie_data', 'U') IS NOT NULL DROP TABLE dbo.nrcan_oee_res_pie_data;
IF OBJECT_ID('dbo.nrcan_oee_res_pie_metadata', 'U') IS NOT NULL DROP TABLE dbo.nrcan_oee_res_pie_metadata;
IF OBJECT_ID('dbo.nrcan_oee_seu_data', 'U') IS NOT NULL DROP TABLE dbo.nrcan_oee_seu_data;
IF OBJECT_ID('dbo.nrcan_oee_seu_metadata', 'U') IS NOT NULL DROP TABLE dbo.nrcan_oee_seu_metadata;
IF OBJECT_ID('dbo.stc_capex_3410003601_data', 'U') IS NOT NULL DROP TABLE dbo.stc_capex_3410003601_data;
IF OBJECT_ID('dbo.stc_capex_3410003601_metadata', 'U') IS NOT NULL DROP TABLE dbo.stc_capex_3410003601_metadata;
IF OBJECT_ID('dbo.stc_epes_3810013001_data', 'U') IS NOT NULL DROP TABLE dbo.stc_epes_3810013001_data;
IF OBJECT_ID('dbo.stc_epes_3810013001_metadata', 'U') IS NOT NULL DROP TABLE dbo.stc_epes_3810013001_metadata;
IF OBJECT_ID('dbo.stc_fdi_3610000901_data', 'U') IS NOT NULL DROP TABLE dbo.stc_fdi_3610000901_data;
IF OBJECT_ID('dbo.stc_fdi_3610000901_metadata', 'U') IS NOT NULL DROP TABLE dbo.stc_fdi_3610000901_metadata;
IF OBJECT_ID('dbo.stc_foreignctrl_misc_data', 'U') IS NOT NULL DROP TABLE dbo.stc_foreignctrl_misc_data;
IF OBJECT_ID('dbo.stc_foreignctrl_misc_metadata', 'U') IS NOT NULL DROP TABLE dbo.stc_foreignctrl_misc_metadata;
IF OBJECT_ID('dbo.stc_gdpnom_3610010301_data', 'U') IS NOT NULL DROP TABLE dbo.stc_gdpnom_3610010301_data;
IF OBJECT_ID('dbo.stc_gdpnom_3610010301_metadata', 'U') IS NOT NULL DROP TABLE dbo.stc_gdpnom_3610010301_metadata;
IF OBJECT_ID('dbo.stc_infra_3610060801_data', 'U') IS NOT NULL DROP TABLE dbo.stc_infra_3610060801_data;
IF OBJECT_ID('dbo.stc_infra_3610060801_metadata', 'U') IS NOT NULL DROP TABLE dbo.stc_infra_3610060801_metadata;
IF OBJECT_ID('dbo.stc_invasset_3410003601_data', 'U') IS NOT NULL DROP TABLE dbo.stc_invasset_3410003601_data;
IF OBJECT_ID('dbo.stc_invasset_3410003601_metadata', 'U') IS NOT NULL DROP TABLE dbo.stc_invasset_3410003601_metadata;
IF OBJECT_ID('dbo.stc_nrsa_3610061001_data', 'U') IS NOT NULL DROP TABLE dbo.stc_nrsa_3610061001_data;
IF OBJECT_ID('dbo.stc_nrsa_3610061001_metadata', 'U') IS NOT NULL DROP TABLE dbo.stc_nrsa_3610061001_metadata;
IF OBJECT_ID('dbo.stc_nrsa_3810028501_data', 'U') IS NOT NULL DROP TABLE dbo.stc_nrsa_3810028501_data;
IF OBJECT_ID('dbo.stc_nrsa_3810028501_metadata', 'U') IS NOT NULL DROP TABLE dbo.stc_nrsa_3810028501_metadata;
-- Prior schema: physical tables used a *_ingest suffix (removed; see eedas_registry.yaml)
IF OBJECT_ID('dbo.iea_web_rankings_ingest', 'U') IS NOT NULL DROP TABLE dbo.iea_web_rankings_ingest;
IF OBJECT_ID('dbo.nrcan_cea_assets_ingest', 'U') IS NOT NULL DROP TABLE dbo.nrcan_cea_assets_ingest;
IF OBJECT_ID('dbo.nrcan_cleanenv_semantic_ingest', 'U') IS NOT NULL DROP TABLE dbo.nrcan_cleanenv_semantic_ingest;
IF OBJECT_ID('dbo.nrcan_cleanev_semantic_ingest', 'U') IS NOT NULL DROP TABLE dbo.nrcan_cleanev_semantic_ingest;
IF OBJECT_ID('dbo.nrcan_cleantech_semantic_ingest', 'U') IS NOT NULL DROP TABLE dbo.nrcan_cleantech_semantic_ingest;
IF OBJECT_ID('dbo.nrcan_ghg_semantic_ingest', 'U') IS NOT NULL DROP TABLE dbo.nrcan_ghg_semantic_ingest;
IF OBJECT_ID('dbo.nrcan_majorproj_semantic_ingest', 'U') IS NOT NULL DROP TABLE dbo.nrcan_majorproj_semantic_ingest;
IF OBJECT_ID('dbo.nrcan_oee_commercial_ingest', 'U') IS NOT NULL DROP TABLE dbo.nrcan_oee_commercial_ingest;
IF OBJECT_ID('dbo.nrcan_oee_industrial_ingest', 'U') IS NOT NULL DROP TABLE dbo.nrcan_oee_industrial_ingest;
IF OBJECT_ID('dbo.nrcan_oee_neud_ingest', 'U') IS NOT NULL DROP TABLE dbo.nrcan_oee_neud_ingest;
IF OBJECT_ID('dbo.nrcan_oee_res_daily_ingest', 'U') IS NOT NULL DROP TABLE dbo.nrcan_oee_res_daily_ingest;
IF OBJECT_ID('dbo.nrcan_oee_res_pie_ingest', 'U') IS NOT NULL DROP TABLE dbo.nrcan_oee_res_pie_ingest;
IF OBJECT_ID('dbo.nrcan_oee_seu_ingest', 'U') IS NOT NULL DROP TABLE dbo.nrcan_oee_seu_ingest;
IF OBJECT_ID('dbo.stc_capex_3410003601_ingest', 'U') IS NOT NULL DROP TABLE dbo.stc_capex_3410003601_ingest;
IF OBJECT_ID('dbo.stc_epes_3810013001_ingest', 'U') IS NOT NULL DROP TABLE dbo.stc_epes_3810013001_ingest;
IF OBJECT_ID('dbo.stc_fdi_3610000901_ingest', 'U') IS NOT NULL DROP TABLE dbo.stc_fdi_3610000901_ingest;
IF OBJECT_ID('dbo.stc_foreignctrl_misc_ingest', 'U') IS NOT NULL DROP TABLE dbo.stc_foreignctrl_misc_ingest;
IF OBJECT_ID('dbo.stc_gdpnom_3610010301_ingest', 'U') IS NOT NULL DROP TABLE dbo.stc_gdpnom_3610010301_ingest;
IF OBJECT_ID('dbo.stc_infra_3610060801_ingest', 'U') IS NOT NULL DROP TABLE dbo.stc_infra_3610060801_ingest;
IF OBJECT_ID('dbo.stc_invasset_3410003601_ingest', 'U') IS NOT NULL DROP TABLE dbo.stc_invasset_3410003601_ingest;
IF OBJECT_ID('dbo.stc_nrsa_3610061001_ingest', 'U') IS NOT NULL DROP TABLE dbo.stc_nrsa_3610061001_ingest;
IF OBJECT_ID('dbo.stc_nrsa_3810028501_ingest', 'U') IS NOT NULL DROP TABLE dbo.stc_nrsa_3810028501_ingest;
GO

-- Widen vector column on existing EEDAS tables (publisher-native keys can exceed 50 chars)
DECLARE @widen_sql NVARCHAR(MAX) = N'';
SELECT @widen_sql = @widen_sql + N'
IF COL_LENGTH(''dbo.' + REPLACE(name, '''', '''''') + ''', ''vector'') IS NOT NULL
   AND COL_LENGTH(''dbo.' + REPLACE(name, '''', '''''') + ''', ''vector'') <= 100
    ALTER TABLE dbo.[' + REPLACE(name, ']', ']]') + N'] ALTER COLUMN vector NVARCHAR(300) NOT NULL;'
FROM sys.tables
WHERE schema_id = SCHEMA_ID('dbo')
  AND name IN (
    'iea_web_rankings','nrcan_cea_assets','nrcan_cleanenv_semantic','nrcan_cleantech_semantic',
    'nrcan_majorproj_semantic','nrcan_spi_cleantech_geo','nrcan_spi_cleantech_industry',
    'nrcan_oee_neud','nrcan_oee_res_pie','nrcan_oee_res_daily','nrcan_oee_commercial',
    'nrcan_oee_industrial','nrcan_oee_seu','nrcan_ghg_semantic','stc_capex_3410003601',
    'stc_invasset_3410003601','stc_infra_3610060801','stc_fdi_3610000901','stc_foreignctrl_misc',
    'stc_epes_3810013001','stc_nrsa_3610061001','stc_nrsa_3810028501','stc_gdpnom_3610010301',
    'stc_rppsd_25100081','stc_refinput_25100063','nrcan_crude_prices','stc_oil_sands',
    'stc_ev_sales','stc_canadian_production','kal_gas_prices','osm_refin_cap',
    'ca_petroleum_reserves_summary','ca_western_canada_oil_wells_count_depth',
    'cer_electricity_trade_summary','nrcan_windcapbyprov','can_largestwindprojects',
    'can_largestsolprojects','can_largesthydrofac','nrcan_solid_biofuels','nrcan_renelecap','nrcan_elegen_can','nrcan_windpwr_can','nrcan_worldwind','nrcan_worldsolar','nrcan_electrical_energy_use','nrcan_hydroq_prices','nrcan_wselec_growth','wna_uraniumprod','ecc_ghg_electricity'
  );
IF LEN(@widen_sql) > 0 EXEC sp_executesql @widen_sql;
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'iea_web_rankings')
BEGIN
    CREATE TABLE [iea_web_rankings] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_iea_web_rankings_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_iea_web_rankings_vector ON [iea_web_rankings](vector);
    CREATE INDEX IX_iea_web_rankings_source ON [iea_web_rankings](source_key);
    CREATE INDEX IX_iea_web_rankings_ref_date ON [iea_web_rankings](ref_date);
    PRINT 'Table iea_web_rankings created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_cea_assets')
BEGIN
    CREATE TABLE [nrcan_cea_assets] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_nrcan_cea_assets_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_cea_assets_vector ON [nrcan_cea_assets](vector);
    CREATE INDEX IX_nrcan_cea_assets_source ON [nrcan_cea_assets](source_key);
    CREATE INDEX IX_nrcan_cea_assets_ref_date ON [nrcan_cea_assets](ref_date);
    PRINT 'Table nrcan_cea_assets created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_cleanenv_semantic')
BEGIN
    CREATE TABLE [nrcan_cleanenv_semantic] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_nrcan_cleanenv_semantic_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_cleanenv_semantic_vector ON [nrcan_cleanenv_semantic](vector);
    CREATE INDEX IX_nrcan_cleanenv_semantic_source ON [nrcan_cleanenv_semantic](source_key);
    CREATE INDEX IX_nrcan_cleanenv_semantic_ref_date ON [nrcan_cleanenv_semantic](ref_date);
    PRINT 'Table nrcan_cleanenv_semantic created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_spi_cleantech_geo')
BEGIN
    CREATE TABLE [nrcan_spi_cleantech_geo] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_nrcan_spi_cleantech_geo_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_spi_cleantech_geo_vector ON [nrcan_spi_cleantech_geo](vector);
    CREATE INDEX IX_nrcan_spi_cleantech_geo_source ON [nrcan_spi_cleantech_geo](source_key);
    CREATE INDEX IX_nrcan_spi_cleantech_geo_ref_date ON [nrcan_spi_cleantech_geo](ref_date);
    PRINT 'Table nrcan_spi_cleantech_geo created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_spi_cleantech_industry')
BEGIN
    CREATE TABLE [nrcan_spi_cleantech_industry] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_nrcan_spi_cleantech_industry_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_spi_cleantech_industry_vector ON [nrcan_spi_cleantech_industry](vector);
    CREATE INDEX IX_nrcan_spi_cleantech_industry_source ON [nrcan_spi_cleantech_industry](source_key);
    CREATE INDEX IX_nrcan_spi_cleantech_industry_ref_date ON [nrcan_spi_cleantech_industry](ref_date);
    PRINT 'Table nrcan_spi_cleantech_industry created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_cleantech_semantic')
BEGIN
    CREATE TABLE [nrcan_cleantech_semantic] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_nrcan_cleantech_semantic_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_cleantech_semantic_vector ON [nrcan_cleantech_semantic](vector);
    CREATE INDEX IX_nrcan_cleantech_semantic_source ON [nrcan_cleantech_semantic](source_key);
    CREATE INDEX IX_nrcan_cleantech_semantic_ref_date ON [nrcan_cleantech_semantic](ref_date);
    PRINT 'Table nrcan_cleantech_semantic created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_ghg_semantic')
BEGIN
    CREATE TABLE [nrcan_ghg_semantic] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_nrcan_ghg_semantic_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_ghg_semantic_vector ON [nrcan_ghg_semantic](vector);
    CREATE INDEX IX_nrcan_ghg_semantic_source ON [nrcan_ghg_semantic](source_key);
    CREATE INDEX IX_nrcan_ghg_semantic_ref_date ON [nrcan_ghg_semantic](ref_date);
    PRINT 'Table nrcan_ghg_semantic created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_majorproj_semantic')
BEGIN
    CREATE TABLE [nrcan_majorproj_semantic] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_nrcan_majorproj_semantic_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_majorproj_semantic_vector ON [nrcan_majorproj_semantic](vector);
    CREATE INDEX IX_nrcan_majorproj_semantic_source ON [nrcan_majorproj_semantic](source_key);
    CREATE INDEX IX_nrcan_majorproj_semantic_ref_date ON [nrcan_majorproj_semantic](ref_date);
    PRINT 'Table nrcan_majorproj_semantic created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_oee_commercial')
BEGIN
    CREATE TABLE [nrcan_oee_commercial] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_nrcan_oee_commercial_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_oee_commercial_vector ON [nrcan_oee_commercial](vector);
    CREATE INDEX IX_nrcan_oee_commercial_source ON [nrcan_oee_commercial](source_key);
    CREATE INDEX IX_nrcan_oee_commercial_ref_date ON [nrcan_oee_commercial](ref_date);
    PRINT 'Table nrcan_oee_commercial created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_oee_industrial')
BEGIN
    CREATE TABLE [nrcan_oee_industrial] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_nrcan_oee_industrial_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_oee_industrial_vector ON [nrcan_oee_industrial](vector);
    CREATE INDEX IX_nrcan_oee_industrial_source ON [nrcan_oee_industrial](source_key);
    CREATE INDEX IX_nrcan_oee_industrial_ref_date ON [nrcan_oee_industrial](ref_date);
    PRINT 'Table nrcan_oee_industrial created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_oee_neud')
BEGIN
    CREATE TABLE [nrcan_oee_neud] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_nrcan_oee_neud_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_oee_neud_vector ON [nrcan_oee_neud](vector);
    CREATE INDEX IX_nrcan_oee_neud_source ON [nrcan_oee_neud](source_key);
    CREATE INDEX IX_nrcan_oee_neud_ref_date ON [nrcan_oee_neud](ref_date);
    PRINT 'Table nrcan_oee_neud created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_oee_res_daily')
BEGIN
    CREATE TABLE [nrcan_oee_res_daily] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_nrcan_oee_res_daily_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_oee_res_daily_vector ON [nrcan_oee_res_daily](vector);
    CREATE INDEX IX_nrcan_oee_res_daily_source ON [nrcan_oee_res_daily](source_key);
    CREATE INDEX IX_nrcan_oee_res_daily_ref_date ON [nrcan_oee_res_daily](ref_date);
    PRINT 'Table nrcan_oee_res_daily created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_oee_res_pie')
BEGIN
    CREATE TABLE [nrcan_oee_res_pie] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_nrcan_oee_res_pie_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_oee_res_pie_vector ON [nrcan_oee_res_pie](vector);
    CREATE INDEX IX_nrcan_oee_res_pie_source ON [nrcan_oee_res_pie](source_key);
    CREATE INDEX IX_nrcan_oee_res_pie_ref_date ON [nrcan_oee_res_pie](ref_date);
    PRINT 'Table nrcan_oee_res_pie created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_oee_seu')
BEGIN
    CREATE TABLE [nrcan_oee_seu] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_nrcan_oee_seu_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_oee_seu_vector ON [nrcan_oee_seu](vector);
    CREATE INDEX IX_nrcan_oee_seu_source ON [nrcan_oee_seu](source_key);
    CREATE INDEX IX_nrcan_oee_seu_ref_date ON [nrcan_oee_seu](ref_date);
    PRINT 'Table nrcan_oee_seu created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'stc_capex_3410003601')
BEGIN
    CREATE TABLE [stc_capex_3410003601] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_stc_capex_3410003601_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_stc_capex_3410003601_vector ON [stc_capex_3410003601](vector);
    CREATE INDEX IX_stc_capex_3410003601_source ON [stc_capex_3410003601](source_key);
    CREATE INDEX IX_stc_capex_3410003601_ref_date ON [stc_capex_3410003601](ref_date);
    PRINT 'Table stc_capex_3410003601 created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'stc_epes_3810013001')
BEGIN
    CREATE TABLE [stc_epes_3810013001] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_stc_epes_3810013001_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_stc_epes_3810013001_vector ON [stc_epes_3810013001](vector);
    CREATE INDEX IX_stc_epes_3810013001_source ON [stc_epes_3810013001](source_key);
    CREATE INDEX IX_stc_epes_3810013001_ref_date ON [stc_epes_3810013001](ref_date);
    PRINT 'Table stc_epes_3810013001 created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'stc_fdi_3610000901')
BEGIN
    CREATE TABLE [stc_fdi_3610000901] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_stc_fdi_3610000901_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_stc_fdi_3610000901_vector ON [stc_fdi_3610000901](vector);
    CREATE INDEX IX_stc_fdi_3610000901_source ON [stc_fdi_3610000901](source_key);
    CREATE INDEX IX_stc_fdi_3610000901_ref_date ON [stc_fdi_3610000901](ref_date);
    PRINT 'Table stc_fdi_3610000901 created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'stc_foreignctrl_misc')
BEGIN
    CREATE TABLE [stc_foreignctrl_misc] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_stc_foreignctrl_misc_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_stc_foreignctrl_misc_vector ON [stc_foreignctrl_misc](vector);
    CREATE INDEX IX_stc_foreignctrl_misc_source ON [stc_foreignctrl_misc](source_key);
    CREATE INDEX IX_stc_foreignctrl_misc_ref_date ON [stc_foreignctrl_misc](ref_date);
    PRINT 'Table stc_foreignctrl_misc created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'stc_gdpnom_3610010301')
BEGIN
    CREATE TABLE [stc_gdpnom_3610010301] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_stc_gdpnom_3610010301_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_stc_gdpnom_3610010301_vector ON [stc_gdpnom_3610010301](vector);
    CREATE INDEX IX_stc_gdpnom_3610010301_source ON [stc_gdpnom_3610010301](source_key);
    CREATE INDEX IX_stc_gdpnom_3610010301_ref_date ON [stc_gdpnom_3610010301](ref_date);
    PRINT 'Table stc_gdpnom_3610010301 created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'stc_infra_3610060801')
BEGIN
    CREATE TABLE [stc_infra_3610060801] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_stc_infra_3610060801_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_stc_infra_3610060801_vector ON [stc_infra_3610060801](vector);
    CREATE INDEX IX_stc_infra_3610060801_source ON [stc_infra_3610060801](source_key);
    CREATE INDEX IX_stc_infra_3610060801_ref_date ON [stc_infra_3610060801](ref_date);
    PRINT 'Table stc_infra_3610060801 created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'stc_invasset_3410003601')
BEGIN
    CREATE TABLE [stc_invasset_3410003601] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_stc_invasset_3410003601_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_stc_invasset_3410003601_vector ON [stc_invasset_3410003601](vector);
    CREATE INDEX IX_stc_invasset_3410003601_source ON [stc_invasset_3410003601](source_key);
    CREATE INDEX IX_stc_invasset_3410003601_ref_date ON [stc_invasset_3410003601](ref_date);
    PRINT 'Table stc_invasset_3410003601 created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'stc_nrsa_3610061001')
BEGIN
    CREATE TABLE [stc_nrsa_3610061001] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_stc_nrsa_3610061001_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_stc_nrsa_3610061001_vector ON [stc_nrsa_3610061001](vector);
    CREATE INDEX IX_stc_nrsa_3610061001_source ON [stc_nrsa_3610061001](source_key);
    CREATE INDEX IX_stc_nrsa_3610061001_ref_date ON [stc_nrsa_3610061001](ref_date);
    PRINT 'Table stc_nrsa_3610061001 created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'stc_nrsa_3810028501')
BEGIN
    CREATE TABLE [stc_nrsa_3810028501] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_stc_nrsa_3810028501_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_stc_nrsa_3810028501_vector ON [stc_nrsa_3810028501](vector);
    CREATE INDEX IX_stc_nrsa_3810028501_source ON [stc_nrsa_3810028501](source_key);
    CREATE INDEX IX_stc_nrsa_3810028501_ref_date ON [stc_nrsa_3810028501](ref_date);
    PRINT 'Table stc_nrsa_3810028501 created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'stc_rppsd_25100081')
BEGIN
    CREATE TABLE [stc_rppsd_25100081] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_stc_rppsd_25100081_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_stc_rppsd_25100081_vector ON [stc_rppsd_25100081](vector);
    CREATE INDEX IX_stc_rppsd_25100081_source ON [stc_rppsd_25100081](source_key);
    CREATE INDEX IX_stc_rppsd_25100081_ref_date ON [stc_rppsd_25100081](ref_date);
    PRINT 'Table stc_rppsd_25100081 created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'stc_refinput_25100063')
BEGIN
    CREATE TABLE [stc_refinput_25100063] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_stc_refinput_25100063_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_stc_refinput_25100063_vector ON [stc_refinput_25100063](vector);
    CREATE INDEX IX_stc_refinput_25100063_source ON [stc_refinput_25100063](source_key);
    CREATE INDEX IX_stc_refinput_25100063_ref_date ON [stc_refinput_25100063](ref_date);
    PRINT 'Table stc_refinput_25100063 created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_crude_prices')
BEGIN
    CREATE TABLE [nrcan_crude_prices] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(100) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_nrcan_crude_prices_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_crude_prices_vector ON [nrcan_crude_prices](vector);
    CREATE INDEX IX_nrcan_crude_prices_source ON [nrcan_crude_prices](source_key);
    CREATE INDEX IX_nrcan_crude_prices_ref_date ON [nrcan_crude_prices](ref_date);
    PRINT 'Table nrcan_crude_prices created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'stc_oil_sands')
BEGIN
    CREATE TABLE [stc_oil_sands] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(100) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_stc_oil_sands_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_stc_oil_sands_vector ON [stc_oil_sands](vector);
    CREATE INDEX IX_stc_oil_sands_source ON [stc_oil_sands](source_key);
    CREATE INDEX IX_stc_oil_sands_ref_date ON [stc_oil_sands](ref_date);
    PRINT 'Table stc_oil_sands created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'stc_ev_sales')
BEGIN
    CREATE TABLE [stc_ev_sales] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(100) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_stc_ev_sales_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_stc_ev_sales_vector ON [stc_ev_sales](vector);
    CREATE INDEX IX_stc_ev_sales_source ON [stc_ev_sales](source_key);
    CREATE INDEX IX_stc_ev_sales_ref_date ON [stc_ev_sales](ref_date);
    PRINT 'Table stc_ev_sales created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'cer_electricity_trade_summary')
BEGIN
    CREATE TABLE [cer_electricity_trade_summary] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_cer_electricity_trade_summary_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_cer_electricity_trade_summary_vector ON [cer_electricity_trade_summary](vector);
    CREATE INDEX IX_cer_electricity_trade_summary_source ON [cer_electricity_trade_summary](source_key);
    CREATE INDEX IX_cer_electricity_trade_summary_ref_date ON [cer_electricity_trade_summary](ref_date);
    PRINT 'Table cer_electricity_trade_summary created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_windcapbyprov')
BEGIN
    CREATE TABLE [nrcan_windcapbyprov] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_nrcan_windcapbyprov_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_windcapbyprov_vector ON [nrcan_windcapbyprov](vector);
    CREATE INDEX IX_nrcan_windcapbyprov_source ON [nrcan_windcapbyprov](source_key);
    CREATE INDEX IX_nrcan_windcapbyprov_ref_date ON [nrcan_windcapbyprov](ref_date);
    PRINT 'Table nrcan_windcapbyprov created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'can_largestwindprojects')
BEGIN
    CREATE TABLE [can_largestwindprojects] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_can_largestwindprojects_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_can_largestwindprojects_vector ON [can_largestwindprojects](vector);
    CREATE INDEX IX_can_largestwindprojects_source ON [can_largestwindprojects](source_key);
    CREATE INDEX IX_can_largestwindprojects_ref_date ON [can_largestwindprojects](ref_date);
    PRINT 'Table can_largestwindprojects created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'can_largestsolprojects')
BEGIN
    CREATE TABLE [can_largestsolprojects] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_can_largestsolprojects_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_can_largestsolprojects_vector ON [can_largestsolprojects](vector);
    CREATE INDEX IX_can_largestsolprojects_source ON [can_largestsolprojects](source_key);
    CREATE INDEX IX_can_largestsolprojects_ref_date ON [can_largestsolprojects](ref_date);
    PRINT 'Table can_largestsolprojects created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'can_largesthydrofac')
BEGIN
    CREATE TABLE [can_largesthydrofac] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_can_largesthydrofac_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_can_largesthydrofac_vector ON [can_largesthydrofac](vector);
    CREATE INDEX IX_can_largesthydrofac_source ON [can_largesthydrofac](source_key);
    CREATE INDEX IX_can_largesthydrofac_ref_date ON [can_largesthydrofac](ref_date);
    PRINT 'Table can_largesthydrofac created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_solid_biofuels')
BEGIN
    CREATE TABLE [nrcan_solid_biofuels] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_nrcan_solid_biofuels_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_solid_biofuels_vector ON [nrcan_solid_biofuels](vector);
    CREATE INDEX IX_nrcan_solid_biofuels_source ON [nrcan_solid_biofuels](source_key);
    CREATE INDEX IX_nrcan_solid_biofuels_ref_date ON [nrcan_solid_biofuels](ref_date);
    PRINT 'Table nrcan_solid_biofuels created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_renelecap')
BEGIN
    CREATE TABLE [nrcan_renelecap] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_nrcan_renelecap_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_renelecap_vector ON [nrcan_renelecap](vector);
    CREATE INDEX IX_nrcan_renelecap_source ON [nrcan_renelecap](source_key);
    CREATE INDEX IX_nrcan_renelecap_ref_date ON [nrcan_renelecap](ref_date);
    PRINT 'Table nrcan_renelecap created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_elegen_can')
BEGIN
    CREATE TABLE [nrcan_elegen_can] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_nrcan_elegen_can_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_elegen_can_vector ON [nrcan_elegen_can](vector);
    CREATE INDEX IX_nrcan_elegen_can_source ON [nrcan_elegen_can](source_key);
    CREATE INDEX IX_nrcan_elegen_can_ref_date ON [nrcan_elegen_can](ref_date);
    PRINT 'Table nrcan_elegen_can created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_windpwr_can')
BEGIN
    CREATE TABLE [nrcan_windpwr_can] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_nrcan_windpwr_can_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_windpwr_can_vector ON [nrcan_windpwr_can](vector);
    CREATE INDEX IX_nrcan_windpwr_can_source ON [nrcan_windpwr_can](source_key);
    CREATE INDEX IX_nrcan_windpwr_can_ref_date ON [nrcan_windpwr_can](ref_date);
    PRINT 'Table nrcan_windpwr_can created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_worldwind')
BEGIN
    CREATE TABLE [nrcan_worldwind] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_nrcan_worldwind_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_worldwind_vector ON [nrcan_worldwind](vector);
    CREATE INDEX IX_nrcan_worldwind_source ON [nrcan_worldwind](source_key);
    CREATE INDEX IX_nrcan_worldwind_ref_date ON [nrcan_worldwind](ref_date);
    PRINT 'Table nrcan_worldwind created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_worldsolar')
BEGIN
    CREATE TABLE [nrcan_worldsolar] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_nrcan_worldsolar_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_worldsolar_vector ON [nrcan_worldsolar](vector);
    CREATE INDEX IX_nrcan_worldsolar_source ON [nrcan_worldsolar](source_key);
    CREATE INDEX IX_nrcan_worldsolar_ref_date ON [nrcan_worldsolar](ref_date);
    PRINT 'Table nrcan_worldsolar created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_electrical_energy_use')
BEGIN
    CREATE TABLE [nrcan_electrical_energy_use] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_nrcan_electrical_energy_use_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_electrical_energy_use_vector ON [nrcan_electrical_energy_use](vector);
    CREATE INDEX IX_nrcan_electrical_energy_use_source ON [nrcan_electrical_energy_use](source_key);
    CREATE INDEX IX_nrcan_electrical_energy_use_ref_date ON [nrcan_electrical_energy_use](ref_date);
    PRINT 'Table nrcan_electrical_energy_use created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_hydroq_prices')
BEGIN
    CREATE TABLE [nrcan_hydroq_prices] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_nrcan_hydroq_prices_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_hydroq_prices_vector ON [nrcan_hydroq_prices](vector);
    CREATE INDEX IX_nrcan_hydroq_prices_source ON [nrcan_hydroq_prices](source_key);
    CREATE INDEX IX_nrcan_hydroq_prices_ref_date ON [nrcan_hydroq_prices](ref_date);
    PRINT 'Table nrcan_hydroq_prices created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_wselec_growth')
BEGIN
    CREATE TABLE [nrcan_wselec_growth] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_nrcan_wselec_growth_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_wselec_growth_vector ON [nrcan_wselec_growth](vector);
    CREATE INDEX IX_nrcan_wselec_growth_source ON [nrcan_wselec_growth](source_key);
    CREATE INDEX IX_nrcan_wselec_growth_ref_date ON [nrcan_wselec_growth](ref_date);
    PRINT 'Table nrcan_wselec_growth created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'wna_uraniumprod')
BEGIN
    CREATE TABLE [wna_uraniumprod] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_wna_uraniumprod_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_wna_uraniumprod_vector ON [wna_uraniumprod](vector);
    CREATE INDEX IX_wna_uraniumprod_source ON [wna_uraniumprod](source_key);
    CREATE INDEX IX_wna_uraniumprod_ref_date ON [wna_uraniumprod](ref_date);
    PRINT 'Table wna_uraniumprod created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ecc_ghg_electricity')
BEGIN
    CREATE TABLE [ecc_ghg_electricity] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(300) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_ecc_ghg_electricity_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_ecc_ghg_electricity_vector ON [ecc_ghg_electricity](vector);
    CREATE INDEX IX_ecc_ghg_electricity_source ON [ecc_ghg_electricity](source_key);
    CREATE INDEX IX_ecc_ghg_electricity_ref_date ON [ecc_ghg_electricity](ref_date);
    PRINT 'Table ecc_ghg_electricity created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'stc_canadian_production')
BEGIN
    CREATE TABLE [stc_canadian_production] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(100) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_stc_canadian_production_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_stc_canadian_production_vector ON [stc_canadian_production](vector);
    CREATE INDEX IX_stc_canadian_production_source ON [stc_canadian_production](source_key);
    CREATE INDEX IX_stc_canadian_production_ref_date ON [stc_canadian_production](ref_date);
    PRINT 'Table stc_canadian_production created.';
END
GO

-- Upgrade legacy section-6 ingest tables created before unified schema
IF OBJECT_ID('dbo.nrcan_crude_prices', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.nrcan_crude_prices', 'title') IS NULL ALTER TABLE dbo.nrcan_crude_prices ADD title NVARCHAR(500) NULL;
    IF COL_LENGTH('dbo.nrcan_crude_prices', 'uom') IS NULL ALTER TABLE dbo.nrcan_crude_prices ADD uom NVARCHAR(100) NULL;
    IF COL_LENGTH('dbo.nrcan_crude_prices', 'scalar_factor') IS NULL ALTER TABLE dbo.nrcan_crude_prices ADD scalar_factor NVARCHAR(50) NULL;
    IF COL_LENGTH('dbo.nrcan_crude_prices', 'source_org') IS NULL ALTER TABLE dbo.nrcan_crude_prices ADD source_org NVARCHAR(255) NULL;
    IF COL_LENGTH('dbo.nrcan_crude_prices', 'source_url') IS NULL ALTER TABLE dbo.nrcan_crude_prices ADD source_url NVARCHAR(1000) NULL;
    IF COL_LENGTH('dbo.nrcan_crude_prices', 'fetched_at') IS NULL ALTER TABLE dbo.nrcan_crude_prices ADD fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE();
    IF COL_LENGTH('dbo.nrcan_crude_prices', 'source_key') IS NULL ALTER TABLE dbo.nrcan_crude_prices ADD source_key NVARCHAR(100) NULL;
END
GO

IF OBJECT_ID('dbo.stc_oil_sands', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.stc_oil_sands', 'title') IS NULL ALTER TABLE dbo.stc_oil_sands ADD title NVARCHAR(500) NULL;
    IF COL_LENGTH('dbo.stc_oil_sands', 'uom') IS NULL ALTER TABLE dbo.stc_oil_sands ADD uom NVARCHAR(100) NULL;
    IF COL_LENGTH('dbo.stc_oil_sands', 'scalar_factor') IS NULL ALTER TABLE dbo.stc_oil_sands ADD scalar_factor NVARCHAR(50) NULL;
    IF COL_LENGTH('dbo.stc_oil_sands', 'source_org') IS NULL ALTER TABLE dbo.stc_oil_sands ADD source_org NVARCHAR(255) NULL;
    IF COL_LENGTH('dbo.stc_oil_sands', 'source_url') IS NULL ALTER TABLE dbo.stc_oil_sands ADD source_url NVARCHAR(1000) NULL;
    IF COL_LENGTH('dbo.stc_oil_sands', 'fetched_at') IS NULL ALTER TABLE dbo.stc_oil_sands ADD fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE();
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'kal_gas_prices')
BEGIN
    CREATE TABLE [kal_gas_prices] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(100) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_kal_gas_prices_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_kal_gas_prices_vector ON [kal_gas_prices](vector);
    CREATE INDEX IX_kal_gas_prices_source ON [kal_gas_prices](source_key);
    CREATE INDEX IX_kal_gas_prices_ref_date ON [kal_gas_prices](ref_date);
    PRINT 'Table kal_gas_prices created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'osm_refin_cap')
BEGIN
    CREATE TABLE [osm_refin_cap] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(100) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_osm_refin_cap_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_osm_refin_cap_vector ON [osm_refin_cap](vector);
    CREATE INDEX IX_osm_refin_cap_source ON [osm_refin_cap](source_key);
    CREATE INDEX IX_osm_refin_cap_ref_date ON [osm_refin_cap](ref_date);
    PRINT 'Table osm_refin_cap created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ca_petroleum_reserves_summary')
BEGIN
    CREATE TABLE [ca_petroleum_reserves_summary] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(100) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_ca_petroleum_reserves_summary_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_ca_petroleum_reserves_summary_vector ON [ca_petroleum_reserves_summary](vector);
    CREATE INDEX IX_ca_petroleum_reserves_summary_source ON [ca_petroleum_reserves_summary](source_key);
    CREATE INDEX IX_ca_petroleum_reserves_summary_ref_date ON [ca_petroleum_reserves_summary](ref_date);
    PRINT 'Table ca_petroleum_reserves_summary created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ca_western_canada_oil_wells_count_depth')
BEGIN
    CREATE TABLE [ca_western_canada_oil_wells_count_depth] (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(100) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_ca_western_canada_oil_wells_count_depth_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_ca_western_canada_oil_wells_count_depth_vector ON [ca_western_canada_oil_wells_count_depth](vector);
    CREATE INDEX IX_ca_western_canada_oil_wells_count_depth_source ON [ca_western_canada_oil_wells_count_depth](source_key);
    CREATE INDEX IX_ca_western_canada_oil_wells_count_depth_ref_date ON [ca_western_canada_oil_wells_count_depth](ref_date);
    PRINT 'Table ca_western_canada_oil_wells_count_depth created.';
END
GO

-- ============================================================================
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

-- ============================================================================
-- LEGACY CALC TABLES (replaced by nrcan_efb_indicators)
-- ============================================================================

IF OBJECT_ID('dbo.nrcan_fb_s1_economic_contributions', 'U') IS NOT NULL DROP TABLE dbo.nrcan_fb_s1_economic_contributions;
IF OBJECT_ID('dbo.nrcan_fb_s1_provincial_gdp', 'U') IS NOT NULL DROP TABLE dbo.nrcan_fb_s1_provincial_gdp;
IF OBJECT_ID('dbo.nrcan_fb_s1_world_energy_production', 'U') IS NOT NULL DROP TABLE dbo.nrcan_fb_s1_world_energy_production;
IF OBJECT_ID('dbo.nrcan_fb_s2_capital_expenditures', 'U') IS NOT NULL DROP TABLE dbo.nrcan_fb_s2_capital_expenditures;
IF OBJECT_ID('dbo.nrcan_fb_s2_infrastructure', 'U') IS NOT NULL DROP TABLE dbo.nrcan_fb_s2_infrastructure;
IF OBJECT_ID('dbo.nrcan_fb_s2_international_investment', 'U') IS NOT NULL DROP TABLE dbo.nrcan_fb_s2_international_investment;
IF OBJECT_ID('dbo.nrcan_fb_s2_environmental_protection', 'U') IS NOT NULL DROP TABLE dbo.nrcan_fb_s2_environmental_protection;
IF OBJECT_ID('dbo.nrcan_fb_s2_clean_tech', 'U') IS NOT NULL DROP TABLE dbo.nrcan_fb_s2_clean_tech;
IF OBJECT_ID('dbo.nrcan_fb_s4_energy_use', 'U') IS NOT NULL DROP TABLE dbo.nrcan_fb_s4_energy_use;
GO

-- ============================================================================
-- EFB INDICATORS (Factbook semantic vectors; populated by efb transform)
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_efb_indicators')
BEGIN
    CREATE TABLE nrcan_efb_indicators (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(100) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        indicator_key NVARCHAR(100) NOT NULL,
        computed_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [UQ_nrcan_efb_indicators_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_efb_indicators_vector ON nrcan_efb_indicators(vector);
    CREATE INDEX IX_nrcan_efb_indicators_indicator ON nrcan_efb_indicators(indicator_key);
    CREATE INDEX IX_nrcan_efb_indicators_ref_date ON nrcan_efb_indicators(ref_date);
    PRINT 'Table nrcan_efb_indicators created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_fb_major_projects_map')
BEGIN
    CREATE TABLE nrcan_fb_major_projects_map (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        lang NVARCHAR(20) NOT NULL,
        feature_id NVARCHAR(200) NOT NULL,
        company NVARCHAR(500) NULL,
        project_name NVARCHAR(500) NULL,
        province NVARCHAR(200) NULL,
        location NVARCHAR(1000) NULL,
        capital_cost NVARCHAR(200) NULL,
        capital_cost_range NVARCHAR(200) NULL,
        status NVARCHAR(200) NULL,
        clean_technology NVARCHAR(200) NULL,
        clean_technology_type NVARCHAR(200) NULL,
        line_type NVARCHAR(200) NULL,
        lat NVARCHAR(80) NULL,
        lon NVARCHAR(80) NULL,
        paths NVARCHAR(MAX) NULL,
        feature_type NVARCHAR(80) NULL,
        inserted_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_nrcan_fb_mp_map_lang ON nrcan_fb_major_projects_map(lang, feature_type);
    PRINT 'Table nrcan_fb_major_projects_map created.';
END
GO

-- Remove obsolete legacy tables if present (optional cleanup on re-run)
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'raw_major_projects')
BEGIN
    DROP TABLE raw_major_projects;
    PRINT 'Table raw_major_projects dropped (obsolete).';
END
GO

-- ============================================================================
-- INSERT DEFAULT DATA SOURCES
-- ============================================================================
-- Refresh skips destructive re-seed; see scripts/db/ensure_schema.py

DELETE FROM nrcan_fb_data_sources;

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
('rpp_refinery_input', 'Refinery input', 6, 'Oil, Natural Gas and Coal', N'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=2510006301', 1),
('crude_prices', 'WTI and WCS crude prices', 6, 'Oil, Natural Gas and Coal', N'https://www.eia.gov/dnav/pet/xls/PET_PRI_SPT_S1_M.xls', 1),
('oil_sands', 'Oil sands capex and production share', 6, 'Oil, Natural Gas and Coal', N'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3410003601', 1),
('canadian_production', 'Canadian crude production by type and province', 6, 'Oil, Natural Gas and Coal', N'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=2510006301', 1),
('ev_sales', 'Plug-in electric vehicle registrations', 5, 'Clean Power and Low Carbon Fuels', N'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=2010002501', 1),
('electricity_trade_us', 'Electricity trade with the U.S.', 5, 'Clean Power and Low Carbon Fuels', N'https://www.cer-rec.gc.ca/en/data-analysis/energy-commodities/electricity/statistics/electricity-trade-summary/electricity-trades-summary-resume-echanges-commerciaux-electricite.xlsm', 1),
('wind_capacity_by_province', 'Wind capacity by province', 5, 'Clean Power and Low Carbon Fuels', N'', 1),
('world_wind_power', 'World wind power capacity and Canada wind generation share', 5, 'Clean Power and Low Carbon Fuels', N'', 1),
('world_solar_pv', 'World solar PV capacity ranking', 5, 'Clean Power and Low Carbon Fuels', N'', 1),
('renewable_electricity_capacity', 'Canadian renewable electricity generating capacity', 5, 'Clean Power and Low Carbon Fuels', N'', 1),
('ghg_electricity_spotlight', 'GHG spotlight: electricity', 5, 'Clean Power and Low Carbon Fuels', N'https://www.canada.ca/en/environment-climate-change/services/environmental-indicators/greenhouse-gas-emissions.html', 1),
('largest_wind_projects', 'Largest wind projects (200 MW+)', 5, 'Clean Power and Low Carbon Fuels', N'', 1),
('largest_solar_projects', 'Largest solar projects (50 MW+)', 5, 'Clean Power and Low Carbon Fuels', N'', 1),
('major_hydro_facilities', 'Major hydro facilities in Canada (1,000 MW+)', 5, 'Clean Power and Low Carbon Fuels', N'', 1),
('solid_biofuels', 'Canadian production of solid biofuels', 5, 'Clean Power and Low Carbon Fuels', N'https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=2510003101', 1),
('kal_gas_prices', 'Gasoline retail price components (Kalibrate)', 6, 'Oil, Natural Gas and Coal', N'https://kalibrate.com/', 1),
('osm_refin_cap', 'Canadian refinery capacity (Oil Sands Magazine)', 6, 'Oil, Natural Gas and Coal', N'https://www.oilsandsmagazine.com/projects/canadian-refineries', 1),
('petroleum_reserves', 'Canadian proved reserves of crude oil', 6, 'Oil, Natural Gas and Coal', N'', 1),
('western_canada_oil_wells', 'Western Canada oil wells completed', 6, 'Oil, Natural Gas and Coal', N'https://www.aer.ca/data-and-performance-reports/statistical-reports/st59', 1);

PRINT 'Default data sources inserted.';
GO

-- ============================================================================
-- UTILITY STORED PROCEDURES
-- ============================================================================

IF OBJECT_ID('sp_log_run_start', 'P') IS NOT NULL DROP PROCEDURE sp_log_run_start;
GO

CREATE PROCEDURE sp_log_run_start
    @source_key NVARCHAR(100),
    @run_type NVARCHAR(50),
    @run_id INT OUTPUT
AS
BEGIN
    INSERT INTO nrcan_fb_run_history (source_key, run_type, status)
    VALUES (@source_key, @run_type, 'started');

    SET @run_id = SCOPE_IDENTITY();
END
GO

IF OBJECT_ID('sp_log_run_complete', 'P') IS NOT NULL DROP PROCEDURE sp_log_run_complete;
GO

CREATE PROCEDURE sp_log_run_complete
    @run_id INT,
    @status NVARCHAR(20),
    @rows_affected INT = NULL,
    @error_message NVARCHAR(MAX) = NULL
AS
BEGIN
    UPDATE nrcan_fb_run_history
    SET status = @status,
        rows_affected = @rows_affected,
        error_message = @error_message,
        completed_at = GETUTCDATE()
    WHERE run_id = @run_id;
END
GO

-- Legacy helper: source clearing is performed in Python via DataRepository.clear_raw_data
-- (per-table DELETE using eedas_registry.yaml). This proc remains as a no-op shim.
IF OBJECT_ID('sp_clear_source_data', 'P') IS NOT NULL DROP PROCEDURE sp_clear_source_data;
GO

CREATE PROCEDURE sp_clear_source_data
    @source_key NVARCHAR(100)
AS
BEGIN
    UPDATE nrcan_fb_data_sources
    SET updated_at = GETUTCDATE()
    WHERE source_key = @source_key;
END
GO

PRINT '============================================================================';
PRINT 'Database setup complete!';
PRINT '============================================================================';
PRINT '';
PRINT 'Next steps:';
PRINT '1. Create a SQL Server login for the application';
PRINT '2. Grant appropriate permissions to the NRCanEnergyFactbook database';
PRINT '3. Update the config.yaml with connection details';
PRINT '';
GO
