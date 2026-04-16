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
--      `python main.py refresh ...` — the refresh command applies this script's
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
    WHEN N'seu_by_fuel' THEN N'https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=HB&sector=aaa&juris=ca&rn=1&year=2022&page=2'
    WHEN N'ghg_emissions' THEN N'https://www.canada.ca/en/environment-climate-change/services/climate-change/greenhouse-gas-emissions-inventory.html'
    WHEN N'environmental_clean_tech' THEN N'https://www.statcan.gc.ca/en/topics-start/environmental_and_clean_technology'
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
        WHEN N'seu_by_fuel' THEN N'https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=HB&sector=aaa&juris=ca&rn=1&year=2022&page=2'
        WHEN N'ghg_emissions' THEN N'https://www.canada.ca/en/environment-climate-change/services/climate-change/greenhouse-gas-emissions-inventory.html'
        WHEN N'environmental_clean_tech' THEN N'https://www.statcan.gc.ca/en/topics-start/environmental_and_clean_technology'
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

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'iea_web_rankings')
BEGIN
    CREATE TABLE [iea_web_rankings] (
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
        CONSTRAINT [UQ_nrcan_cleanenv_semantic_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_cleanenv_semantic_vector ON [nrcan_cleanenv_semantic](vector);
    CREATE INDEX IX_nrcan_cleanenv_semantic_source ON [nrcan_cleanenv_semantic](source_key);
    CREATE INDEX IX_nrcan_cleanenv_semantic_ref_date ON [nrcan_cleanenv_semantic](ref_date);
    PRINT 'Table nrcan_cleanenv_semantic created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_cleantech_semantic')
BEGIN
    CREATE TABLE [nrcan_cleantech_semantic] (
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
        CONSTRAINT [UQ_nrcan_oee_commercial_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_oee_commercial_vector ON [nrcan_oee_commercial](vector);
    CREATE INDEX IX_nrcan_oee_commercial_source ON [nrcan_oee_commercial](source_key);
    CREATE INDEX IX_nrcan_oee_commercial_ref_date ON [nrcan_oee_commercial](ref_date);
    PRINT 'Table nrcan_oee_commercial created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_oee_neud')
BEGIN
    CREATE TABLE [nrcan_oee_neud] (
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
        CONSTRAINT [UQ_stc_nrsa_3810028501_vd] UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_stc_nrsa_3810028501_vector ON [stc_nrsa_3810028501](vector);
    CREATE INDEX IX_stc_nrsa_3810028501_source ON [stc_nrsa_3810028501](source_key);
    CREATE INDEX IX_stc_nrsa_3810028501_ref_date ON [stc_nrsa_3810028501](ref_date);
    PRINT 'Table stc_nrsa_3810028501 created.';
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
-- SECTION-SCOPED CALCULATED TABLES (MERGE targets; see scripts/db/models.py)
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_fb_s1_economic_contributions')
BEGIN
    CREATE TABLE nrcan_fb_s1_economic_contributions (
        ref_year INT NOT NULL PRIMARY KEY,
        gdp_direct DECIMAL(18,4) NULL,
        gdp_indirect DECIMAL(18,4) NULL,
        gdp_total DECIMAL(18,4) NULL,
        jobs_direct DECIMAL(18,2) NULL,
        jobs_indirect DECIMAL(18,2) NULL,
        jobs_total DECIMAL(18,2) NULL,
        income_direct DECIMAL(18,4) NULL,
        income_indirect DECIMAL(18,4) NULL,
        income_total DECIMAL(18,4) NULL,
        calculated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    PRINT 'Table nrcan_fb_s1_economic_contributions created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_fb_s1_provincial_gdp')
BEGIN
    CREATE TABLE nrcan_fb_s1_provincial_gdp (
        ref_year INT NOT NULL,
        province_code NVARCHAR(50) NOT NULL,
        province_name NVARCHAR(200) NULL,
        energy_gdp DECIMAL(18,4) NULL,
        total_gdp DECIMAL(18,4) NULL,
        energy_share_pct DECIMAL(18,4) NULL,
        calculated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT PK_nrcan_fb_s1_provincial_gdp PRIMARY KEY (ref_year, province_code)
    );
    CREATE INDEX IX_nrcan_fb_s1_prov_gdp_year ON nrcan_fb_s1_provincial_gdp(ref_year);
    PRINT 'Table nrcan_fb_s1_provincial_gdp created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_fb_s1_world_energy_production')
BEGIN
    CREATE TABLE nrcan_fb_s1_world_energy_production (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        ref_year INT NOT NULL,
        country_key NVARCHAR(100) NULL,
        metric NVARCHAR(100) NULL,
        value DECIMAL(18,4) NULL,
        calculated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_nrcan_fb_s1_world_energy_year ON nrcan_fb_s1_world_energy_production(ref_year);
    PRINT 'Table nrcan_fb_s1_world_energy_production created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_fb_s2_capital_expenditures')
BEGIN
    CREATE TABLE nrcan_fb_s2_capital_expenditures (
        ref_year INT NOT NULL PRIMARY KEY,
        oil_gas DECIMAL(18,4) NULL,
        electricity DECIMAL(18,4) NULL,
        other_energy DECIMAL(18,4) NULL,
        total DECIMAL(18,4) NULL,
        calculated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    PRINT 'Table nrcan_fb_s2_capital_expenditures created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_fb_s2_infrastructure')
BEGIN
    CREATE TABLE nrcan_fb_s2_infrastructure (
        ref_year INT NOT NULL PRIMARY KEY,
        fuel_energy_pipelines DECIMAL(18,4) NULL,
        transport DECIMAL(18,4) NULL,
        education DECIMAL(18,4) NULL,
        health_housing DECIMAL(18,4) NULL,
        environmental DECIMAL(18,4) NULL,
        public_safety DECIMAL(18,4) NULL,
        total DECIMAL(18,4) NULL,
        calculated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    PRINT 'Table nrcan_fb_s2_infrastructure created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_fb_s2_international_investment')
BEGIN
    CREATE TABLE nrcan_fb_s2_international_investment (
        ref_year INT NOT NULL,
        investment_type NVARCHAR(100) NOT NULL,
        industry_category NVARCHAR(100) NOT NULL,
        value DECIMAL(18,4) NULL,
        calculated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT PK_nrcan_fb_s2_intl_inv PRIMARY KEY (ref_year, investment_type, industry_category)
    );
    CREATE INDEX IX_nrcan_fb_s2_intl_inv_year ON nrcan_fb_s2_international_investment(ref_year);
    PRINT 'Table nrcan_fb_s2_international_investment created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_fb_s2_environmental_protection')
BEGIN
    CREATE TABLE nrcan_fb_s2_environmental_protection (
        ref_year INT NOT NULL,
        industry_category NVARCHAR(100) NOT NULL,
        wastewater DECIMAL(18,4) NULL,
        soil_groundwater DECIMAL(18,4) NULL,
        air_pollution DECIMAL(18,4) NULL,
        solid_waste DECIMAL(18,4) NULL,
        other DECIMAL(18,4) NULL,
        total DECIMAL(18,4) NULL,
        calculated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT PK_nrcan_fb_s2_env_prot PRIMARY KEY (ref_year, industry_category)
    );
    CREATE INDEX IX_nrcan_fb_s2_env_prot_year ON nrcan_fb_s2_environmental_protection(ref_year);
    PRINT 'Table nrcan_fb_s2_environmental_protection created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_fb_s2_clean_tech')
