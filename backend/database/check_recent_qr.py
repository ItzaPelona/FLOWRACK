"""Check most recent QR codes"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from backend.database import db

# Get recent requests
requests = db.execute_query(
    "SELECT id, request_number, qr_code, created_at FROM requests ORDER BY created_at DESC LIMIT 5",
    fetch=True
)

print("=" * 80)
print("RECENT REQUESTS AND QR CODES")
print("=" * 80)

for r in requests:
    print(f"ID: {r['id']}")
    print(f"Number: {r['request_number']}")
    print(f"QR Code: {r['qr_code']}")
    print(f"Created: {r['created_at']}")
    print("-" * 80)
