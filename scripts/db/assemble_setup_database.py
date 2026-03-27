"""Rebuild scripts/db/setup_database.sql from header, eedas fragment, calc/export tail."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parent

HEADER = """-- ============================================================================
-- NRCan Energy Factbook Database Setup Script
--
-- This script creates the database and all required tables for the
-- Energy Factbook data pipeline.
--
-- EEDAS-style physical names: per-source ingest tables are listed in
-- eedas_registry.yaml; generated DDL lives in eedas_raw_tables_fragment.sql
-- (regenerate: python scripts/db/_gen_eedas_raw_sql.py).
--
-- Usage:
--   1. Connect to SQL Server as an admin user
--   2. Run this script to create the database and tables
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
        statcan_table_id NVARCHAR(50) NULL,
        source_url NVARCHAR(1000) NULL,
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
-- RAW / SEMANTIC INGEST TABLES (EEDAS registry)
-- ============================================================================

"""

MAJOR_MAP = """
-- Major Projects Map Data (NRCan ArcGIS export)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_fb_major_projects_map')
BEGIN
    CREATE TABLE nrcan_fb_major_projects_map (
        id INT IDENTITY(1,1) PRIMARY KEY,
        lang NVARCHAR(10) NOT NULL,
        feature_id NVARCHAR(100) NULL,
        company NVARCHAR(500) NULL,
        project_name NVARCHAR(500) NULL,
        province NVARCHAR(100) NULL,
        location NVARCHAR(255) NULL,
        capital_cost NVARCHAR(100) NULL,
        capital_cost_range NVARCHAR(100) NULL,
        status NVARCHAR(100) NULL,
        clean_technology NVARCHAR(100) NULL,
        clean_technology_type NVARCHAR(255) NULL,
        line_type NVARCHAR(100) NULL,
        lat NVARCHAR(50) NULL,
        lon NVARCHAR(50) NULL,
        paths NVARCHAR(MAX) NULL,
        feature_type NVARCHAR(20) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );

    CREATE INDEX IX_nrcan_fb_major_projects_map_lang ON nrcan_fb_major_projects_map(lang);
    CREATE INDEX IX_nrcan_fb_major_projects_map_type ON nrcan_fb_major_projects_map(feature_type);

    PRINT 'Table nrcan_fb_major_projects_map created.';
END
GO

"""

CALC_EXPORT = """
-- ============================================================================
-- CALCULATED DATA TABLES (section-scoped nrcan_fb_sN_*)
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_fb_s2_capital_expenditures')
BEGIN
    CREATE TABLE nrcan_fb_s2_capital_expenditures (
        id INT IDENTITY(1,1) PRIMARY KEY,
        ref_year INT NOT NULL,
        oil_gas DECIMAL(18,2) NULL,
        electricity DECIMAL(18,2) NULL,
        other_energy DECIMAL(18,2) NULL,
        total DECIMAL(18,2) NULL,
        calculated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_nrcan_fb_s2_capex_year UNIQUE (ref_year)
    );
    PRINT 'Table nrcan_fb_s2_capital_expenditures created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_fb_s2_infrastructure')
BEGIN
    CREATE TABLE nrcan_fb_s2_infrastructure (
        id INT IDENTITY(1,1) PRIMARY KEY,
        ref_year INT NOT NULL,
        fuel_energy_pipelines DECIMAL(18,2) NULL,
        transport DECIMAL(18,2) NULL,
        education DECIMAL(18,2) NULL,
        health_housing DECIMAL(18,2) NULL,
        environmental DECIMAL(18,2) NULL,
        public_safety DECIMAL(18,2) NULL,
        total DECIMAL(18,2) NULL,
        calculated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_nrcan_fb_s2_infra_year UNIQUE (ref_year)
    );
    PRINT 'Table nrcan_fb_s2_infrastructure created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_fb_s1_economic_contributions')
