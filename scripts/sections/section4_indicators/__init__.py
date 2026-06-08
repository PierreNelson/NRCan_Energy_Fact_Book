"""
Section 4: Energy Efficiency / Indicators data processor.

Handles data for:
- Energy use (OEE NEUD sector totals R,C,I,T,A + Primary Energy Use Demand P,NPC,FK,EL).
  OEE: five sector Table 1 XLS from NRCan OEE NEUD (URLs in code). Primary: local Excel (EXTERNAL_XLSX_DATA_DIR or repo root).
"""

from typing import Dict

from ..base import SectionProcessor
from ._oee import OEESharedMixin
from .commercial import transform_commercial_institutional, update_commercial_institutional
from .energy_use import transform_energy_use, update_energy_use
from .industrial import transform_industrial_sector, update_industrial_sector
from .residential import (
    transform_residential_daily_lives,
    transform_residential_pie_charts,
    update_residential_daily_lives,
    update_residential_pie_charts,
)
from .seu import transform_seu_by_fuel, update_seu_by_fuel


def _chain(update_fn, transform_fn):
    def handler():
        rows = update_fn()
        rows += transform_fn()
        return rows
    return handler


class Section4Indicators(OEESharedMixin, SectionProcessor):
    """
    Processor for Section 4 (Energy Efficiency / Indicators).

    Data sources:
    - energy_use: OEE NEUD (R,C,I,T,A) from five sector XLS URLs; Primary (P,NPC,FK,EL) from local Excel.
    """

    SECTION_KEY = "section4_indicators"
    SECTION_NAME = "Energy Efficiency"
    SECTION_ID = 4

    def get_update_handlers(self) -> Dict[str, callable]:
        return {
            'energy_use': lambda: update_energy_use(self),
            'seu_by_fuel': lambda: update_seu_by_fuel(self),
            'residential_daily_lives': lambda: update_residential_daily_lives(self),
            'residential_pie_charts': lambda: update_residential_pie_charts(self),
            'commercial_institutional': lambda: update_commercial_institutional(self),
            'industrial_sector': lambda: update_industrial_sector(self),
        }

    def get_transform_handlers(self) -> Dict[str, callable]:
        return {
            'energy_use': lambda: transform_energy_use(self),
            'seu_by_fuel': lambda: transform_seu_by_fuel(self),
            'residential_daily_lives': lambda: transform_residential_daily_lives(self),
            'residential_pie_charts': lambda: transform_residential_pie_charts(self),
            'commercial_institutional': lambda: transform_commercial_institutional(self),
            'industrial_sector': lambda: transform_industrial_sector(self),
        }

    def get_source_handlers(self) -> Dict[str, callable]:
        updates = self.get_update_handlers()
        transforms = self.get_transform_handlers()
        return {
            key: _chain(updates[key], transforms[key])
            for key in updates
        }
