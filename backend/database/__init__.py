"""
Simplified database connection without pooling
"""

import psycopg
from psycopg.rows import dict_row
import os
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()

# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': os.getenv('DB_PORT', '5432'),
    'dbname': os.getenv('DB_NAME', 'flowrack'),
    'user': os.getenv('DB_USER', 'flowrack_user'),
    'password': os.getenv('DB_PASSWORD', 'your_password')
}

def get_db_connection():
    """Get database connection"""
    try:
        conn = psycopg.connect(**DB_CONFIG)
        conn.row_factory = dict_row
        return conn
    except Exception as e:
        logging.error(f"Error connecting to database: {e}")
        raise

def return_db_connection(conn):
    """Close database connection"""
    if conn:
        conn.close()

def close_db_pool():
    """Placeholder for compatibility"""
    pass

class DatabaseManager:
    """Database operations manager"""
    
    def execute_query(self, query, params=None, fetch=False, fetchone=False):
        """Execute database query with proper transaction handling"""
        conn = None
        try:
            conn = get_db_connection()
            with conn:
                with conn.cursor() as cursor:
                    cursor.execute(query, params)
                    
                    if fetch:
                        if fetchone:
                            result = cursor.fetchone()
                        else:
                            result = cursor.fetchall()
                        return result
                    else:
                        return cursor.rowcount
                        
        except Exception as e:
            logging.error(f"Database error: {e}")
            raise
        finally:
            if conn:
                return_db_connection(conn)
    
    def execute_transaction(self, queries_and_params):
        """Execute multiple queries in a transaction"""
        conn = None
        try:
            conn = get_db_connection()
            with conn:
                with conn.cursor() as cursor:
                    results = []
                    for query, params in queries_and_params:
                        cursor.execute(query, params)
                        if query.strip().upper().startswith('SELECT'):
                            results.append(cursor.fetchall())
                        else:
                            results.append(cursor.rowcount)
                    return results
                    
        except Exception as e:
            logging.error(f"Transaction error: {e}")
            raise
        finally:
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
        
        # Execute the entire schema as one block (PostgreSQL can handle multiple statements)
        conn = None
        try:
            conn = get_db_connection()
            with conn:
                with conn.cursor() as cursor:
                    cursor.execute(schema_sql)
            
            logging.info("Database schema initialized successfully")
            return True
            
        except Exception as e:
            logging.error(f"Error initializing database: {e}")
            raise
        finally:
            if conn:
                return_db_connection(conn)
                
    except Exception as e:
        logging.error(f"Error reading schema file: {e}")
        raise