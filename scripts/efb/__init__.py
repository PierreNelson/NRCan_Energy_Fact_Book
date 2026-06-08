"""
EFB indicator transform layer — aggregate raw EEDAS vectors into nrcan_efb_indicators.

Run via: python main.py efb transform --all
"""

from efb.runner import run_efb_transform

__all__ = ['run_efb_transform']