BEGIN
    CREATE TABLE nrcan_fb_s1_economic_contributions (
        id INT IDENTITY(1,1) PRIMARY KEY,
        ref_year INT NOT NULL,
        gdp_direct DECIMAL(18,2) NULL,
        gdp_indirect DECIMAL(18,2) NULL,
        gdp_total DECIMAL(18,2) NULL,
        jobs_direct DECIMAL(18,2) NULL,
        jobs_indirect DECIMAL(18,2) NULL,
        jobs_total DECIMAL(18,2) NULL,
        income_direct DECIMAL(18,2) NULL,
        income_indirect DECIMAL(18,2) NULL,
        income_total DECIMAL(18,2) NULL,
        calculated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_nrcan_fb_s1_econ_year UNIQUE (ref_year)
    );
    PRINT 'Table nrcan_fb_s1_economic_contributions created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_fb_s2_environmental_protection')
BEGIN
    CREATE TABLE nrcan_fb_s2_environmental_protection (
        id INT IDENTITY(1,1) PRIMARY KEY,
        ref_year INT NOT NULL,
        industry_category NVARCHAR(100) NOT NULL,
        wastewater DECIMAL(18,2) NULL,
        soil_groundwater DECIMAL(18,2) NULL,
        air_pollution DECIMAL(18,2) NULL,
        solid_waste DECIMAL(18,2) NULL,
        other DECIMAL(18,2) NULL,
        total DECIMAL(18,2) NULL,
        calculated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_nrcan_fb_s2_envprot_year_cat UNIQUE (ref_year, industry_category)
    );
    CREATE INDEX IX_nrcan_fb_s2_envprot_year ON nrcan_fb_s2_environmental_protection(ref_year);
    PRINT 'Table nrcan_fb_s2_environmental_protection created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_fb_s2_international_investment')
BEGIN
    CREATE TABLE nrcan_fb_s2_international_investment (
        id INT IDENTITY(1,1) PRIMARY KEY,
        ref_year INT NOT NULL,
        investment_type NVARCHAR(50) NOT NULL,
        industry_category NVARCHAR(100) NOT NULL,
        value DECIMAL(18,2) NULL,
        calculated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_nrcan_fb_s2_intlinv UNIQUE (ref_year, investment_type, industry_category)
    );
    CREATE INDEX IX_nrcan_fb_s2_intlinv_year ON nrcan_fb_s2_international_investment(ref_year);
    PRINT 'Table nrcan_fb_s2_international_investment created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_fb_s1_provincial_gdp')
BEGIN
    CREATE TABLE nrcan_fb_s1_provincial_gdp (
        id INT IDENTITY(1,1) PRIMARY KEY,
        ref_year INT NOT NULL,
        province_code NVARCHAR(10) NOT NULL,
        province_name NVARCHAR(100) NOT NULL,
        energy_gdp DECIMAL(18,2) NULL,
        total_gdp DECIMAL(18,2) NULL,
        energy_share_pct DECIMAL(8,4) NULL,
        calculated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_nrcan_fb_s1_provgdp UNIQUE (ref_year, province_code)
    );
    CREATE INDEX IX_nrcan_fb_s1_provgdp_year ON nrcan_fb_s1_provincial_gdp(ref_year);
    PRINT 'Table nrcan_fb_s1_provincial_gdp created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_fb_s1_world_energy_production')
BEGIN
    CREATE TABLE nrcan_fb_s1_world_energy_production (
        id INT IDENTITY(1,1) PRIMARY KEY,
        ref_year INT NOT NULL,
        country_code NVARCHAR(10) NOT NULL,
        country_name NVARCHAR(100) NOT NULL,
        energy_type NVARCHAR(50) NOT NULL,
        production_value DECIMAL(18,2) NULL,
        unit NVARCHAR(50) NULL,
        global_rank INT NULL,
        calculated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_nrcan_fb_s1_worldenergy UNIQUE (ref_year, country_code, energy_type)
    );
    CREATE INDEX IX_nrcan_fb_s1_worldenergy_year ON nrcan_fb_s1_world_energy_production(ref_year);
    CREATE INDEX IX_nrcan_fb_s1_worldenergy_country ON nrcan_fb_s1_world_energy_production(country_code);
    PRINT 'Table nrcan_fb_s1_world_energy_production created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_fb_s2_clean_tech')
BEGIN
    CREATE TABLE nrcan_fb_s2_clean_tech (
        id INT IDENTITY(1,1) PRIMARY KEY,
        ref_year INT NOT NULL,
        category NVARCHAR(100) NOT NULL,
        project_count INT NULL,
        total_investment DECIMAL(18,2) NULL,
        calculated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_nrcan_fb_s2_cleantech UNIQUE (ref_year, category)
    );
    PRINT 'Table nrcan_fb_s2_clean_tech created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_fb_s4_energy_use')
