"""
Source-to-vector mapping for selective exports.

Maps data sources to the vector prefixes they produce, enabling targeted exports.
"""

# Vector prefix to data source mapping
SOURCE_VECTOR_PREFIXES = {
    'economic_contributions': ['econ_'],
    'nominal_gdp': ['gdp_nominal_'],
    'provincial_gdp': ['gdp_prov_'],
    'world_energy_production': ['energy_prod_'],
    'canadian_energy_assets': ['cea_'],
    'capital_expenditures': ['capex_'],
    'infrastructure': ['infra_'],
    'investment_by_asset': ['asset_'],
    'international_investment': ['intl_'],
    'foreign_control': ['foreign_'],
    'environmental_protection': ['enviro_'],
    'major_projects': ['projects_'],
    'cleantech_companies_geo': ['cleantech_geo_'],
    'cleantech_companies_industry': ['cleantech_ind_'],
    'clean_tech': ['cleantech_'],
    'environmental_clean_tech': ['envcleantech_'],
    'ghg_emissions': ['ghg_'],
    'energy_use': ['oee_neud_'],
    'seu_by_fuel': ['seu_'],
    'residential_daily_lives': ['res_'],
    'residential_pie_charts': ['res_'],
    'commercial_institutional': ['com_'],
    'industrial_sector': ['ind_'],
    'rpp_supply_demand': [
        'rpp_net_prod_', 'rpp_imports_', 'rpp_exports_', 'rpp_domestic_',
        'rpp_motor_', 'rpp_distillate_', 'rpp_still_gas_', 'rpp_jet_',
        'rpp_coke_', 'rpp_residual_', 'rpp_asphalt_', 'rpp_other_',
    ],
    'rpp_refinery_input': ['rpp_refinery_'],
    'crude_prices': ['crude_'],
    'oil_sands': ['os_'],
    'canadian_production': ['cp_'],
    'ev_sales': ['ev_'],
    'electricity_generation_by_source': ['elegen_'],
    'electricity_trade_us': ['elec_trade_'],
    'wind_capacity_by_province': ['wind_cap_'],
    'wind_power_canada': ['win_pwr_'],
    'world_wind_power': ['win_world_', 'win_can_wind_'],
    'world_solar_pv': ['sol_world_'],
    'renewable_electricity_capacity': ['ren_cap_'],
    'ghg_electricity_spotlight': ['elec_ghg_'],
    'largest_wind_projects': ['wind_proj_'],
    'largest_solar_projects': ['solar_proj_'],
    'major_hydro_facilities': ['hydro_fac_'],
    'solid_biofuels': ['sbio_'],
    'electrical_energy_use': ['elec_eu_'],
    'electricity_prices': ['elec_price_'],
    'wind_solar_electricity_growth': ['ws_elec_'],
    'kal_gas_prices': ['kal_'],
    'osm_refin_cap': ['refcap_'],
    'petroleum_reserves': ['cr_res_'],
    'western_canada_oil_wells': ['wc_oil_'],
    'petroleum_sector_employment': ['pet_emp_'],
    'world_proved_crude_reserves': ['wr_crude_res_'],
}