BEGIN
    CREATE TABLE nrcan_fb_s2_clean_tech (
        ref_year INT NOT NULL,
        category NVARCHAR(200) NOT NULL,
        project_count INT NULL,
        total_investment DECIMAL(18,4) NULL,
        calculated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT PK_nrcan_fb_s2_clean_tech PRIMARY KEY (ref_year, category)
    );
    CREATE INDEX IX_nrcan_fb_s2_clean_tech_year ON nrcan_fb_s2_clean_tech(ref_year);
    PRINT 'Table nrcan_fb_s2_clean_tech created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_fb_s4_energy_use')
BEGIN
    CREATE TABLE nrcan_fb_s4_energy_use (
        ref_year INT NOT NULL PRIMARY KEY,
        [R] DECIMAL(18,4) NULL,
        [C] DECIMAL(18,4) NULL,
        [I] DECIMAL(18,4) NULL,
        [T] DECIMAL(18,4) NULL,
        [A] DECIMAL(18,4) NULL,
        [P] DECIMAL(18,4) NULL,
        [NPC] DECIMAL(18,4) NULL,
        [FK] DECIMAL(18,4) NULL,
        [EL] DECIMAL(18,4) NULL,
        calculated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    PRINT 'Table nrcan_fb_s4_energy_use created.';
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
('seu_by_fuel', 'SEU by fuel (OEE)', 4, 'Energy Efficiency', N'https://oee.nrcan.gc.ca/corporate/statistics/neud/dpa/showTable.cfm?type=HB&sector=aaa&juris=ca&rn=1&year=2022&page=2', 1),
('ghg_emissions', 'GHG emissions (ECCC)', 1, 'Key Indicators', N'https://www.canada.ca/en/environment-climate-change/services/climate-change/greenhouse-gas-emissions-inventory.html', 1),
('environmental_clean_tech', 'Environmental and clean technology', 5, 'Clean Power and Low Carbon Fuels', N'https://www.statcan.gc.ca/en/topics-start/environmental_and_clean_technology', 1);

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
