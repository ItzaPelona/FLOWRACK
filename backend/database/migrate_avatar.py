"""
Apply avatar field migration
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from backend.database import db

def apply_migration():
    """Apply the avatar_url migration"""
    try:
        print("Adding avatar_url field to users table...")
        
        # Read SQL file
        sql_file = os.path.join(os.path.dirname(__file__), 'add_avatar.sql')
        with open(sql_file, 'r') as f:
            sql = f.read()
        
        # Execute each statement
        statements = [s.strip() for s in sql.split(';') if s.strip() and not s.strip().startswith('--')]
        
        for statement in statements:
            if statement:
                db.execute_query(statement)
                print(f"✓ Executed: {statement[:60]}...")
        
        print("\n✅ Avatar migration completed successfully!")
        return True
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = apply_migration()
    sys.exit(0 if success else 1)
