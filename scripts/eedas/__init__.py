"""
EEDAS standalone update layer — fetch source-native data into SQL series tables.

Run via: python main.py eedas update --all
"""

from eedas.runner import run_eedas_update

__all__ = ['run_eedas_update']
