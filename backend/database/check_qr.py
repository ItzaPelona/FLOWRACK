"""Check QR code in database"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from backend.database import db

def check_qr_code(qr_code):
    """Check if QR code exists in database"""
    
    print(f"Searching for QR code: {qr_code}")
    print("=" * 60)
    
    # Check in requests table
    query = """
        SELECT 
            id,
            request_number,
            qr_code,
            status,
            user_id,
            created_at
        FROM requests
        WHERE qr_code = %s
    """
    
    result = db.execute_query(query, (qr_code,), fetch=True)
    
    if result:
        print("✓ QR code FOUND in database!")
        print()
        for req in result:
            print(f"Request ID: {req['id']}")
            print(f"Request Number: {req['request_number']}")
            print(f"QR Code: {req['qr_code']}")
            print(f"Status: {req['status']}")
            print(f"User ID: {req['user_id']}")
            print(f"Created: {req['created_at']}")
    else:
        print("✗ QR code NOT found in database")
        print()
        
        # Show all QR codes in database
        all_qr = db.execute_query(
            "SELECT id, request_number, qr_code FROM requests ORDER BY id DESC LIMIT 10",
            fetch=True
        )
        
        if all_qr:
            print("Recent QR codes in database:")
            for req in all_qr:
                print(f"  - {req['request_number']}: {req['qr_code']}")
        else:
            print("No requests found in database at all")

if __name__ == '__main__':
    if len(sys.argv) > 1:
        qr_code = sys.argv[1]
    else:
        qr_code = input("Enter QR code to check: ")
    
    check_qr_code(qr_code)
