"""Check and add status column if missing"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from backend.database import db

# Check if status column exists
result = db.execute_query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'status'",
    fetch=True
)

if result:
    print("✓ status column already exists")
else:
    print("✗ status column MISSING")
    print("\nAdding status column...")
    db.execute_query("ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active'")
    print("✓ status column added!")
    
    print("\nUpdating existing users to active status...")
    db.execute_query("UPDATE users SET status = 'active' WHERE status IS NULL OR status = ''")
    print("✓ Existing users updated!")
    
    print("\nCreating index...")
    db.execute_query("CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)")
    print("✓ Index created!")

print("\n✅ All migrations complete!")
