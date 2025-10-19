"""
Database connection and utilities
"""

import psycopg2
import psycopg2.extras
from psycopg2.pool import ThreadedConnectionPool
import os
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()

# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': os.getenv('DB_PORT', '5432'),
    'database': os.getenv('DB_NAME', 'flowrack'),
    'user': os.getenv('DB_USER', 'flowrack_user'),
    'password': os.getenv('DB_PASSWORD', 'your_password')
}

# Connection pool
connection_pool = None

def init_db_pool():
    """Initialize database connection pool"""
    global connection_pool
    try:
        connection_pool = ThreadedConnectionPool(
            minconn=1,
            maxconn=20,
            **DB_CONFIG
        )
        logging.info("Database connection pool initialized successfully")
    except Exception as e:
        logging.error(f"Error initializing database pool: {e}")
        raise

def get_db_connection():
    """Get database connection from pool"""
    if connection_pool is None:
        init_db_pool()
    return connection_pool.getconn()

def return_db_connection(conn):
    """Return connection to pool"""
    if connection_pool and conn:
        connection_pool.putconn(conn)

class DatabaseManager:
    """Database operations manager"""
    
    def __init__(self):
        if connection_pool is None:
            init_db_pool()
    
    def execute_query(self, query, params=None, fetch=False, fetchone=False):
        """Execute database query"""
        conn = None
        cursor = None
        try:
            conn = get_db_connection()
            cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            
            cursor.execute(query, params)
            
            if fetch:
                if fetchone:
                    result = cursor.fetchone()
                else:
                    result = cursor.fetchall()
                return result
            else:
                conn.commit()
                return cursor.rowcount
                
        except Exception as e:
            if conn:
                conn.rollback()
            logging.error(f"Database error: {e}")
            raise
        finally:
            if cursor:
                cursor.close()
            if conn:
                return_db_connection(conn)
    
    def execute_transaction(self, queries_and_params):
        """Execute multiple queries in a transaction"""
        conn = None
        cursor = None
        try:
            conn = get_db_connection()
            cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            
            results = []
            for query, params in queries_and_params:
                cursor.execute(query, params)
                if query.strip().upper().startswith('SELECT'):
                    results.append(cursor.fetchall())
                else:
                    results.append(cursor.rowcount)
            
            conn.commit()
            return results
            
        except Exception as e:
            if conn:
                conn.rollback()
            logging.error(f"Transaction error: {e}")
            raise
        finally:
            if cursor:
                cursor.close()
            if conn:
                return_db_connection(conn)

# Global database manager instance
db = DatabaseManager()

def init_database():
    """Initialize database with schema"""
    try:
        # Read schema file
        schema_path = os.path.join(os.path.dirname(__file__), '..', '..', 'database', 'schema.sql')
        with open(schema_path, 'r') as f:
            schema_sql = f.read()
        
        # Execute schema
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(schema_sql)
        conn.commit()
        cursor.close()
        return_db_connection(conn)
        
        logging.info("Database initialized successfully")
        
    except Exception as e:
        logging.error(f"Error initializing database: {e}")
        raise