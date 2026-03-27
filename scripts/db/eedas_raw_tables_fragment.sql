-- EEDAS per-source raw / semantic ingest tables (generated from eedas_registry.yaml)
-- Regenerate: python scripts/db/_gen_eedas_raw_sql.py

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'iea_web_rankings_data')
BEGIN
    CREATE TABLE iea_web_rankings_data (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_iea_web_rankings_data_vd UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_iea_web_rankings_data_vector ON iea_web_rankings_data(vector);
    CREATE INDEX IX_iea_web_rankings_data_source ON iea_web_rankings_data(source_key);
    CREATE INDEX IX_iea_web_rankings_data_ref_date ON iea_web_rankings_data(ref_date);
    PRINT 'Table iea_web_rankings_data created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_cea_assets_data')
BEGIN
    CREATE TABLE nrcan_cea_assets_data (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_nrcan_cea_assets_data_vd UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_cea_assets_data_vector ON nrcan_cea_assets_data(vector);
    CREATE INDEX IX_nrcan_cea_assets_data_source ON nrcan_cea_assets_data(source_key);
    CREATE INDEX IX_nrcan_cea_assets_data_ref_date ON nrcan_cea_assets_data(ref_date);
    PRINT 'Table nrcan_cea_assets_data created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_cleanenv_semantic_data')
BEGIN
    CREATE TABLE nrcan_cleanenv_semantic_data (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_nrcan_cleanenv_semantic_data_vd UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_cleanenv_semantic_data_vector ON nrcan_cleanenv_semantic_data(vector);
    CREATE INDEX IX_nrcan_cleanenv_semantic_data_source ON nrcan_cleanenv_semantic_data(source_key);
    CREATE INDEX IX_nrcan_cleanenv_semantic_data_ref_date ON nrcan_cleanenv_semantic_data(ref_date);
    PRINT 'Table nrcan_cleanenv_semantic_data created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_cleantech_semantic_data')
BEGIN
    CREATE TABLE nrcan_cleantech_semantic_data (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_nrcan_cleantech_semantic_data_vd UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_cleantech_semantic_data_vector ON nrcan_cleantech_semantic_data(vector);
    CREATE INDEX IX_nrcan_cleantech_semantic_data_source ON nrcan_cleantech_semantic_data(source_key);
    CREATE INDEX IX_nrcan_cleantech_semantic_data_ref_date ON nrcan_cleantech_semantic_data(ref_date);
    PRINT 'Table nrcan_cleantech_semantic_data created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_fb_cleanpower_placeholder_data')
BEGIN
    CREATE TABLE nrcan_fb_cleanpower_placeholder_data (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_nrcan_fb_cleanpower_placeholder_data_vd UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_fb_cleanpower_placeholder_data_vector ON nrcan_fb_cleanpower_placeholder_data(vector);
    CREATE INDEX IX_nrcan_fb_cleanpower_placeholder_data_source ON nrcan_fb_cleanpower_placeholder_data(source_key);
    CREATE INDEX IX_nrcan_fb_cleanpower_placeholder_data_ref_date ON nrcan_fb_cleanpower_placeholder_data(ref_date);
    PRINT 'Table nrcan_fb_cleanpower_placeholder_data created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_fb_oilgas_placeholder_data')
BEGIN
    CREATE TABLE nrcan_fb_oilgas_placeholder_data (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_nrcan_fb_oilgas_placeholder_data_vd UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_fb_oilgas_placeholder_data_vector ON nrcan_fb_oilgas_placeholder_data(vector);
    CREATE INDEX IX_nrcan_fb_oilgas_placeholder_data_source ON nrcan_fb_oilgas_placeholder_data(source_key);
    CREATE INDEX IX_nrcan_fb_oilgas_placeholder_data_ref_date ON nrcan_fb_oilgas_placeholder_data(ref_date);
    PRINT 'Table nrcan_fb_oilgas_placeholder_data created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_fb_skills_placeholder_data')
BEGIN
    CREATE TABLE nrcan_fb_skills_placeholder_data (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_nrcan_fb_skills_placeholder_data_vd UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_fb_skills_placeholder_data_vector ON nrcan_fb_skills_placeholder_data(vector);
    CREATE INDEX IX_nrcan_fb_skills_placeholder_data_source ON nrcan_fb_skills_placeholder_data(source_key);
    CREATE INDEX IX_nrcan_fb_skills_placeholder_data_ref_date ON nrcan_fb_skills_placeholder_data(ref_date);
    PRINT 'Table nrcan_fb_skills_placeholder_data created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_ghg_semantic_data')
