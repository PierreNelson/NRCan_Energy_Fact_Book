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
}


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
