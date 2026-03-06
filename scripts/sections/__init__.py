"""
Section processors for NRCan Energy Factbook data pipeline.

Each section module handles fetching and processing data for a specific
section of the Energy Factbook.
"""

from .base import SectionProcessor
from .section1_indicators import Section1Indicators
from .section2_investment import Section2Investment
from .section4_indicators import Section4Indicators
from .section5_clean_power import Section5CleanPower

__all__ = [
    'SectionProcessor',
    'Section1Indicators',
    'Section2Investment',
    'Section4Indicators',
    'Section5CleanPower',
]
