"""Complete QR workflow test"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from backend.models.request import Request
from backend.database import db

print("=" * 80)
print("QR CODE WORKFLOW TEST")
print("=" * 80)

# Test 1: Check most recent request
print("\n1. CHECKING MOST RECENT REQUEST")
print("-" * 80)
recent = db.execute_query(
    "SELECT id, request_number, qr_code, status, created_at FROM requests ORDER BY created_at DESC LIMIT 1",
    fetch=True
)

if recent:
    r = recent[0]
    print(f"✓ Found request: {r['request_number']}")
    print(f"  ID: {r['id']}")
    print(f"  Status: {r['status']}")
    print(f"  QR Code: {r['qr_code']}")
    print(f"  Created: {r['created_at']}")
    
    # Test 2: Try to retrieve by QR code
    print("\n2. TESTING QR CODE LOOKUP")
    print("-" * 80)
    qr_code = r['qr_code']
    req = Request.get_by_qr_code(qr_code)
    
    if req:
        print(f"✓ QR lookup successful!")
        print(f"  Retrieved request: {req.request_number}")
        print(f"  Status: {req.status}")
        print(f"  User ID: {req.user_id}")
    else:
        print(f"✗ QR lookup FAILED!")
        print(f"  Searched for: {qr_code}")
    
    # Test 3: Verify QR format
    print("\n3. VERIFYING QR FORMAT")
    print("-" * 80)
    if qr_code.startswith("FLOWRACK:"):
        parts = qr_code.split(":")
        print(f"✓ QR format is correct:")
        print(f"  Prefix: {parts[0]}")
        print(f"  Request Number: {parts[1]}")
        print(f"  Token: {parts[2]}")
    else:
        print(f"✗ QR format is WRONG (old hash format)")
        print(f"  Value: {qr_code}")
    
    # Test 4: Check if QR image exists
    print("\n4. CHECKING QR IMAGE")
    print("-" * 80)
    image_check = db.execute_query(
        "SELECT LENGTH(qr_code_image) as img_size FROM requests WHERE id = %s",
        (r['id'],),
        fetch=True
    )
    if image_check and image_check[0]['img_size']:
        print(f"✓ QR image exists ({image_check[0]['img_size']} bytes)")
    else:
        print(f"✗ No QR image found")
        
else:
    print("✗ No requests found in database!")

print("\n" + "=" * 80)
print("TEST COMPLETE")
print("=" * 80)
