"""
Configuration loader for NRCan Energy Factbook data pipeline.

Loads configuration from YAML file with environment variable overrides.
Automatically loads .env file for database credentials.
"""

import os
import yaml
from pathlib import Path
from typing import Dict, Any, List, Optional

# Load .env file for database credentials
try:
    from dotenv import load_dotenv
    
    # Look for .env in the scripts directory
    _script_dir = Path(__file__).parent
    _env_path = _script_dir / ".env"
    
    if _env_path.exists():
        load_dotenv(_env_path)
        print(f"Loaded environment from: {_env_path}")
    else:
        # Also check parent directory
        _env_path_parent = _script_dir.parent / ".env"
        if _env_path_parent.exists():
            load_dotenv(_env_path_parent)
except ImportError:
    # python-dotenv not installed, rely on system environment variables
    pass


class Config:
    """
    Configuration manager for the data pipeline.
    
    Loads settings from config.yaml and allows environment variable overrides
    for sensitive values like database credentials.
    """
    
    def __init__(self, config_path: str = None):
        """
        Load configuration from file.
        
        Args:
            config_path: Path to config.yaml (default: scripts/config.yaml)
        """
        if config_path is None:
            # Default to config.yaml in the same directory as this script
            script_dir = Path(__file__).parent
            config_path = script_dir / "config.yaml"
        
        self.config_path = Path(config_path)
        self._config = self._load_config()
        self._apply_env_overrides()
    
    def _load_config(self) -> Dict[str, Any]:
        """Load YAML configuration file."""
        if not self.config_path.exists():
            raise FileNotFoundError(f"Configuration file not found: {self.config_path}")
        
        with open(self.config_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    
    def _apply_env_overrides(self):
        """Apply environment variable overrides for sensitive values."""
        # Database connection overrides
        db_config = self._config.get('database', {})
        
        if os.getenv('DB_SERVER'):
            db_config['server'] = os.getenv('DB_SERVER')
        if os.getenv('DB_DATABASE'):
            db_config['database'] = os.getenv('DB_DATABASE')
        if os.getenv('DB_USERNAME'):
            db_config['username'] = os.getenv('DB_USERNAME')
        if os.getenv('DB_PASSWORD'):
            db_config['password'] = os.getenv('DB_PASSWORD')
        if os.getenv('DB_DRIVER'):
            db_config['driver'] = os.getenv('DB_DRIVER')
    
    @property
    def database(self) -> Dict[str, Any]:
        """Get database configuration."""
        return self._config.get('database', {})
    
    @property
    def sections(self) -> Dict[str, Any]:
        """Get all sections configuration."""
        return self._config.get('sections', {})
    
    @property
    def export(self) -> Dict[str, Any]:
        """Get export configuration."""
        return self._config.get('export', {})
    
    @property
    def logging(self) -> Dict[str, Any]:
        """Get logging configuration."""
        return self._config.get('logging', {})
    
    def is_section_enabled(self, section_key: str) -> bool:
        """
        Check if a section is enabled.
        
        Args:
            section_key: Section identifier (e.g., 'section1_indicators')
            
        Returns:
            True if section is enabled
        """
        section = self.sections.get(section_key, {})
        return section.get('enabled', False)
    
    def is_source_enabled(self, section_key: str, source_key: str) -> bool:
        """
        Check if a specific data source is enabled.
        
        Args:
            section_key: Section identifier
            source_key: Source identifier within the section
            
        Returns:
            True if both section and source are enabled
        """
        if not self.is_section_enabled(section_key):
            return False
        
        section = self.sections.get(section_key, {})
        sources = section.get('sources', {})
        source = sources.get(source_key, {})
        return source.get('enabled', False)
    
    def get_enabled_sections(self) -> List[str]:
        """
        Get list of enabled section keys.
        
        Returns:
            List of section keys that are enabled
        """
        return [
            key for key, section in self.sections.items()
            if section.get('enabled', False)
        ]
    
    def get_enabled_sources(self, section_key: str = None) -> List[Dict[str, Any]]:
        """
        Get list of enabled data sources.
        
        Args:
            section_key: Optional filter by section
            
        Returns:
            List of source configurations with section and source keys
        """
        result = []
        
        sections_to_check = (
            {section_key: self.sections.get(section_key, {})} 
            if section_key else self.sections
        )
        
        for sec_key, section in sections_to_check.items():
            if not section.get('enabled', False):
                continue
            
            sources = section.get('sources', {})
            for src_key, source in sources.items():
                if source.get('enabled', False):
                    result.append({
                        'section_key': sec_key,
                        'section_name': section.get('name', sec_key),
                        'source_key': src_key,
                        **source
                    })
        
        return result
    
    def get_source_config(self, section_key: str, source_key: str) -> Optional[Dict[str, Any]]:
        """
        Get configuration for a specific source.
        
        Args:
            section_key: Section identifier
            source_key: Source identifier
            
        Returns:
            Source configuration dict or None if not found
        """
        section = self.sections.get(section_key, {})
        sources = section.get('sources', {})
        source = sources.get(source_key)
        
        if source:
            return {
                'section_key': section_key,
                'section_name': section.get('name', section_key),
                'source_key': source_key,
                **source
            }
        return None
    
    def get_export_path(self, filename: str) -> Path:
        """
        Get the full path for an export file.
        
        Args:
            filename: Name of the export file
            
        Returns:
            Full Path object to the export file
        """
        export_config = self.export
        output_dir = export_config.get('output_dir', '../public/data')
        
        # Resolve relative to script directory
        script_dir = Path(__file__).parent
        full_path = (script_dir / output_dir / filename).resolve()
        
        return full_path


# Global config instance
_config: Optional[Config] = None


def get_config(config_path: str = None) -> Config:
    """
    Get the global configuration instance.
    
    Args:
        config_path: Optional path to config file (only used on first call)
        
    Returns:
        Config instance
    """
    global _config
    
    if _config is None:
        _config = Config(config_path)
    
    return _config


def reload_config(config_path: str = None) -> Config:
    """
    Reload configuration from file.
    
    Args:
        config_path: Optional path to config file
        
    Returns:
        New Config instance
    """
    global _config
    _config = Config(config_path)
    return _config
