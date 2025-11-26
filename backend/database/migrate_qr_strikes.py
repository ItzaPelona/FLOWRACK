"""
Migration script to add QR codes and strikes system to the database
Run this to update the database schema with new features
"""

import psycopg
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def run_migration():
    """Execute the migration SQL script"""
    try:
        # Database connection parameters from environment or defaults
        db_params = {
            'dbname': os.getenv('DB_NAME', 'flowrack'),
            'user': os.getenv('DB_USER', 'flowrack_user'),
            'password': os.getenv('DB_PASSWORD', 'your_password'),
            'host': os.getenv('DB_HOST', 'localhost'),
            'port': os.getenv('DB_PORT', '5432')
        }
        
        # Connect to database
        print("Connecting to database...")
        conn = psycopg.connect(**db_params)
        cursor = conn.cursor()
        
        # Read migration SQL file
        migration_file = Path(__file__).parent / 'add_qr_and_strikes.sql'
        print(f"Reading migration file: {migration_file}")
        
        with open(migration_file, 'r', encoding='utf-8') as f:
            migration_sql = f.read()
        
        # Execute migration
        print("Executing migration...")
        cursor.execute(migration_sql)
        conn.commit()
        
        print("✅ Migration completed successfully!")
        print("\nAdded features:")
        print("  - QR code field to requests table")
        print("  - Expected return datetime field")
        print("  - Actual return datetime field")
        print("  - Late return tracking (is_late flag)")
        print("  - Damaged item tracking (is_damaged flag)")
        print("  - Strikes counter in users table")
        print("  - User strikes history table")
        
        # Verify tables
        cursor.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'requests' 
            AND column_name IN ('qr_code', 'expected_return_datetime', 'actual_return_datetime', 'is_late', 'is_damaged')
        """)
        
        columns = cursor.fetchall()
        print(f"\n✓ Verified {len(columns)} new columns in requests table")
        
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            AND column_name IN ('strikes', 'last_strike_date')
        """)
        
        user_columns = cursor.fetchall()
        print(f"✓ Verified {len(user_columns)} new columns in users table")
        
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'user_strikes'
            )
        """)
        
        table_exists = cursor.fetchone()[0]
        print(f"✓ user_strikes table {'created' if table_exists else 'NOT FOUND'}")
        
        cursor.close()
        conn.close()
        
    except psycopg.Error as e:
        print(f"❌ Database error: {e}")
        return False
    except FileNotFoundError as e:
        print(f"❌ Migration file not found: {e}")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    
    return True

if __name__ == '__main__':
    print("=" * 60)
    print("FlowRack Database Migration: QR Codes & Strikes System")
    print("=" * 60)
    print()
    
    success = run_migration()
    
    if success:
        print("\n" + "=" * 60)
        print("Migration successful! Database is ready for new features.")
        print("=" * 60)
    else:
        print("\n" + "=" * 60)
        print("Migration failed! Please check the error messages above.")
        print("=" * 60)