BEGIN
    CREATE TABLE nrcan_ghg_semantic_data (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_nrcan_ghg_semantic_data_vd UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_ghg_semantic_data_vector ON nrcan_ghg_semantic_data(vector);
    CREATE INDEX IX_nrcan_ghg_semantic_data_source ON nrcan_ghg_semantic_data(source_key);
    CREATE INDEX IX_nrcan_ghg_semantic_data_ref_date ON nrcan_ghg_semantic_data(ref_date);
    PRINT 'Table nrcan_ghg_semantic_data created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_majorproj_semantic_data')
BEGIN
    CREATE TABLE nrcan_majorproj_semantic_data (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_nrcan_majorproj_semantic_data_vd UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_majorproj_semantic_data_vector ON nrcan_majorproj_semantic_data(vector);
    CREATE INDEX IX_nrcan_majorproj_semantic_data_source ON nrcan_majorproj_semantic_data(source_key);
    CREATE INDEX IX_nrcan_majorproj_semantic_data_ref_date ON nrcan_majorproj_semantic_data(ref_date);
    PRINT 'Table nrcan_majorproj_semantic_data created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_oee_commercial_data')
BEGIN
    CREATE TABLE nrcan_oee_commercial_data (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_nrcan_oee_commercial_data_vd UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_oee_commercial_data_vector ON nrcan_oee_commercial_data(vector);
    CREATE INDEX IX_nrcan_oee_commercial_data_source ON nrcan_oee_commercial_data(source_key);
    CREATE INDEX IX_nrcan_oee_commercial_data_ref_date ON nrcan_oee_commercial_data(ref_date);
    PRINT 'Table nrcan_oee_commercial_data created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_oee_neud_data')
BEGIN
    CREATE TABLE nrcan_oee_neud_data (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_nrcan_oee_neud_data_vd UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_oee_neud_data_vector ON nrcan_oee_neud_data(vector);
    CREATE INDEX IX_nrcan_oee_neud_data_source ON nrcan_oee_neud_data(source_key);
    CREATE INDEX IX_nrcan_oee_neud_data_ref_date ON nrcan_oee_neud_data(ref_date);
    PRINT 'Table nrcan_oee_neud_data created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_oee_res_daily_data')
BEGIN
    CREATE TABLE nrcan_oee_res_daily_data (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_nrcan_oee_res_daily_data_vd UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_oee_res_daily_data_vector ON nrcan_oee_res_daily_data(vector);
    CREATE INDEX IX_nrcan_oee_res_daily_data_source ON nrcan_oee_res_daily_data(source_key);
    CREATE INDEX IX_nrcan_oee_res_daily_data_ref_date ON nrcan_oee_res_daily_data(ref_date);
    PRINT 'Table nrcan_oee_res_daily_data created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_oee_res_pie_data')
BEGIN
    CREATE TABLE nrcan_oee_res_pie_data (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_nrcan_oee_res_pie_data_vd UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_oee_res_pie_data_vector ON nrcan_oee_res_pie_data(vector);
    CREATE INDEX IX_nrcan_oee_res_pie_data_source ON nrcan_oee_res_pie_data(source_key);
    CREATE INDEX IX_nrcan_oee_res_pie_data_ref_date ON nrcan_oee_res_pie_data(ref_date);
    PRINT 'Table nrcan_oee_res_pie_data created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_oee_seu_data')
