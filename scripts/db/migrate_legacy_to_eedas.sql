-- ============================================================================
-- One-time migration: legacy monolithic tables -> EEDAS physical names
--
-- Prerequisites:
--   1. Backup the database.
--   2. Run the updated setup_database.sql first so nrcan_fb_* and per-source
--      tables exist (or create empty targets matching current schema).
--   3. This script assumes legacy objects still exist:
--        raw_statcan_data, raw_statcan_metadata,
--        calc_*, export_data, export_metadata,
--        data_sources, run_history, raw_major_projects_map
--
-- After verification, drop legacy tables in a separate maintenance window.
-- ============================================================================

USE NRCanEnergyFactbook;
GO

SET NOCOUNT ON;

-- ---------------------------------------------------------------------------
-- Raw + metadata: copy by source_key into registry targets
-- (Pairs are listed explicitly; keep in sync with eedas_registry.yaml)
-- ---------------------------------------------------------------------------

IF OBJECT_ID('raw_statcan_data', 'U') IS NOT NULL AND OBJECT_ID('stc_nrsa_3610061001_data', 'U') IS NOT NULL
BEGIN
    INSERT INTO stc_nrsa_3610061001_data (vector, ref_date, value, source_key, fetched_at)
    SELECT vector, ref_date, value, source_key, fetched_at FROM raw_statcan_data
    WHERE source_key IN (N'economic_contributions_raw', N'economic_contributions');

    INSERT INTO stc_nrsa_3610061001_metadata (vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at)
    SELECT vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at FROM raw_statcan_metadata
    WHERE source_key IN (N'economic_contributions_raw', N'economic_contributions');
    PRINT 'Migrated economic_contributions* -> stc_nrsa_3610061001_*';
END
GO

IF OBJECT_ID('raw_statcan_data', 'U') IS NOT NULL AND OBJECT_ID('stc_gdpnom_3610010301_data', 'U') IS NOT NULL
BEGIN
    INSERT INTO stc_gdpnom_3610010301_data (vector, ref_date, value, source_key, fetched_at)
    SELECT vector, ref_date, value, source_key, fetched_at FROM raw_statcan_data WHERE source_key = N'nominal_gdp';
    INSERT INTO stc_gdpnom_3610010301_metadata (vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at)
    SELECT vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at FROM raw_statcan_metadata WHERE source_key = N'nominal_gdp';
    PRINT 'Migrated nominal_gdp -> stc_gdpnom_3610010301_*';
END
GO

IF OBJECT_ID('raw_statcan_data', 'U') IS NOT NULL AND OBJECT_ID('stc_nrsa_3810028501_data', 'U') IS NOT NULL
BEGIN
    INSERT INTO stc_nrsa_3810028501_data (vector, ref_date, value, source_key, fetched_at)
    SELECT vector, ref_date, value, source_key, fetched_at FROM raw_statcan_data WHERE source_key = N'provincial_gdp';
    INSERT INTO stc_nrsa_3810028501_metadata (vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at)
    SELECT vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at FROM raw_statcan_metadata WHERE source_key = N'provincial_gdp';
    PRINT 'Migrated provincial_gdp -> stc_nrsa_3810028501_*';
END
GO

IF OBJECT_ID('raw_statcan_data', 'U') IS NOT NULL AND OBJECT_ID('iea_web_rankings_data', 'U') IS NOT NULL
BEGIN
    INSERT INTO iea_web_rankings_data (vector, ref_date, value, source_key, fetched_at)
    SELECT vector, ref_date, value, source_key, fetched_at FROM raw_statcan_data WHERE source_key = N'world_energy_production';
    INSERT INTO iea_web_rankings_metadata (vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at)
    SELECT vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at FROM raw_statcan_metadata WHERE source_key = N'world_energy_production';
    PRINT 'Migrated world_energy_production -> iea_web_rankings_*';
END
GO

