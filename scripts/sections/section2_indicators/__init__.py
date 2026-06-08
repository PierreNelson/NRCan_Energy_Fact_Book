"""
Section 2: Investment data processor.

Handles data for:
- Capital expenditures
- Infrastructure stock
- Investment by asset type
- International investment (FDI/CDIA)
- Foreign control
- Environmental protection expenditures
- Major projects
- Clean technology
"""

from typing import Dict

from ..base import SectionProcessor
from .capital_expenditures import (
    process_capital_expenditures,
    transform_capital_expenditures,
    update_capital_expenditures,
)
from .environmental_protection import (
    process_environmental_protection,
    transform_environmental_protection,
    update_environmental_protection,
)
from .foreign_control import process_foreign_control, transform_foreign_control, update_foreign_control
from .infrastructure import process_infrastructure, transform_infrastructure, update_infrastructure
from .international_investment import (
    process_international_investment,
    transform_international_investment,
    update_international_investment,
)
from .investment_by_asset import (
    process_investment_by_asset,
    transform_investment_by_asset,
    update_investment_by_asset,
)
from .major_projects import (
    process_clean_tech,
    process_major_projects,
    transform_clean_tech,
    transform_major_projects,
    update_clean_tech,
    update_major_projects,
)
from .major_projects_map import process_major_projects_map, update_major_projects_map


class Section2Investment(SectionProcessor):
    """
    Processor for Section 2: Investment.

    Data sources:
    - capital_expenditures: StatCan Table 34-10-0036-01
    - infrastructure: StatCan Table 36-10-0608-01
    - investment_by_asset: StatCan Table 36-10-0608-01
    - international_investment: StatCan Table 36-10-0009-01
    - foreign_control: StatCan Table 33-10-0570-01
    - environmental_protection: StatCan Table 38-10-0130-01
    - major_projects: NRCan Major Projects Inventory
    - clean_tech: Derived data
    """

    SECTION_KEY = "section2_indicators"
    SECTION_NAME = "Investment"
    SECTION_ID = 2

    def get_update_handlers(self) -> Dict[str, callable]:
        """Return mapping of source keys to EEDAS ingest handlers."""
        return {
            'capital_expenditures': self._update_capital_expenditures,
            'infrastructure': self._update_infrastructure,
            'investment_by_asset': self._update_investment_by_asset,
            'international_investment': self._update_international_investment,
            'foreign_control': self._update_foreign_control,
            'environmental_protection': self._update_environmental_protection,
            'major_projects': self._update_major_projects,
            'clean_tech': self._update_clean_tech,
            'major_projects_map': self._update_major_projects_map,
        }

    def get_transform_handlers(self) -> Dict[str, callable]:
        """Return mapping of source keys to EFB transform handlers."""
        return {
            'capital_expenditures': self._transform_capital_expenditures,
            'infrastructure': self._transform_infrastructure,
            'investment_by_asset': self._transform_investment_by_asset,
            'international_investment': self._transform_international_investment,
            'foreign_control': self._transform_foreign_control,
            'environmental_protection': self._transform_environmental_protection,
            'major_projects': self._transform_major_projects,
            'clean_tech': self._transform_clean_tech,
        }

    def get_source_handlers(self) -> Dict[str, callable]:
        """Return mapping of source keys to full refresh handlers (update + transform)."""
        return {
            'capital_expenditures': self._process_capital_expenditures,
            'infrastructure': self._process_infrastructure,
            'investment_by_asset': self._process_investment_by_asset,
            'international_investment': self._process_international_investment,
            'foreign_control': self._process_foreign_control,
            'environmental_protection': self._process_environmental_protection,
            'major_projects': self._process_major_projects,
            'clean_tech': self._process_clean_tech,
            'major_projects_map': self._process_major_projects_map,
        }

    def _update_capital_expenditures(self) -> int:
        return update_capital_expenditures(self)

    def _transform_capital_expenditures(self) -> int:
        return transform_capital_expenditures(self)

    def _process_capital_expenditures(self) -> int:
        return process_capital_expenditures(self)

    def _update_infrastructure(self) -> int:
        return update_infrastructure(self)

    def _transform_infrastructure(self) -> int:
        return transform_infrastructure(self)

    def _process_infrastructure(self) -> int:
        return process_infrastructure(self)

    def _update_investment_by_asset(self) -> int:
        return update_investment_by_asset(self)

    def _transform_investment_by_asset(self) -> int:
        return transform_investment_by_asset(self)

    def _process_investment_by_asset(self) -> int:
        return process_investment_by_asset(self)

    def _update_international_investment(self) -> int:
        return update_international_investment(self)

    def _transform_international_investment(self) -> int:
        return transform_international_investment(self)

    def _process_international_investment(self) -> int:
        return process_international_investment(self)

    def _update_foreign_control(self) -> int:
        return update_foreign_control(self)

    def _transform_foreign_control(self) -> int:
        return transform_foreign_control(self)

    def _process_foreign_control(self) -> int:
        return process_foreign_control(self)

    def _update_environmental_protection(self) -> int:
        return update_environmental_protection(self)

    def _transform_environmental_protection(self) -> int:
        return transform_environmental_protection(self)

    def _process_environmental_protection(self) -> int:
        return process_environmental_protection(self)

    def _update_major_projects(self) -> int:
        return update_major_projects(self)

    def _transform_major_projects(self) -> int:
        return transform_major_projects(self)

    def _process_major_projects(self) -> int:
        return process_major_projects(self)

    def _update_clean_tech(self) -> int:
        return update_clean_tech(self)

    def _transform_clean_tech(self) -> int:
        return transform_clean_tech(self)

    def _process_clean_tech(self) -> int:
        return process_clean_tech(self)

    def _update_major_projects_map(self) -> int:
        return update_major_projects_map(self)

    def _process_major_projects_map(self) -> int:
        return process_major_projects_map(self)