# Source name to display name mapping (human-readable)
SOURCE_DISPLAY_NAMES = {
    'economic_contributions': 'Economic Contributions',
    'nominal_gdp': 'Nominal GDP',
    'provincial_gdp': 'Provincial GDP',
    'world_energy_production': 'World Energy Production',
    'canadian_energy_assets': 'Canadian Energy Assets',
    'capital_expenditures': 'Capital Expenditures',
    'infrastructure': 'Infrastructure',
    'investment_by_asset': 'Investment by Asset',
    'international_investment': 'International Investment',
    'foreign_control': 'Foreign Control',
    'environmental_protection': 'Environmental Protection',
    'major_projects': 'Major Projects',
    'clean_tech': 'Clean Technology',
    'environmental_clean_tech': 'Environmental and Clean Technology',
    'cleantech_companies_geo': 'Cleantech companies by province and region',
    'cleantech_companies_industry': 'Cleantech companies by industry',
    'ghg_emissions': 'GHG Emissions by Economic Sector',
    'energy_use': 'Energy Use (OEE NEUD)',
    'seu_by_fuel': 'Secondary energy use by fuel type (SEU final demand)',
    'residential_daily_lives': 'Residential energy (energy in our daily lives)',
    'residential_pie_charts': 'Residential pie charts (by type, space/water heating by source)',
    'commercial_institutional': 'Commercial and institutional energy use by end use',
    'industrial_sector': 'Industrial sector energy use by fuel type',
    'rpp_supply_demand': 'RPP supply and disposition',
    'rpp_refinery_input': 'Refinery input',
    'crude_prices': 'WTI and WCS crude prices',
    'oil_sands': 'Oil sands capex and production share',
    'canadian_production': 'Canadian crude production by type and province',
    'ev_sales': 'Plug-in electric vehicle registrations',
    'electricity_generation_by_source': 'Canadian and provincial electricity generation by source',
    'electricity_trade_us': 'Electricity trade with the U.S.',
    'wind_capacity_by_province': 'Wind capacity by province',
    'wind_power_canada': 'Wind power in Canada',
    'renewable_electricity_capacity': 'Canadian renewable electricity generating capacity',
    'ghg_electricity_spotlight': 'GHG spotlight: electricity',
    'largest_wind_projects': 'Largest wind projects (200 MW+)',
    'largest_solar_projects': 'Largest solar projects (50 MW+)',
    'major_hydro_facilities': 'Major hydro facilities in Canada (1,000 MW+)',
    'solid_biofuels': 'Canadian production of solid biofuels',
    'electrical_energy_use': 'Electrical energy use by sector and province',
    'electricity_prices': 'Average large industrial and residential electricity prices',
    'wind_solar_electricity_growth': 'Wind and solar net electricity generation growth in Canada',
    'kal_gas_prices': 'Gasoline retail price components (Kalibrate)',
    'osm_refin_cap': 'Canadian refinery capacity (Oil Sands Magazine)',
    'petroleum_reserves': 'Canadian proved reserves of crude oil',
    'western_canada_oil_wells': 'Western Canada oil wells completed',
    'petroleum_sector_employment': 'Petroleum sector employment by region',
    'world_proved_crude_reserves': 'World proved reserves of crude oil',
}


def get_source_for_vector(vector: str) -> str:
    """
    Get the data source name for a vector based on its prefix.
    
    Args:
        vector: Vector name (e.g., 'capex_oil_gas')
        
    Returns:
        Source name (e.g., 'capital_expenditures') or 'unknown'
    """
    for source, prefixes in SOURCE_VECTOR_PREFIXES.items():
        for prefix in prefixes:
            if vector.startswith(prefix):
                return source
    return 'unknown'


def get_display_name_for_vector(vector: str) -> str:
    """
    Get the human-readable data source name for a vector.
    
    Args:
        vector: Vector name (e.g., 'capex_oil_gas')
        
    Returns:
        Display name (e.g., 'Capital Expenditures') or 'Unknown'
    """
    source = get_source_for_vector(vector)
    return SOURCE_DISPLAY_NAMES.get(source, 'Unknown')


def get_vectors_for_source(source_key: str) -> list:
    """
    Get vector prefixes for a data source.
    
    Args:
        source_key: Data source name (e.g., 'capital_expenditures')
        
    Returns:
        List of vector prefixes (e.g., ['capex_'])
    """
    return SOURCE_VECTOR_PREFIXES.get(source_key, [])


def get_all_sources() -> list:
    """Get list of all data source names."""
    return sorted(SOURCE_VECTOR_PREFIXES.keys())


def match_vector_pattern(vector: str, pattern: str) -> bool:
    """
    Check if a vector matches a glob-like pattern.
    
    Supports:
    - Exact match: 'capex_total'
    - Prefix match with *: 'capex_*'
    - Suffix match with *: '*_total'
    - Contains with *: '*gdp*'
    
    Args:
        vector: Vector name to check
        pattern: Pattern to match against
        
    Returns:
        True if vector matches pattern
    """
    import fnmatch
    return fnmatch.fnmatch(vector, pattern)


def filter_vectors_by_pattern(vectors: list, pattern: str) -> list:
    """
    Filter a list of vectors by a glob pattern.
    
    Args:
        vectors: List of vector names
        pattern: Glob pattern (e.g., 'capex_*', '*_total')
        
    Returns:
        Filtered list of vectors
    """
    return [v for v in vectors if match_vector_pattern(v, pattern)]