IF OBJECT_ID('raw_statcan_data', 'U') IS NOT NULL AND OBJECT_ID('nrcan_cea_assets_data', 'U') IS NOT NULL
BEGIN
    INSERT INTO nrcan_cea_assets_data (vector, ref_date, value, source_key, fetched_at)
    SELECT vector, ref_date, value, source_key, fetched_at FROM raw_statcan_data WHERE source_key = N'canadian_energy_assets';
    INSERT INTO nrcan_cea_assets_metadata (vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at)
    SELECT vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at FROM raw_statcan_metadata WHERE source_key = N'canadian_energy_assets';
    PRINT 'Migrated canadian_energy_assets -> nrcan_cea_assets_*';
END
GO

IF OBJECT_ID('raw_statcan_data', 'U') IS NOT NULL AND OBJECT_ID('stc_capex_3410003601_data', 'U') IS NOT NULL
BEGIN
    INSERT INTO stc_capex_3410003601_data (vector, ref_date, value, source_key, fetched_at)
    SELECT vector, ref_date, value, source_key, fetched_at FROM raw_statcan_data
    WHERE source_key IN (N'capital_expenditures_raw', N'capital_expenditures');
    INSERT INTO stc_capex_3410003601_metadata (vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at)
    SELECT vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at FROM raw_statcan_metadata
    WHERE source_key IN (N'capital_expenditures_raw', N'capital_expenditures');
    PRINT 'Migrated capital_expenditures* -> stc_capex_3410003601_*';
END
GO

IF OBJECT_ID('raw_statcan_data', 'U') IS NOT NULL AND OBJECT_ID('stc_invasset_3410003601_data', 'U') IS NOT NULL
BEGIN
    INSERT INTO stc_invasset_3410003601_data (vector, ref_date, value, source_key, fetched_at)
    SELECT vector, ref_date, value, source_key, fetched_at FROM raw_statcan_data WHERE source_key = N'investment_by_asset';
    INSERT INTO stc_invasset_3410003601_metadata (vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at)
    SELECT vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at FROM raw_statcan_metadata WHERE source_key = N'investment_by_asset';
    PRINT 'Migrated investment_by_asset -> stc_invasset_3410003601_*';
END
GO

IF OBJECT_ID('raw_statcan_data', 'U') IS NOT NULL AND OBJECT_ID('stc_infra_3610060801_data', 'U') IS NOT NULL
BEGIN
    INSERT INTO stc_infra_3610060801_data (vector, ref_date, value, source_key, fetched_at)
    SELECT vector, ref_date, value, source_key, fetched_at FROM raw_statcan_data
    WHERE source_key IN (N'infrastructure_raw', N'infrastructure');
    INSERT INTO stc_infra_3610060801_metadata (vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at)
    SELECT vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at FROM raw_statcan_metadata
    WHERE source_key IN (N'infrastructure_raw', N'infrastructure');
    PRINT 'Migrated infrastructure* -> stc_infra_3610060801_*';
END
GO

IF OBJECT_ID('raw_statcan_data', 'U') IS NOT NULL AND OBJECT_ID('stc_fdi_3610000901_data', 'U') IS NOT NULL
BEGIN
    INSERT INTO stc_fdi_3610000901_data (vector, ref_date, value, source_key, fetched_at)
    SELECT vector, ref_date, value, source_key, fetched_at FROM raw_statcan_data WHERE source_key = N'international_investment';
    INSERT INTO stc_fdi_3610000901_metadata (vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at)
    SELECT vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at FROM raw_statcan_metadata WHERE source_key = N'international_investment';
    PRINT 'Migrated international_investment -> stc_fdi_3610000901_*';
END
GO