BEGIN
    CREATE TABLE nrcan_oee_seu_data (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_nrcan_oee_seu_data_vd UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_nrcan_oee_seu_data_vector ON nrcan_oee_seu_data(vector);
    CREATE INDEX IX_nrcan_oee_seu_data_source ON nrcan_oee_seu_data(source_key);
    CREATE INDEX IX_nrcan_oee_seu_data_ref_date ON nrcan_oee_seu_data(ref_date);
    PRINT 'Table nrcan_oee_seu_data created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'stc_capex_3410003601_data')
BEGIN
    CREATE TABLE stc_capex_3410003601_data (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_stc_capex_3410003601_data_vd UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_stc_capex_3410003601_data_vector ON stc_capex_3410003601_data(vector);
    CREATE INDEX IX_stc_capex_3410003601_data_source ON stc_capex_3410003601_data(source_key);
    CREATE INDEX IX_stc_capex_3410003601_data_ref_date ON stc_capex_3410003601_data(ref_date);
    PRINT 'Table stc_capex_3410003601_data created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'stc_epes_3810013001_data')
BEGIN
    CREATE TABLE stc_epes_3810013001_data (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_stc_epes_3810013001_data_vd UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_stc_epes_3810013001_data_vector ON stc_epes_3810013001_data(vector);
    CREATE INDEX IX_stc_epes_3810013001_data_source ON stc_epes_3810013001_data(source_key);
    CREATE INDEX IX_stc_epes_3810013001_data_ref_date ON stc_epes_3810013001_data(ref_date);
    PRINT 'Table stc_epes_3810013001_data created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'stc_fdi_3610000901_data')
BEGIN
    CREATE TABLE stc_fdi_3610000901_data (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_stc_fdi_3610000901_data_vd UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_stc_fdi_3610000901_data_vector ON stc_fdi_3610000901_data(vector);
    CREATE INDEX IX_stc_fdi_3610000901_data_source ON stc_fdi_3610000901_data(source_key);
    CREATE INDEX IX_stc_fdi_3610000901_data_ref_date ON stc_fdi_3610000901_data(ref_date);
    PRINT 'Table stc_fdi_3610000901_data created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'stc_foreignctrl_misc_data')
BEGIN
    CREATE TABLE stc_foreignctrl_misc_data (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_stc_foreignctrl_misc_data_vd UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_stc_foreignctrl_misc_data_vector ON stc_foreignctrl_misc_data(vector);
    CREATE INDEX IX_stc_foreignctrl_misc_data_source ON stc_foreignctrl_misc_data(source_key);
    CREATE INDEX IX_stc_foreignctrl_misc_data_ref_date ON stc_foreignctrl_misc_data(ref_date);
    PRINT 'Table stc_foreignctrl_misc_data created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'stc_gdpnom_3610010301_data')
BEGIN
    CREATE TABLE stc_gdpnom_3610010301_data (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_stc_gdpnom_3610010301_data_vd UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_stc_gdpnom_3610010301_data_vector ON stc_gdpnom_3610010301_data(vector);
    CREATE INDEX IX_stc_gdpnom_3610010301_data_source ON stc_gdpnom_3610010301_data(source_key);
    CREATE INDEX IX_stc_gdpnom_3610010301_data_ref_date ON stc_gdpnom_3610010301_data(ref_date);
    PRINT 'Table stc_gdpnom_3610010301_data created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'stc_infra_3610060801_data')
BEGIN
    CREATE TABLE stc_infra_3610060801_data (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_stc_infra_3610060801_data_vd UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_stc_infra_3610060801_data_vector ON stc_infra_3610060801_data(vector);
    CREATE INDEX IX_stc_infra_3610060801_data_source ON stc_infra_3610060801_data(source_key);
    CREATE INDEX IX_stc_infra_3610060801_data_ref_date ON stc_infra_3610060801_data(ref_date);
    PRINT 'Table stc_infra_3610060801_data created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'stc_invasset_3410003601_data')
BEGIN
    CREATE TABLE stc_invasset_3410003601_data (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_stc_invasset_3410003601_data_vd UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_stc_invasset_3410003601_data_vector ON stc_invasset_3410003601_data(vector);
    CREATE INDEX IX_stc_invasset_3410003601_data_source ON stc_invasset_3410003601_data(source_key);
    CREATE INDEX IX_stc_invasset_3410003601_data_ref_date ON stc_invasset_3410003601_data(ref_date);
    PRINT 'Table stc_invasset_3410003601_data created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'stc_nrsa_3610061001_data')
BEGIN
    CREATE TABLE stc_nrsa_3610061001_data (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_stc_nrsa_3610061001_data_vd UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_stc_nrsa_3610061001_data_vector ON stc_nrsa_3610061001_data(vector);
    CREATE INDEX IX_stc_nrsa_3610061001_data_source ON stc_nrsa_3610061001_data(source_key);
    CREATE INDEX IX_stc_nrsa_3610061001_data_ref_date ON stc_nrsa_3610061001_data(ref_date);
    PRINT 'Table stc_nrsa_3610061001_data created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'stc_nrsa_3810028501_data')
BEGIN
    CREATE TABLE stc_nrsa_3810028501_data (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL,
        ref_date NVARCHAR(20) NOT NULL,
        value DECIMAL(18,4) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_stc_nrsa_3810028501_data_vd UNIQUE (vector, ref_date)
    );
    CREATE INDEX IX_stc_nrsa_3810028501_data_vector ON stc_nrsa_3810028501_data(vector);
    CREATE INDEX IX_stc_nrsa_3810028501_data_source ON stc_nrsa_3810028501_data(source_key);
    CREATE INDEX IX_stc_nrsa_3810028501_data_ref_date ON stc_nrsa_3810028501_data(ref_date);
    PRINT 'Table stc_nrsa_3810028501_data created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'iea_web_rankings_metadata')
BEGIN
    CREATE TABLE iea_web_rankings_metadata (
        id INT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL UNIQUE,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_iea_web_rankings_metadata_source ON iea_web_rankings_metadata(source_key);
    PRINT 'Table iea_web_rankings_metadata created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_cea_assets_metadata')
BEGIN
    CREATE TABLE nrcan_cea_assets_metadata (
        id INT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL UNIQUE,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_nrcan_cea_assets_metadata_source ON nrcan_cea_assets_metadata(source_key);
    PRINT 'Table nrcan_cea_assets_metadata created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_cleanenv_semantic_metadata')
BEGIN
    CREATE TABLE nrcan_cleanenv_semantic_metadata (
        id INT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL UNIQUE,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_nrcan_cleanenv_semantic_metadata_source ON nrcan_cleanenv_semantic_metadata(source_key);
    PRINT 'Table nrcan_cleanenv_semantic_metadata created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_cleantech_semantic_metadata')
BEGIN
    CREATE TABLE nrcan_cleantech_semantic_metadata (
        id INT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL UNIQUE,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_nrcan_cleantech_semantic_metadata_source ON nrcan_cleantech_semantic_metadata(source_key);
    PRINT 'Table nrcan_cleantech_semantic_metadata created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_fb_cleanpower_placeholder_metadata')
BEGIN
    CREATE TABLE nrcan_fb_cleanpower_placeholder_metadata (
        id INT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL UNIQUE,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_nrcan_fb_cleanpower_placeholder_metadata_source ON nrcan_fb_cleanpower_placeholder_metadata(source_key);
    PRINT 'Table nrcan_fb_cleanpower_placeholder_metadata created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_fb_oilgas_placeholder_metadata')
BEGIN
    CREATE TABLE nrcan_fb_oilgas_placeholder_metadata (
        id INT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL UNIQUE,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_nrcan_fb_oilgas_placeholder_metadata_source ON nrcan_fb_oilgas_placeholder_metadata(source_key);
    PRINT 'Table nrcan_fb_oilgas_placeholder_metadata created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_fb_skills_placeholder_metadata')
BEGIN
    CREATE TABLE nrcan_fb_skills_placeholder_metadata (
        id INT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL UNIQUE,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_nrcan_fb_skills_placeholder_metadata_source ON nrcan_fb_skills_placeholder_metadata(source_key);
    PRINT 'Table nrcan_fb_skills_placeholder_metadata created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_ghg_semantic_metadata')
BEGIN
    CREATE TABLE nrcan_ghg_semantic_metadata (
        id INT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL UNIQUE,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_nrcan_ghg_semantic_metadata_source ON nrcan_ghg_semantic_metadata(source_key);
    PRINT 'Table nrcan_ghg_semantic_metadata created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_majorproj_semantic_metadata')
BEGIN
    CREATE TABLE nrcan_majorproj_semantic_metadata (
        id INT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL UNIQUE,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_nrcan_majorproj_semantic_metadata_source ON nrcan_majorproj_semantic_metadata(source_key);
    PRINT 'Table nrcan_majorproj_semantic_metadata created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_oee_commercial_metadata')
BEGIN
    CREATE TABLE nrcan_oee_commercial_metadata (
        id INT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL UNIQUE,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_nrcan_oee_commercial_metadata_source ON nrcan_oee_commercial_metadata(source_key);
    PRINT 'Table nrcan_oee_commercial_metadata created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_oee_neud_metadata')
BEGIN
    CREATE TABLE nrcan_oee_neud_metadata (
        id INT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL UNIQUE,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_nrcan_oee_neud_metadata_source ON nrcan_oee_neud_metadata(source_key);
    PRINT 'Table nrcan_oee_neud_metadata created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_oee_res_daily_metadata')
BEGIN
    CREATE TABLE nrcan_oee_res_daily_metadata (
        id INT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL UNIQUE,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_nrcan_oee_res_daily_metadata_source ON nrcan_oee_res_daily_metadata(source_key);
    PRINT 'Table nrcan_oee_res_daily_metadata created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_oee_res_pie_metadata')
BEGIN
    CREATE TABLE nrcan_oee_res_pie_metadata (
        id INT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL UNIQUE,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_nrcan_oee_res_pie_metadata_source ON nrcan_oee_res_pie_metadata(source_key);
    PRINT 'Table nrcan_oee_res_pie_metadata created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'nrcan_oee_seu_metadata')
BEGIN
    CREATE TABLE nrcan_oee_seu_metadata (
        id INT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL UNIQUE,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_nrcan_oee_seu_metadata_source ON nrcan_oee_seu_metadata(source_key);
    PRINT 'Table nrcan_oee_seu_metadata created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'stc_capex_3410003601_metadata')
BEGIN
    CREATE TABLE stc_capex_3410003601_metadata (
        id INT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL UNIQUE,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_stc_capex_3410003601_metadata_source ON stc_capex_3410003601_metadata(source_key);
    PRINT 'Table stc_capex_3410003601_metadata created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'stc_epes_3810013001_metadata')
BEGIN
    CREATE TABLE stc_epes_3810013001_metadata (
        id INT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL UNIQUE,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_stc_epes_3810013001_metadata_source ON stc_epes_3810013001_metadata(source_key);
    PRINT 'Table stc_epes_3810013001_metadata created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'stc_fdi_3610000901_metadata')
BEGIN
    CREATE TABLE stc_fdi_3610000901_metadata (
        id INT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL UNIQUE,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_stc_fdi_3610000901_metadata_source ON stc_fdi_3610000901_metadata(source_key);
    PRINT 'Table stc_fdi_3610000901_metadata created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'stc_foreignctrl_misc_metadata')
BEGIN
    CREATE TABLE stc_foreignctrl_misc_metadata (
        id INT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL UNIQUE,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_stc_foreignctrl_misc_metadata_source ON stc_foreignctrl_misc_metadata(source_key);
    PRINT 'Table stc_foreignctrl_misc_metadata created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'stc_gdpnom_3610010301_metadata')
BEGIN
    CREATE TABLE stc_gdpnom_3610010301_metadata (
        id INT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL UNIQUE,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_stc_gdpnom_3610010301_metadata_source ON stc_gdpnom_3610010301_metadata(source_key);
    PRINT 'Table stc_gdpnom_3610010301_metadata created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'stc_infra_3610060801_metadata')
BEGIN
    CREATE TABLE stc_infra_3610060801_metadata (
        id INT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL UNIQUE,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_stc_infra_3610060801_metadata_source ON stc_infra_3610060801_metadata(source_key);
    PRINT 'Table stc_infra_3610060801_metadata created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'stc_invasset_3410003601_metadata')
BEGIN
    CREATE TABLE stc_invasset_3410003601_metadata (
        id INT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL UNIQUE,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_stc_invasset_3410003601_metadata_source ON stc_invasset_3410003601_metadata(source_key);
    PRINT 'Table stc_invasset_3410003601_metadata created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'stc_nrsa_3610061001_metadata')
BEGIN
    CREATE TABLE stc_nrsa_3610061001_metadata (
        id INT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL UNIQUE,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_stc_nrsa_3610061001_metadata_source ON stc_nrsa_3610061001_metadata(source_key);
    PRINT 'Table stc_nrsa_3610061001_metadata created.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'stc_nrsa_3810028501_metadata')
BEGIN
    CREATE TABLE stc_nrsa_3810028501_metadata (
        id INT IDENTITY(1,1) PRIMARY KEY,
        vector NVARCHAR(50) NOT NULL UNIQUE,
        title NVARCHAR(500) NULL,
        uom NVARCHAR(100) NULL,
        scalar_factor NVARCHAR(50) NULL,
        source_org NVARCHAR(255) NULL,
        source_url NVARCHAR(1000) NULL,
        source_key NVARCHAR(100) NOT NULL,
        fetched_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_stc_nrsa_3810028501_metadata_source ON stc_nrsa_3810028501_metadata(source_key);
    PRINT 'Table stc_nrsa_3810028501_metadata created.';
END
GO
