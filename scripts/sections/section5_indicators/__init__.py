"""
Section 5: Clean power and low carbon fuels data processor.

Handles data for:
- Environmental and clean technology (StatCan 4 tables + TSX/TSXV cleantech XLSX)
"""

from typing import Dict

from ..base import SectionProcessor
from .cleantech_companies_geo import transform_cleantech_companies_geo, update_cleantech_companies_geo
from .cleantech_companies_industry import transform_cleantech_companies_industry, update_cleantech_companies_industry
from .environmental_clean_tech import transform_environmental_clean_tech, update_environmental_clean_tech
from .ev_sales import transform_ev_sales, update_ev_sales


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
        }

    def get_transform_handlers(self) -> Dict[str, callable]:
        return {
            'environmental_clean_tech': lambda: transform_environmental_clean_tech(self),
            'cleantech_companies_geo': lambda: transform_cleantech_companies_geo(self),
            'cleantech_companies_industry': lambda: transform_cleantech_companies_industry(self),
            'ev_sales': lambda: transform_ev_sales(self),
        }

    def get_source_handlers(self) -> Dict[str, callable]:
        updates = self.get_update_handlers()
        transforms = self.get_transform_handlers()
        return {key: _chain(updates[key], transforms[key]) for key in updates}