IF OBJECT_ID('raw_statcan_data', 'U') IS NOT NULL AND OBJECT_ID('stc_foreignctrl_misc_data', 'U') IS NOT NULL
BEGIN
    INSERT INTO stc_foreignctrl_misc_data (vector, ref_date, value, source_key, fetched_at)
    SELECT vector, ref_date, value, source_key, fetched_at FROM raw_statcan_data WHERE source_key = N'foreign_control';
    INSERT INTO stc_foreignctrl_misc_metadata (vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at)
    SELECT vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at FROM raw_statcan_metadata WHERE source_key = N'foreign_control';
    PRINT 'Migrated foreign_control -> stc_foreignctrl_misc_*';
END
GO

IF OBJECT_ID('raw_statcan_data', 'U') IS NOT NULL AND OBJECT_ID('stc_epes_3810013001_data', 'U') IS NOT NULL
BEGIN
    INSERT INTO stc_epes_3810013001_data (vector, ref_date, value, source_key, fetched_at)
    SELECT vector, ref_date, value, source_key, fetched_at FROM raw_statcan_data WHERE source_key = N'environmental_protection';
    INSERT INTO stc_epes_3810013001_metadata (vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at)
    SELECT vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at FROM raw_statcan_metadata WHERE source_key = N'environmental_protection';
    PRINT 'Migrated environmental_protection -> stc_epes_3810013001_*';
END
GO

IF OBJECT_ID('raw_statcan_data', 'U') IS NOT NULL AND OBJECT_ID('nrcan_majorproj_semantic_data', 'U') IS NOT NULL
BEGIN
    INSERT INTO nrcan_majorproj_semantic_data (vector, ref_date, value, source_key, fetched_at)
    SELECT vector, ref_date, value, source_key, fetched_at FROM raw_statcan_data WHERE source_key = N'major_projects';
    INSERT INTO nrcan_majorproj_semantic_metadata (vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at)
    SELECT vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at FROM raw_statcan_metadata WHERE source_key = N'major_projects';
    PRINT 'Migrated major_projects -> nrcan_majorproj_semantic_*';
END
GO

IF OBJECT_ID('raw_statcan_data', 'U') IS NOT NULL AND OBJECT_ID('nrcan_cleantech_semantic_data', 'U') IS NOT NULL
BEGIN
    INSERT INTO nrcan_cleantech_semantic_data (vector, ref_date, value, source_key, fetched_at)
    SELECT vector, ref_date, value, source_key, fetched_at FROM raw_statcan_data WHERE source_key = N'clean_tech';
    INSERT INTO nrcan_cleantech_semantic_metadata (vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at)
    SELECT vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at FROM raw_statcan_metadata WHERE source_key = N'clean_tech';
    PRINT 'Migrated clean_tech -> nrcan_cleantech_semantic_*';
END
GO

IF OBJECT_ID('raw_statcan_data', 'U') IS NOT NULL AND OBJECT_ID('nrcan_cleanenv_semantic_data', 'U') IS NOT NULL
BEGIN
    INSERT INTO nrcan_cleanenv_semantic_data (vector, ref_date, value, source_key, fetched_at)
    SELECT vector, ref_date, value, source_key, fetched_at FROM raw_statcan_data WHERE source_key = N'environmental_clean_tech';
    INSERT INTO nrcan_cleanenv_semantic_metadata (vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at)
    SELECT vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at FROM raw_statcan_metadata WHERE source_key = N'environmental_clean_tech';
    PRINT 'Migrated environmental_clean_tech -> nrcan_cleanenv_semantic_*';
END
GO

IF OBJECT_ID('raw_statcan_data', 'U') IS NOT NULL AND OBJECT_ID('nrcan_oee_neud_data', 'U') IS NOT NULL
BEGIN
    INSERT INTO nrcan_oee_neud_data (vector, ref_date, value, source_key, fetched_at)
    SELECT vector, ref_date, value, source_key, fetched_at FROM raw_statcan_data WHERE source_key = N'energy_use';
    INSERT INTO nrcan_oee_neud_metadata (vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at)
    SELECT vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at FROM raw_statcan_metadata WHERE source_key = N'energy_use';
    PRINT 'Migrated energy_use -> nrcan_oee_neud_*';
