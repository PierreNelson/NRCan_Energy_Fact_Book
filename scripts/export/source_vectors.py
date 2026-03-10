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
    'clean_tech': ['cleantech_'],
    'environmental_clean_tech': ['envcleantech_'],
    'ghg_emissions': ['ghg_'],
    'energy_use': ['oee_neud_'],
    'seu_by_fuel': ['seu_'],
    'residential_daily_lives': ['res_'],
    'residential_pie_charts': ['res_'],
    'commercial_institutional': ['com_'],
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
    'ghg_emissions': 'GHG Emissions by Economic Sector',
    'energy_use': 'Energy Use (OEE NEUD)',
    'seu_by_fuel': 'Secondary energy use by fuel type (SEU final demand)',
    'residential_daily_lives': 'Residential energy (energy in our daily lives)',
    'residential_pie_charts': 'Residential pie charts (by type, space/water heating by source)',
    'commercial_institutional': 'Commercial and institutional energy use by end use (page 52)',
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
