"""
Section 1: Key Indicators data processor.

Handles data for:
- Economic contributions (GDP, Jobs, Income)
- Nominal GDP contributions
- Provincial GDP
- World energy production rankings
- Canadian Energy Assets (CEA)
- GHG emissions by economic sector (Page 20 / Page 132)
"""

from typing import Dict

from ..base import SectionProcessor
from .cea import process_cea_data, transform_cea_data, update_cea_data
from .economic_contributions import (
    process_economic_contributions,
    transform_economic_contributions,
    update_economic_contributions,
)
from .ghg_emissions import process_ghg_emissions, transform_ghg_emissions, update_ghg_emissions
from .nominal_gdp import process_nominal_gdp, transform_nominal_gdp, update_nominal_gdp
from .provincial_gdp import process_provincial_gdp, transform_provincial_gdp, update_provincial_gdp
from .world_energy_production import (
    process_world_energy_production,
    transform_world_energy_production,
    update_world_energy_production,
)


class Section1Indicators(SectionProcessor):
    """
    Processor for Section 1: Key Indicators.

    Data sources:
    - economic_contributions: StatCan Table 36-10-0610-01
    - nominal_gdp: Google Docs + StatCan calculations
    - provincial_gdp: StatCan Table 36-10-0624-01
    - world_energy_production: External/manual
    - canadian_energy_assets: CEA Excel file
    """

    SECTION_KEY = "section1_indicators"
    SECTION_NAME = "Key Indicators"
    SECTION_ID = 1

    def get_update_handlers(self) -> Dict[str, callable]:
        """Return mapping of source keys to EEDAS ingest handlers."""
        return {
            'economic_contributions': self._update_economic_contributions,
            'nominal_gdp': self._update_nominal_gdp,
            'provincial_gdp': self._update_provincial_gdp,
            'world_energy_production': self._update_world_energy_production,
            'canadian_energy_assets': self._update_cea_data,
            'ghg_emissions': self._update_ghg_emissions,
        }

    def get_transform_handlers(self) -> Dict[str, callable]:
        """Return mapping of source keys to EFB transform handlers."""
        return {
            'economic_contributions': self._transform_economic_contributions,
            'nominal_gdp': self._transform_nominal_gdp,
            'provincial_gdp': self._transform_provincial_gdp,
            'world_energy_production': self._transform_world_energy_production,
            'canadian_energy_assets': self._transform_cea_data,
            'ghg_emissions': self._transform_ghg_emissions,
        }

    def get_source_handlers(self) -> Dict[str, callable]:
        """Return mapping of source keys to full refresh handlers (update + transform)."""
        return {
            'economic_contributions': self._process_economic_contributions,
            'nominal_gdp': self._process_nominal_gdp,
            'provincial_gdp': self._process_provincial_gdp,
            'world_energy_production': self._process_world_energy_production,
            'canadian_energy_assets': self._process_cea_data,
            'ghg_emissions': self._process_ghg_emissions,
        }

    def _update_economic_contributions(self) -> int:
        return update_economic_contributions(self)

    def _transform_economic_contributions(self) -> int:
        return transform_economic_contributions(self)

    def _process_economic_contributions(self) -> int:
        return process_economic_contributions(self)

    def _update_nominal_gdp(self) -> int:
        return update_nominal_gdp(self)

    def _transform_nominal_gdp(self) -> int:
        return transform_nominal_gdp(self)

    def _process_nominal_gdp(self) -> int:
        return process_nominal_gdp(self)

    def _update_provincial_gdp(self) -> int:
        return update_provincial_gdp(self)

    def _transform_provincial_gdp(self) -> int:
        return transform_provincial_gdp(self)

    def _process_provincial_gdp(self) -> int:
        return process_provincial_gdp(self)

    def _update_world_energy_production(self) -> int:
        return update_world_energy_production(self)

    def _transform_world_energy_production(self) -> int:
        return transform_world_energy_production(self)

    def _process_world_energy_production(self) -> int:
        return process_world_energy_production(self)

    def _update_cea_data(self) -> int:
        return update_cea_data(self)

    def _transform_cea_data(self) -> int:
        return transform_cea_data(self)

    def _process_cea_data(self) -> int:
        return process_cea_data(self)

    def _update_ghg_emissions(self) -> int:
        return update_ghg_emissions(self)

    def _transform_ghg_emissions(self) -> int:
        return transform_ghg_emissions(self)

    def _process_ghg_emissions(self) -> int:
        return process_ghg_emissions(self)