END
GO

IF OBJECT_ID('raw_statcan_data', 'U') IS NOT NULL AND OBJECT_ID('nrcan_oee_res_pie_data', 'U') IS NOT NULL
BEGIN
    INSERT INTO nrcan_oee_res_pie_data (vector, ref_date, value, source_key, fetched_at)
    SELECT vector, ref_date, value, source_key, fetched_at FROM raw_statcan_data WHERE source_key = N'residential_pie_charts';
    INSERT INTO nrcan_oee_res_pie_metadata (vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at)
    SELECT vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at FROM raw_statcan_metadata WHERE source_key = N'residential_pie_charts';
    PRINT 'Migrated residential_pie_charts -> nrcan_oee_res_pie_*';
END
GO

IF OBJECT_ID('raw_statcan_data', 'U') IS NOT NULL AND OBJECT_ID('nrcan_oee_res_daily_data', 'U') IS NOT NULL
BEGIN
    INSERT INTO nrcan_oee_res_daily_data (vector, ref_date, value, source_key, fetched_at)
    SELECT vector, ref_date, value, source_key, fetched_at FROM raw_statcan_data WHERE source_key = N'residential_daily_lives';
    INSERT INTO nrcan_oee_res_daily_metadata (vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at)
    SELECT vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at FROM raw_statcan_metadata WHERE source_key = N'residential_daily_lives';
    PRINT 'Migrated residential_daily_lives -> nrcan_oee_res_daily_*';
END
GO

IF OBJECT_ID('raw_statcan_data', 'U') IS NOT NULL AND OBJECT_ID('nrcan_oee_commercial_data', 'U') IS NOT NULL
BEGIN
    INSERT INTO nrcan_oee_commercial_data (vector, ref_date, value, source_key, fetched_at)
    SELECT vector, ref_date, value, source_key, fetched_at FROM raw_statcan_data WHERE source_key = N'commercial_institutional';
    INSERT INTO nrcan_oee_commercial_metadata (vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at)
    SELECT vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at FROM raw_statcan_metadata WHERE source_key = N'commercial_institutional';
    PRINT 'Migrated commercial_institutional -> nrcan_oee_commercial_*';
END
GO

IF OBJECT_ID('raw_statcan_data', 'U') IS NOT NULL AND OBJECT_ID('nrcan_oee_seu_data', 'U') IS NOT NULL
BEGIN
    INSERT INTO nrcan_oee_seu_data (vector, ref_date, value, source_key, fetched_at)
    SELECT vector, ref_date, value, source_key, fetched_at FROM raw_statcan_data WHERE source_key = N'seu_by_fuel';
    INSERT INTO nrcan_oee_seu_metadata (vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at)
    SELECT vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at FROM raw_statcan_metadata WHERE source_key = N'seu_by_fuel';
    PRINT 'Migrated seu_by_fuel -> nrcan_oee_seu_*';
END
GO

IF OBJECT_ID('raw_statcan_data', 'U') IS NOT NULL AND OBJECT_ID('nrcan_ghg_semantic_data', 'U') IS NOT NULL
BEGIN
    INSERT INTO nrcan_ghg_semantic_data (vector, ref_date, value, source_key, fetched_at)
    SELECT vector, ref_date, value, source_key, fetched_at FROM raw_statcan_data WHERE source_key = N'ghg_emissions';
    INSERT INTO nrcan_ghg_semantic_metadata (vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at)
    SELECT vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at FROM raw_statcan_metadata WHERE source_key = N'ghg_emissions';
    PRINT 'Migrated ghg_emissions -> nrcan_ghg_semantic_*';
END
GO

