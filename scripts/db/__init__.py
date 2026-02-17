"""
Database module for NRCan Energy Factbook.

Provides connection management and data access functions for SQL Server.
"""

from .connection import get_connection, DatabaseConnection
from .models import DataRepository

__all__ = ['get_connection', 'DatabaseConnection', 'DataRepository']
