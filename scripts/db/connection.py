"""
Database connection management for SQL Server.

Provides connection pooling and retry logic for robust database operations.
"""

import pyodbc
import os
import time
from contextlib import contextmanager
from typing import Optional, Dict, Any


class DatabaseConnection:
    """
    Manages SQL Server database connections with retry logic.
    
    Usage:
        db = DatabaseConnection(config)
        with db.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM data_sources")
    """
    
    def __init__(self, config: Dict[str, Any]):
        """
        Initialize database connection manager.
        
        Args:
            config: Dictionary with database configuration:
                - server: SQL Server hostname
                - database: Database name
                - username: SQL Server username (or None for Windows auth)
                - password: SQL Server password (or None for Windows auth)
                - driver: ODBC driver name (default: auto-detect)
        """
        self.server = config.get('server', 'localhost')
        self.database = config.get('database', 'NRCanEnergyFactbook')
        self.username = config.get('username') or os.getenv('DB_USERNAME')
        self.password = config.get('password') or os.getenv('DB_PASSWORD')
        self.driver = config.get('driver') or self._detect_driver()
        self.connection_timeout = config.get('connection_timeout', 30)
        self.max_retries = config.get('max_retries', 3)
        self.retry_delay = config.get('retry_delay', 2)
        
        self._connection_string = self._build_connection_string()
    
    def _detect_driver(self) -> str:
        """Auto-detect the best available ODBC driver."""
        drivers = pyodbc.drivers()
        
        # Prefer newer drivers
        preferred_drivers = [
            'ODBC Driver 18 for SQL Server',
            'ODBC Driver 17 for SQL Server',
            'SQL Server Native Client 11.0',
            'SQL Server',
        ]
        
        for driver in preferred_drivers:
            if driver in drivers:
                return driver
        
        # Return first available SQL Server driver
        sql_drivers = [d for d in drivers if 'SQL Server' in d]
        if sql_drivers:
            return sql_drivers[0]
        
        raise RuntimeError(
            "No SQL Server ODBC driver found. "
            "Please install 'ODBC Driver 17 for SQL Server' or later."
        )
    
    def _build_connection_string(self) -> str:
        """Build the ODBC connection string."""
        parts = [
            f"DRIVER={{{self.driver}}}",
            f"SERVER={self.server}",
            f"DATABASE={self.database}",
            f"Connection Timeout={self.connection_timeout}",
        ]
        
        if self.username and self.password:
            # SQL Server Authentication
            parts.extend([
                f"UID={self.username}",
                f"PWD={self.password}",
            ])
        else:
            # Windows Authentication
            parts.append("Trusted_Connection=yes")
        
        # For newer drivers, handle encryption
        if 'ODBC Driver 18' in self.driver:
            parts.append("TrustServerCertificate=yes")
        
        return ';'.join(parts)
    
    @contextmanager
    def get_connection(self):
        """
        Get a database connection with automatic retry on failure.
        
        Yields:
            pyodbc.Connection: Active database connection
            
        Raises:
            pyodbc.Error: If connection fails after all retries
        """
        conn = None
        last_error = None
        
        for attempt in range(1, self.max_retries + 1):
            try:
                conn = pyodbc.connect(self._connection_string)
                yield conn
                return
            except pyodbc.Error as e:
                last_error = e
                if attempt < self.max_retries:
                    print(f"  Database connection failed (attempt {attempt}/{self.max_retries}): {e}")
                    time.sleep(self.retry_delay)
            finally:
                if conn:
                    try:
                        conn.close()
                    except:
                        pass
        
        raise last_error or pyodbc.Error("Failed to connect to database")
    
    def test_connection(self) -> bool:
        """
        Test if the database connection works.
        
        Returns:
            True if connection successful, False otherwise
        """
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT 1")
                return True
        except Exception as e:
            print(f"Connection test failed: {e}")
            return False
    
    def execute_query(self, query: str, params: tuple = None) -> list:
        """
        Execute a SELECT query and return results.
        
        Args:
            query: SQL query string
            params: Optional tuple of query parameters
            
        Returns:
            List of rows as dictionaries
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            
            columns = [column[0] for column in cursor.description]
            results = []
            for row in cursor.fetchall():
                results.append(dict(zip(columns, row)))
            return results
    
    def execute_non_query(self, query: str, params: tuple = None) -> int:
        """
        Execute an INSERT/UPDATE/DELETE query.
        
        Args:
            query: SQL query string
            params: Optional tuple of query parameters
            
        Returns:
            Number of rows affected
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if params:
                cursor.execute(query, params)
            else:
                cursor.execute(query)
            conn.commit()
            return cursor.rowcount
    
    def execute_many(self, query: str, params_list: list) -> int:
        """
        Execute a query with multiple parameter sets (batch insert).
        
        Args:
            query: SQL query string with parameter placeholders
            params_list: List of parameter tuples
            
        Returns:
            Total number of rows affected
        """
        if not params_list:
            return 0
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.fast_executemany = True
            cursor.executemany(query, params_list)
            conn.commit()
            return cursor.rowcount


# Global connection instance (lazy initialization)
_db_connection: Optional[DatabaseConnection] = None


def get_connection(config: Dict[str, Any] = None) -> DatabaseConnection:
    """
    Get the global database connection instance.
    
    Args:
        config: Database configuration (required on first call)
        
    Returns:
        DatabaseConnection instance
    """
    global _db_connection
    
    if _db_connection is None:
        if config is None:
            raise ValueError("Database configuration required on first call")
        _db_connection = DatabaseConnection(config)
    
    return _db_connection


def reset_connection():
    """Reset the global connection (useful for testing)."""
    global _db_connection
    _db_connection = None