IF OBJECT_ID('raw_statcan_data', 'U') IS NOT NULL AND OBJECT_ID('nrcan_fb_skills_placeholder_data', 'U') IS NOT NULL
BEGIN
    INSERT INTO nrcan_fb_skills_placeholder_data (vector, ref_date, value, source_key, fetched_at)
    SELECT vector, ref_date, value, source_key, fetched_at FROM raw_statcan_data WHERE source_key = N'skills_data';
    INSERT INTO nrcan_fb_skills_placeholder_metadata (vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at)
    SELECT vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at FROM raw_statcan_metadata WHERE source_key = N'skills_data';
    PRINT 'Migrated skills_data -> nrcan_fb_skills_placeholder_*';
END
GO

IF OBJECT_ID('raw_statcan_data', 'U') IS NOT NULL AND OBJECT_ID('nrcan_fb_cleanpower_placeholder_data', 'U') IS NOT NULL
BEGIN
    INSERT INTO nrcan_fb_cleanpower_placeholder_data (vector, ref_date, value, source_key, fetched_at)
    SELECT vector, ref_date, value, source_key, fetched_at FROM raw_statcan_data WHERE source_key = N'clean_power_data';
    INSERT INTO nrcan_fb_cleanpower_placeholder_metadata (vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at)
    SELECT vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at FROM raw_statcan_metadata WHERE source_key = N'clean_power_data';
    PRINT 'Migrated clean_power_data -> nrcan_fb_cleanpower_placeholder_*';
END
GO

IF OBJECT_ID('raw_statcan_data', 'U') IS NOT NULL AND OBJECT_ID('nrcan_fb_oilgas_placeholder_data', 'U') IS NOT NULL
BEGIN
    INSERT INTO nrcan_fb_oilgas_placeholder_data (vector, ref_date, value, source_key, fetched_at)
    SELECT vector, ref_date, value, source_key, fetched_at FROM raw_statcan_data WHERE source_key = N'oil_gas_data';
    INSERT INTO nrcan_fb_oilgas_placeholder_metadata (vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at)
    SELECT vector, title, uom, scalar_factor, source_org, source_url, source_key, fetched_at FROM raw_statcan_metadata WHERE source_key = N'oil_gas_data';
    PRINT 'Migrated oil_gas_data -> nrcan_fb_oilgas_placeholder_*';
END
GO

-- ---------------------------------------------------------------------------
-- Calculated tables
-- ---------------------------------------------------------------------------

IF OBJECT_ID('calc_capital_expenditures', 'U') IS NOT NULL AND OBJECT_ID('nrcan_fb_s2_capital_expenditures', 'U') IS NOT NULL
BEGIN
    INSERT INTO nrcan_fb_s2_capital_expenditures (ref_year, oil_gas, electricity, other_energy, total, calculated_at)
    SELECT ref_year, oil_gas, electricity, other_energy, total, calculated_at FROM calc_capital_expenditures;
    PRINT 'Migrated calc_capital_expenditures -> nrcan_fb_s2_capital_expenditures';
END
GO

IF OBJECT_ID('calc_infrastructure', 'U') IS NOT NULL AND OBJECT_ID('nrcan_fb_s2_infrastructure', 'U') IS NOT NULL
BEGIN
    INSERT INTO nrcan_fb_s2_infrastructure (ref_year, fuel_energy_pipelines, transport, education, health_housing, environmental, public_safety, total, calculated_at)
    SELECT ref_year, fuel_energy_pipelines, transport, education, health_housing, environmental, public_safety, total, calculated_at FROM calc_infrastructure;
    PRINT 'Migrated calc_infrastructure -> nrcan_fb_s2_infrastructure';
END
GO

IF OBJECT_ID('calc_economic_contributions', 'U') IS NOT NULL AND OBJECT_ID('nrcan_fb_s1_economic_contributions', 'U') IS NOT NULL
BEGIN
    INSERT INTO nrcan_fb_s1_economic_contributions (ref_year, gdp_direct, gdp_indirect, gdp_total, jobs_direct, jobs_indirect, jobs_total, income_direct, income_indirect, income_total, calculated_at)
    SELECT ref_year, gdp_direct, gdp_indirect, gdp_total, jobs_direct, jobs_indirect, jobs_total, income_direct, income_indirect, income_total, calculated_at FROM calc_economic_contributions;
    PRINT 'Migrated calc_economic_contributions -> nrcan_fb_s1_economic_contributions';
