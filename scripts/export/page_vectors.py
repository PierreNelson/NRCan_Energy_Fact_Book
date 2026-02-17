"""
Page-to-vector mapping for selective exports.

Maps website pages to the data vectors they use, enabling targeted exports.
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

# Page-to-vector prefix mapping
# Maps page names to the vector prefixes they use
PAGE_VECTORS = {
    # Section 1: Key Indicators
    'Page7': ['gdp_nominal_'],  # Energy's Contribution - Nominal GDP
    'Page8': ['gdp_prov_'],  # Provincial GDP map
    'Page9': ['gdp_nominal_'],  # Nominal GDP chart
    'Page10': ['gdp_nominal_'],  # GDP breakdown
    'Page11': ['econ_'],  # Economic contributions
    
    # Section 2: Investment
    'Page23': ['capex_'],  # Capital Expenditures intro
    'Page24': ['capex_'],  # Capital Expenditures chart
    'Page25': ['infra_'],  # Infrastructure stock
    'Page26': ['asset_'],  # Investment by asset type
    'Page27': ['intl_'],  # International investment
    'Page28': ['projects_'],  # Major projects chart
    'Page29': ['intl_'],  # International investment detail
    'Page30': ['foreign_'],  # Foreign control (uses major_projects_map.csv)
    'Page31': ['intl_', 'foreign_'],  # Combined international
    'Page32': ['enviro_'],  # Environmental protection intro
    'Page33': ['cleantech_'],  # Clean technology
    'Page37': ['enviro_'],  # Environmental protection chart
    
    # Section 3: Energy Assets
    'Page39': ['cea_'],  # Canadian Energy Assets
    
    # World rankings
    'Page2': ['energy_prod_'],
    'Page3': ['energy_prod_'],
    'Page4': ['energy_prod_'],
}

# Aliases for common page name formats
PAGE_ALIASES = {
    'page7': 'Page7',
    'page8': 'Page8',
    'page9': 'Page9',
    'page10': 'Page10',
    'page11': 'Page11',
    'page23': 'Page23',
    'page24': 'Page24',
    'page25': 'Page25',
    'page26': 'Page26',
    'page27': 'Page27',
    'page28': 'Page28',
    'page29': 'Page29',
    'page30': 'Page30',
    'page31': 'Page31',
    'page32': 'Page32',
    'page33': 'Page33',
    'page37': 'Page37',
    'page39': 'Page39',
    'page2': 'Page2',
    'page3': 'Page3',
    'page4': 'Page4',
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


def get_vectors_for_page(page_name: str) -> list:
    """
    Get vector prefixes for a page.
    
    Args:
        page_name: Page name (e.g., 'Page24', 'page24')
        
    Returns:
        List of vector prefixes
    """
    # Normalize page name
    normalized = PAGE_ALIASES.get(page_name.lower(), page_name)
    return PAGE_VECTORS.get(normalized, [])


def get_all_pages() -> list:
    """Get list of all known page names."""
    return sorted(PAGE_VECTORS.keys())


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
