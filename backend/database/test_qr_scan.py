"""Test QR scanning directly"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from backend.models.request import Request

# Test with the new QR code
qr_code = "FLOWRACK:REQ-20251125-5112:pAsdR3l4bhZ1kvkmufa_LA"

print(f"Testing QR code: {qr_code}")
print("=" * 80)

req = Request.get_by_qr_code(qr_code)

if req:
    print("✓ REQUEST FOUND!")
    print(f"ID: {req.id}")
    print(f"Request Number: {req.request_number}")
    print(f"User ID: {req.user_id}")
    print(f"Status: {req.status}")
    print(f"QR Code in DB: {req.qr_code}")
else:
    print("✗ REQUEST NOT FOUND!")
    print("Checking what's in database...")
    from backend.database import db
    result = db.execute_query(
        "SELECT id, request_number, qr_code FROM requests WHERE request_number = %s",
        ("REQ-20251125-5112",),
        fetch=True
    )
    if result:
        print(f"Found in DB: {result[0]}")
    else:
        print("Not found in database at all!")
