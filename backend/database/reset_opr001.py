"""Reset OPR001 password to operator123"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from backend.database import db
import bcrypt

def reset_opr001_password():
    """Reset OPR001 password to operator123"""
    
    # Check if OPR001 exists
    result = db.execute_query(
        "SELECT registration_number, first_name, last_name FROM users WHERE registration_number = %s",
        ('OPR001',),
        fetch=True
    )
    
    if not result:
        print("❌ OPR001 not found in database")
        return False
        
    user = result[0]
    print(f"✓ Found user: {user['first_name']} {user['last_name']} ({user['registration_number']})")
    
    # Hash the password
    new_password = 'operator123'
    password_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Update the password (note: column is password_hash not password)
    rows_affected = db.execute_query(
        "UPDATE users SET password_hash = %s WHERE registration_number = %s",
        (password_hash, 'OPR001')
    )
    
    if rows_affected > 0:
        print(f"✓ Password reset successfully!")
        print(f"\nCredentials:")
        print(f"  Registration: OPR001")
        print(f"  Password: {new_password}")
        return True
    else:
        print("❌ Failed to update password")
        return False

if __name__ == '__main__':
    print("=" * 60)
    print("FlowRack - Reset OPR001 Password")
    print("=" * 60)
    print()
    
    try:
        success = reset_opr001_password()
        print()
        
        if success:
            print("=" * 60)
            print("Password reset complete!")
            print("You can now login with: OPR001 / operator123")
            print("=" * 60)
        else:
            print("Password reset failed")
            sys.exit(1)
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
