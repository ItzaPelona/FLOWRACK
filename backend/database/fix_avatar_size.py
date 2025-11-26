"""Increase avatar_url column size"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from backend.database import db

print("Increasing avatar_url column size to handle larger images...")

# Change to TEXT type for unlimited size
db.execute_query("ALTER TABLE users ALTER COLUMN avatar_url TYPE TEXT")

print("✅ avatar_url column changed to TEXT type (unlimited size)")
print("\nYou can now upload images of any size (up to 2MB frontend limit)")
