"""
Section processors for NRCan Energy Factbook data pipeline.

Each section module handles fetching and processing data for a specific
section of the Energy Factbook.
"""

from .base import SectionProcessor
from .section1_indicators import Section1Indicators
from .section2_investment import Section2Investment

__all__ = [
    'SectionProcessor',
    'Section1Indicators', 
    'Section2Investment',
]
