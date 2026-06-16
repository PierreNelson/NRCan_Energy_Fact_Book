"""
Section 5: Clean power and low carbon fuels data processor.

Handles data for:
- Environmental and clean technology (StatCan 4 tables + TSX/TSXV cleantech XLSX)
"""

from typing import Dict

from ..base import SectionProcessor
from .cleantech_companies_geo import transform_cleantech_companies_geo, update_cleantech_companies_geo
from .cleantech_companies_industry import transform_cleantech_companies_industry, update_cleantech_companies_industry
from .electricity_trade_us import transform_electricity_trade_us, update_electricity_trade_us
from .environmental_clean_tech import transform_environmental_clean_tech, update_environmental_clean_tech
from .ev_sales import transform_ev_sales, update_ev_sales
from .ghg_electricity_spotlight import (
    transform_ghg_electricity_spotlight,
    update_ghg_electricity_spotlight,
)
from .renewable_electricity_capacity import (
    transform_renewable_electricity_capacity,
    update_renewable_electricity_capacity,
)
from .solid_biofuels import transform_solid_biofuels, update_solid_biofuels
from .largest_solar_projects import (
    transform_largest_solar_projects,
    update_largest_solar_projects,
)
from .wind_capacity import (
    transform_largest_wind_projects,
    transform_wind_capacity_by_province,
    update_largest_wind_projects,
    update_wind_capacity_by_province,
)


def _chain(update_fn, transform_fn):
    def handler():
        rows = update_fn()
        rows += transform_fn()
        return rows
    return handler


class Section5CleanPower(SectionProcessor):
    """
    Processor for Section 5: Clean power and low carbon fuels.

    Data sources:
    - environmental_clean_tech: StatCan 14-10-0023-01, 36-10-0103-01,
      36-10-0632-01, 36-10-0629-01 (WDS fallback when CSV fails)
    """

    SECTION_KEY = "section5_indicators"
    SECTION_NAME = "Clean Power and Low Carbon Fuels"
    SECTION_ID = 5

    def _source_url_for(self, source_key: str, fallback: str) -> str:
        try:
            sec = self.config.sections.get("section5_indicators", {})
            src = sec.get("sources", {}).get(source_key, {})
            return src.get("source_url") or fallback
        except Exception:
            return fallback

    def get_update_handlers(self) -> Dict[str, callable]:
        return {
            'environmental_clean_tech': lambda: update_environmental_clean_tech(self),
            'cleantech_companies_geo': lambda: update_cleantech_companies_geo(self),
            'cleantech_companies_industry': lambda: update_cleantech_companies_industry(self),
            'ev_sales': lambda: update_ev_sales(self),
            'electricity_trade_us': lambda: update_electricity_trade_us(self),
            'ghg_electricity_spotlight': lambda: update_ghg_electricity_spotlight(self),
            'renewable_electricity_capacity': lambda: update_renewable_electricity_capacity(self),
            'wind_capacity_by_province': lambda: update_wind_capacity_by_province(self),
            'largest_wind_projects': lambda: update_largest_wind_projects(self),
            'largest_solar_projects': lambda: update_largest_solar_projects(self),
            'solid_biofuels': lambda: update_solid_biofuels(self),
        }

    def get_transform_handlers(self) -> Dict[str, callable]:
        return {
            'environmental_clean_tech': lambda: transform_environmental_clean_tech(self),
            'cleantech_companies_geo': lambda: transform_cleantech_companies_geo(self),
            'cleantech_companies_industry': lambda: transform_cleantech_companies_industry(self),
            'ev_sales': lambda: transform_ev_sales(self),
            'electricity_trade_us': lambda: transform_electricity_trade_us(self),
            'ghg_electricity_spotlight': lambda: transform_ghg_electricity_spotlight(self),
            'renewable_electricity_capacity': lambda: transform_renewable_electricity_capacity(self),
            'wind_capacity_by_province': lambda: transform_wind_capacity_by_province(self),
            'largest_wind_projects': lambda: transform_largest_wind_projects(self),
            'largest_solar_projects': lambda: transform_largest_solar_projects(self),
            'solid_biofuels': lambda: transform_solid_biofuels(self),
        }

    def get_source_handlers(self) -> Dict[str, callable]:
        updates = self.get_update_handlers()
        transforms = self.get_transform_handlers()
        return {key: _chain(updates[key], transforms[key]) for key in updates}
