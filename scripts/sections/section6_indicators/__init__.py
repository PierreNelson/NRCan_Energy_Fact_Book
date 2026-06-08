"""
Section 6: Oil, natural gas and coal data processor.

Page 136 — supply and demand of refined petroleum products (RPPs):
- StatCan Table 25-10-0081-01 (supply, disposition, product shares)
- StatCan Table 25-10-0063-01 (refinery input)

Page 113 — oil sands capex and production share:
- CAPP historical capex (1958–2005)
- StatCan 34-10-0036-01 vector v95928097 (2006+)
- StatCan 25-10-0014-01 (2000–2015) + 25-10-0063-01 (2016+)
- CAPP Statistics Handbook 07-01 (upgrader capacity)
- CAPP Statistics Handbook 02-07/02-08/02-02 (proved reserves share)

Page 117 — WTI and WCS crude prices:
- U.S. EIA WTI spot (monthly)
- Sproule ERCE WCS (monthly)
- Bank of Canada USD/CAD (monthly)
"""

from typing import Dict

from ..base import SectionProcessor
from .canadian_production import transform_canadian_production, update_canadian_production
from .crude_prices import transform_crude_prices, update_crude_prices
from .kalibrate import transform_kal_gas_prices, update_kal_gas_prices
from .oil_sands import transform_oil_sands, update_oil_sands
from .refinery_capacity import transform_osm_refin_cap, update_osm_refin_cap
from .rpp import (
    transform_rpp_refinery_input,
    transform_rpp_supply_demand,
    update_rpp_refinery_input,
    update_rpp_supply_demand,
)


def _chain(update_fn, transform_fn):
    def handler():
        rows = update_fn()
        rows += transform_fn()
        return rows
    return handler


class Section6OilGas(SectionProcessor):
    """Processor for Section 6: Oil, Natural Gas and Coal."""

    SECTION_KEY = 'section6_indicators'
    SECTION_NAME = 'Oil, Natural Gas and Coal'
    SECTION_ID = 6

    def get_update_handlers(self) -> Dict[str, callable]:
        return {
            'rpp_supply_demand': lambda: update_rpp_supply_demand(self),
            'rpp_refinery_input': lambda: update_rpp_refinery_input(self),
            'crude_prices': lambda: update_crude_prices(self),
            'oil_sands': lambda: update_oil_sands(self),
            'canadian_production': lambda: update_canadian_production(self),
            'kal_gas_prices': lambda: update_kal_gas_prices(self),
            'osm_refin_cap': lambda: update_osm_refin_cap(self),
        }

    def get_transform_handlers(self) -> Dict[str, callable]:
        return {
            'rpp_supply_demand': lambda: transform_rpp_supply_demand(self),
            'rpp_refinery_input': lambda: transform_rpp_refinery_input(self),
            'crude_prices': lambda: transform_crude_prices(self),
            'oil_sands': lambda: transform_oil_sands(self),
            'canadian_production': lambda: transform_canadian_production(self),
            'kal_gas_prices': lambda: transform_kal_gas_prices(self),
            'osm_refin_cap': lambda: transform_osm_refin_cap(self),
        }

    def get_source_handlers(self) -> Dict[str, callable]:
        updates = self.get_update_handlers()
        transforms = self.get_transform_handlers()
        return {key: _chain(updates[key], transforms[key]) for key in updates}