END
GO

IF OBJECT_ID('calc_environmental_protection', 'U') IS NOT NULL AND OBJECT_ID('nrcan_fb_s2_environmental_protection', 'U') IS NOT NULL
BEGIN
    INSERT INTO nrcan_fb_s2_environmental_protection (ref_year, industry_category, wastewater, soil_groundwater, air_pollution, solid_waste, other, total, calculated_at)
    SELECT ref_year, industry_category, wastewater, soil_groundwater, air_pollution, solid_waste, other, total, calculated_at FROM calc_environmental_protection;
    PRINT 'Migrated calc_environmental_protection -> nrcan_fb_s2_environmental_protection';
END
GO

IF OBJECT_ID('calc_international_investment', 'U') IS NOT NULL AND OBJECT_ID('nrcan_fb_s2_international_investment', 'U') IS NOT NULL
BEGIN
    INSERT INTO nrcan_fb_s2_international_investment (ref_year, investment_type, industry_category, value, calculated_at)
    SELECT ref_year, investment_type, industry_category, value, calculated_at FROM calc_international_investment;
    PRINT 'Migrated calc_international_investment -> nrcan_fb_s2_international_investment';
END
GO

IF OBJECT_ID('calc_provincial_gdp', 'U') IS NOT NULL AND OBJECT_ID('nrcan_fb_s1_provincial_gdp', 'U') IS NOT NULL
BEGIN
    INSERT INTO nrcan_fb_s1_provincial_gdp (ref_year, province_code, province_name, energy_gdp, total_gdp, energy_share_pct, calculated_at)
    SELECT ref_year, province_code, province_name, energy_gdp, total_gdp, energy_share_pct, calculated_at FROM calc_provincial_gdp;
    PRINT 'Migrated calc_provincial_gdp -> nrcan_fb_s1_provincial_gdp';
END
GO

IF OBJECT_ID('calc_world_energy_production', 'U') IS NOT NULL AND OBJECT_ID('nrcan_fb_s1_world_energy_production', 'U') IS NOT NULL
BEGIN
    INSERT INTO nrcan_fb_s1_world_energy_production (ref_year, country_code, country_name, energy_type, production_value, unit, global_rank, calculated_at)
    SELECT ref_year, country_code, country_name, energy_type, production_value, unit, global_rank, calculated_at FROM calc_world_energy_production;
    PRINT 'Migrated calc_world_energy_production -> nrcan_fb_s1_world_energy_production';
END
GO

IF OBJECT_ID('calc_clean_tech', 'U') IS NOT NULL AND OBJECT_ID('nrcan_fb_s2_clean_tech', 'U') IS NOT NULL
BEGIN
    INSERT INTO nrcan_fb_s2_clean_tech (ref_year, category, project_count, total_investment, calculated_at)
    SELECT ref_year, category, project_count, total_investment, calculated_at FROM calc_clean_tech;
    PRINT 'Migrated calc_clean_tech -> nrcan_fb_s2_clean_tech';
END
GO

IF OBJECT_ID('calc_energy_use', 'U') IS NOT NULL AND OBJECT_ID('nrcan_fb_s4_energy_use', 'U') IS NOT NULL
BEGIN
    INSERT INTO nrcan_fb_s4_energy_use (ref_year, R, C, I, T, A, P, NPC, FK, EL, calculated_at)
    SELECT ref_year, R, C, I, T, A, P, NPC, FK, EL, calculated_at FROM calc_energy_use;
    PRINT 'Migrated calc_energy_use -> nrcan_fb_s4_energy_use';
