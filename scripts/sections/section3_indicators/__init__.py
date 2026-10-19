"""Section 3: Skills, diversity and community."""

from typing import Dict

from ..base import SectionProcessor
from .demographic_representation import (
    process_demographic_representation,
    transform_demographic_representation,
    update_demographic_representation,
)
from .energy_sector_demographics import (
    process_energy_sector_demographics,
    transform_energy_sector_demographics,
    update_energy_sector_demographics,
)
from .household_energy_expenditures import (
    process_household_energy_expenditures,
    transform_household_energy_expenditures,
    update_household_energy_expenditures,
)
from .household_energy_prices import (
    process_household_energy_prices,
    transform_household_energy_prices,
    update_household_energy_prices,
)
from .energy_poverty import (
    process_energy_poverty_geography,
    transform_energy_poverty_geography,
    update_energy_poverty_geography,
)
from .energy_reliant_communities import (
    process_energy_reliant_communities,
    transform_energy_reliant_communities,
    update_energy_reliant_communities,
)


class Section3Indicators(SectionProcessor):
    """Processor for Section 3."""

    SECTION_KEY = 'section3_indicators'
    SECTION_NAME = 'Skills, diversity and community'
    SECTION_ID = 3

    def get_update_handlers(self) -> Dict[str, callable]:
        return {
            'demographic_representation': self._update_demographic_representation,
            'household_energy_expenditures': self._update_household_energy_expenditures,
            'household_energy_prices': self._update_household_energy_prices,
            'energy_sector_demographics': self._update_energy_sector_demographics,
            'energy_poverty_geography': self._update_energy_poverty_geography,
            'energy_reliant_communities': self._update_energy_reliant_communities,
        }

    def get_transform_handlers(self) -> Dict[str, callable]:
        return {
            'demographic_representation': self._transform_demographic_representation,
            'household_energy_expenditures': self._transform_household_energy_expenditures,
            'household_energy_prices': self._transform_household_energy_prices,
            'energy_sector_demographics': self._transform_energy_sector_demographics,
            'energy_poverty_geography': self._transform_energy_poverty_geography,
            'energy_reliant_communities': self._transform_energy_reliant_communities,
        }

    def get_source_handlers(self) -> Dict[str, callable]:
        return {
            'demographic_representation': self._process_demographic_representation,
            'household_energy_expenditures': self._process_household_energy_expenditures,
            'household_energy_prices': self._process_household_energy_prices,
            'energy_sector_demographics': self._process_energy_sector_demographics,
            'energy_poverty_geography': self._process_energy_poverty_geography,
            'energy_reliant_communities': self._process_energy_reliant_communities,
        }

    def _update_demographic_representation(self) -> int:
        return update_demographic_representation(self)

    def _transform_demographic_representation(self) -> int:
        return transform_demographic_representation(self)

    def _process_demographic_representation(self) -> int:
        return process_demographic_representation(self)

    def _update_household_energy_expenditures(self) -> int:
        return update_household_energy_expenditures(self)

    def _transform_household_energy_expenditures(self) -> int:
        return transform_household_energy_expenditures(self)

    def _process_household_energy_expenditures(self) -> int:
        return process_household_energy_expenditures(self)

    def _update_household_energy_prices(self) -> int:
        return update_household_energy_prices(self)

    def _transform_household_energy_prices(self) -> int:
        return transform_household_energy_prices(self)

    def _process_household_energy_prices(self) -> int:
        return process_household_energy_prices(self)

    def _update_energy_sector_demographics(self) -> int:
        return update_energy_sector_demographics(self)

    def _transform_energy_sector_demographics(self) -> int:
        return transform_energy_sector_demographics(self)

    def _process_energy_sector_demographics(self) -> int:
        return process_energy_sector_demographics(self)

    def _update_energy_poverty_geography(self) -> int:
        return update_energy_poverty_geography(self)

    def _transform_energy_poverty_geography(self) -> int:
        return transform_energy_poverty_geography(self)

    def _process_energy_poverty_geography(self) -> int:
        return process_energy_poverty_geography(self)

    def _update_energy_reliant_communities(self) -> int:
        return update_energy_reliant_communities(self)

    def _transform_energy_reliant_communities(self) -> int:
        return transform_energy_reliant_communities(self)

    def _process_energy_reliant_communities(self) -> int:
        return process_energy_reliant_communities(self)
