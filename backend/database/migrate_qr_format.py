"""
Migrate existing QR codes from hash to full format
This fixes the QR code scanning issue
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from backend.database import db
import secrets

def migrate_qr_codes():
    """Update all existing QR codes to use full format instead of hash"""
    
    print("=" * 60)
    print("QR Code Migration: Hash → Full Format")
    print("=" * 60)
    print()
    
    # Get all requests with old hash-based QR codes
    requests = db.execute_query(
        "SELECT id, request_number, qr_code FROM requests ORDER BY id",
        fetch=True
    )
    
    if not requests:
        print("No requests found in database")
        return
    
    print(f"Found {len(requests)} requests to update")
    print()
    
    updated_count = 0
    
    for req in requests:
        request_id = req['id']
        request_number = req['request_number']
        old_qr = req['qr_code']
        
        # Check if QR code is already in new format (starts with "FLOWRACK:")
        if old_qr and old_qr.startswith('FLOWRACK:'):
            print(f"✓ Request #{request_id} ({request_number}): Already in new format")
            continue
        
        # Generate new QR code in full format
        token = secrets.token_urlsafe(16)
        new_qr_code = f"FLOWRACK:{request_number}:{token}"
        
        # Update database
        db.execute_query(
            "UPDATE requests SET qr_code = %s WHERE id = %s",
            (new_qr_code, request_id)
        )
        
        print(f"✓ Request #{request_id} ({request_number}):")
        print(f"  Old: {old_qr}")
        print(f"  New: {new_qr_code}")
        print()
        
        updated_count += 1
    
    print("=" * 60)
    print(f"Migration Complete!")
    print(f"  Updated: {updated_count} requests")
    print(f"  Skipped: {len(requests) - updated_count} requests")
    print("=" * 60)

if __name__ == '__main__':
    try:
        migrate_qr_codes()
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