END
GO

-- ---------------------------------------------------------------------------
-- Export + system
-- ---------------------------------------------------------------------------

IF OBJECT_ID('nrcan_fb_export_data', 'U') IS NOT NULL
   AND OBJECT_ID('nrcan_fb_export_metadata', 'U') IS NOT NULL
   AND (OBJECT_ID('export_data', 'U') IS NOT NULL OR OBJECT_ID('export_metadata', 'U') IS NOT NULL)
BEGIN
    DELETE FROM nrcan_fb_export_data;
    DELETE FROM nrcan_fb_export_metadata;
    IF OBJECT_ID('export_data', 'U') IS NOT NULL
        INSERT INTO nrcan_fb_export_data (vector, ref_date, value)
        SELECT vector, ref_date, value FROM export_data;
    IF OBJECT_ID('export_metadata', 'U') IS NOT NULL
        INSERT INTO nrcan_fb_export_metadata (vector, title, uom, scalar_factor, source_org, source_url)
        SELECT vector, title, uom, scalar_factor, source_org, source_url FROM export_metadata;
    PRINT 'Migrated export_data / export_metadata -> nrcan_fb_export_*';
END
GO

IF OBJECT_ID('data_sources', 'U') IS NOT NULL AND OBJECT_ID('nrcan_fb_data_sources', 'U') IS NOT NULL
BEGIN
    -- Remove default seed rows from a fresh setup_database.sql run so legacy IDs fit.
    DELETE FROM nrcan_fb_data_sources;
    SET IDENTITY_INSERT nrcan_fb_data_sources ON;
    INSERT INTO nrcan_fb_data_sources (source_id, source_key, source_name, section_id, section_name, statcan_table_id, source_url, is_enabled, last_refresh_at, created_at, updated_at)
    SELECT source_id, source_key, source_name, section_id, section_name, statcan_table_id, source_url, is_enabled, last_refresh_at, created_at, updated_at FROM data_sources;
    SET IDENTITY_INSERT nrcan_fb_data_sources OFF;
    PRINT 'Migrated data_sources -> nrcan_fb_data_sources';
END
GO

IF OBJECT_ID('run_history', 'U') IS NOT NULL AND OBJECT_ID('nrcan_fb_run_history', 'U') IS NOT NULL
BEGIN
    SET IDENTITY_INSERT nrcan_fb_run_history ON;
    INSERT INTO nrcan_fb_run_history (run_id, source_key, run_type, status, rows_affected, error_message, started_at, completed_at)
    SELECT run_id, source_key, run_type, status, rows_affected, error_message, started_at, completed_at FROM run_history;
    SET IDENTITY_INSERT nrcan_fb_run_history OFF;
    PRINT 'Migrated run_history -> nrcan_fb_run_history';
END
GO

IF OBJECT_ID('raw_major_projects_map', 'U') IS NOT NULL AND OBJECT_ID('nrcan_fb_major_projects_map', 'U') IS NOT NULL
BEGIN
    DELETE FROM nrcan_fb_major_projects_map;
    SET IDENTITY_INSERT nrcan_fb_major_projects_map ON;
    INSERT INTO nrcan_fb_major_projects_map (id, lang, feature_id, company, project_name, province, location, capital_cost, capital_cost_range, status, clean_technology, clean_technology_type, line_type, lat, lon, paths, feature_type, fetched_at)
    SELECT id, lang, feature_id, company, project_name, province, location, capital_cost, capital_cost_range, status, clean_technology, clean_technology_type, line_type, lat, lon, paths, feature_type, fetched_at FROM raw_major_projects_map;
    SET IDENTITY_INSERT nrcan_fb_major_projects_map OFF;
    PRINT 'Migrated raw_major_projects_map -> nrcan_fb_major_projects_map';
END
GO

PRINT 'EEDAS legacy migration pass complete. Verify row counts, then drop legacy tables in a controlled window.';
GO
