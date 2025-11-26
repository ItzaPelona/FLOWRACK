"""Check if avatar_url column exists"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from backend.database import db

# Check columns
result = db.execute_query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position",
    fetch=True
)

print("Current columns in users table:")
print("=" * 40)
for row in result:
    print(f"- {row['column_name']}")

# Check if avatar_url exists
avatar_exists = any(r['column_name'] == 'avatar_url' for r in result)
print("\n" + "=" * 40)
if avatar_exists:
    print("✓ avatar_url column EXISTS")
else:
    print("✗ avatar_url column MISSING")
    print("\nAdding avatar_url column...")
    db.execute_query("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500)")
    print("✓ avatar_url column added successfully!")