BEGIN
    CREATE TABLE nrcan_fb_s4_energy_use (
        id INT IDENTITY(1,1) PRIMARY KEY,
        ref_year INT NOT NULL UNIQUE,
        R DECIMAL(18,2) NULL,
        C DECIMAL(18,2) NULL,
        I DECIMAL(18,2) NULL,
        T DECIMAL(18,2) NULL,
        A DECIMAL(18,2) NULL,
        P DECIMAL(18,2) NULL,
        NPC DECIMAL(18,2) NULL,
        FK DECIMAL(18,2) NULL,
        EL DECIMAL(18,2) NULL,
        calculated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_nrcan_fb_s4_energy_use_year ON nrcan_fb_s4_energy_use(ref_year);
    PRINT 'Table nrcan_fb_s4_energy_use created.';
END
GO

-- ============================================================================
-- CONSOLIDATED EXPORT TABLES
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_fb_export_data')
BEGIN
    CREATE TABLE nrcan_fb_export_data (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(100) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value NVARCHAR(100) NULL,
        CONSTRAINT UQ_nrcan_fb_export_vector_date UNIQUE (vector, ref_date)
    );
    PRINT 'Table nrcan_fb_export_data created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_fb_export_metadata')
BEGIN
    CREATE TABLE nrcan_fb_export_metadata (
        id INT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(100) NOT NULL UNIQUE,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL
    );
    PRINT 'Table nrcan_fb_export_metadata created.';
END
GO

"""

TAIL = """
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

DELETE FROM nrcan_fb_data_sources;

INSERT INTO nrcan_fb_data_sources (source_key, source_name, section_id, section_name, statcan_table_id, is_enabled)
VALUES
('economic_contributions', 'Economic Contributions (GDP, Jobs, Income)', 1, 'Key Indicators', '36-10-0610-01', 1),
('nominal_gdp', 'Nominal GDP Contributions', 1, 'Key Indicators', '36-10-0103-01', 1),
('provincial_gdp', 'Provincial GDP Data', 1, 'Key Indicators', '38-10-0285-01', 1),
('world_energy_production', 'World Energy Production', 1, 'Key Indicators', NULL, 1),
('canadian_energy_assets', 'Canadian Energy Assets (CEA)', 1, 'Key Indicators', NULL, 1),
('capital_expenditures', 'Capital Expenditures', 2, 'Investment', '34-10-0036-01', 1),
('infrastructure', 'Infrastructure Stock', 2, 'Investment', '36-10-0608-01', 1),
('investment_by_asset', 'Investment by Asset Type', 2, 'Investment', '34-10-0036-01', 1),
('international_investment', 'International Investment (FDI/CDIA)', 2, 'Investment', '36-10-0009-01', 1),
('foreign_control', 'Foreign Control', 2, 'Investment', NULL, 1),
('environmental_protection', 'Environmental Protection Expenditures', 2, 'Investment', NULL, 1),
('major_projects', 'Major Projects Inventory', 2, 'Investment', NULL, 1),
('clean_tech', 'Clean Technology Projects', 2, 'Investment', NULL, 1),
('skills_data', 'Skills and Employment Data', 3, 'Skills, Diversity and Community', NULL, 0),
('energy_use', 'Energy use (OEE NEUD + Primary Energy Use Demand)', 4, 'Energy Efficiency', NULL, 1),
('clean_power_data', 'Clean Power and Low Carbon Fuels', 5, 'Clean Power and Low Carbon Fuels', NULL, 0),
('oil_gas_data', 'Oil, Natural Gas and Coal', 6, 'Oil, Natural Gas and Coal', NULL, 0);

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
"""


def main() -> None:
    frag = (ROOT / "eedas_raw_tables_fragment.sql").read_text(encoding="utf-8")
    out = HEADER + frag + MAJOR_MAP + CALC_EXPORT + TAIL
    (ROOT / "setup_database.sql").write_text(out, encoding="utf-8")
    print("Wrote", ROOT / "setup_database.sql")


if __name__ == "__main__":
    main()
