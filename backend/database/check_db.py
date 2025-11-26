"""
Database diagnostic script
Run this to check database connection and user data
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Add project root to path (go up 2 levels from this file)
project_root = Path(__file__).resolve().parents[2]
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

# Load environment variables
load_dotenv()

def check_database_connection():
    """Check if database connection works"""
    try:
        from backend.database import get_db_connection
        print("=" * 60)
        print("DATABASE CONNECTION TEST")
        print("=" * 60)
        
        print(f"\nDatabase Configuration:")
        print(f"  Host: {os.getenv('DB_HOST', 'localhost')}")
        print(f"  Port: {os.getenv('DB_PORT', '5432')}")
        print(f"  Database: {os.getenv('DB_NAME', 'flowrack')}")
        print(f"  User: {os.getenv('DB_USER', 'flowrack_user')}")
        
        conn = get_db_connection()
        print("\n✓ Database connection successful!")
        
        # Check if users table exists
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'users'
                ) as exists
            """)
            result = cursor.fetchone()
            table_exists = result['exists'] if result else False
            
            if table_exists:
                print("✓ Users table exists")
                
                # Count users
                cursor.execute("SELECT COUNT(*) as count FROM users")
                result = cursor.fetchone()
                count = result['count'] if result else 0
                print(f"✓ Found {count} users in database")
                
                # Check for admin user
                cursor.execute("""
                    SELECT registration_number, first_name, last_name, role, is_active 
                    FROM users 
                    WHERE registration_number = 'ADMIN001'
                """)
                admin = cursor.fetchone()
                
                if admin:
                    print(f"\n✓ Admin user found:")
                    print(f"  Registration: {admin['registration_number']}")
                    print(f"  Name: {admin['first_name']} {admin['last_name']}")
                    print(f"  Role: {admin['role']}")
                    print(f"  Active: {admin['is_active']}")
                    
                    # Check password hash
                    cursor.execute("""
                        SELECT password_hash 
                        FROM users 
                        WHERE registration_number = 'ADMIN001'
                    """)
                    pwd_hash = cursor.fetchone()
                    if pwd_hash and pwd_hash['password_hash']:
                        print(f"  Password hash: {pwd_hash['password_hash'][:50]}...")
                        
                        # Test password verification
                        from backend.models.user import User
                        test_password = "admin123"
                        is_valid = User.check_password(test_password, pwd_hash['password_hash'])
                        if is_valid:
                            print(f"  ✓ Password 'admin123' is VALID")
                        else:
                            print(f"  ✗ Password 'admin123' is INVALID - This is the problem!")
                    else:
                        print(f"  ✗ No password hash found!")
                else:
                    print("\n✗ Admin user NOT found in database")
                    print("  Run init.bat and choose to initialize the database")
                
                # List all users
                cursor.execute("""
                    SELECT registration_number, first_name, last_name, role 
                    FROM users 
                    ORDER BY created_at
                """)
                users = cursor.fetchall()
                if users:
                    print(f"\nAll users in database:")
                    for user in users:
                        print(f"  - {user['registration_number']}: {user['first_name']} {user['last_name']} ({user['role']})")
                
            else:
                print("✗ Users table does NOT exist")
                print("  Run init.bat and choose to initialize the database")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_login():
    """Test login functionality"""
    try:
        from backend.models.user import User
        
        print("\n" + "=" * 60)
        print("LOGIN TEST")
        print("=" * 60)
        
        registration_number = "ADMIN001"
        password = "admin123"
        
        print(f"\nAttempting to login with:")
        print(f"  Registration: {registration_number}")
        print(f"  Password: {password}")
        
        # Get user
        user = User.get_by_registration_number(registration_number)
        
        if not user:
            print(f"\n✗ User '{registration_number}' not found in database")
            return False
        
        print(f"\n✓ User found: {user.first_name} {user.last_name}")
        
        # Get password hash
        from backend.database import db
        query = "SELECT password_hash FROM users WHERE registration_number = %s"
        result = db.execute_query(query, (registration_number,), fetch=True, fetchone=True)
        
        if not result:
            print("✗ Could not retrieve password hash")
            return False
        
        password_hash = result['password_hash']
        print(f"Password hash: {password_hash[:50]}...")
        
        # Check password
        is_valid = User.check_password(password, password_hash)
        
        if is_valid:
            print("\n✓ PASSWORD IS VALID - Login should work!")
            return True
        else:
            print("\n✗ PASSWORD IS INVALID - Login will fail!")
            print("\nPossible causes:")
            print("  1. Password was hashed with different method")
            print("  2. Database was not initialized properly")
            print("  3. Password hash is corrupted")
            print("\nSolution: Run init.bat and reinitialize the database")
            return False
        
    except Exception as e:
        print(f"\n✗ Error during login test: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    print("\n" + "=" * 60)
    print("FLOWRACK DATABASE DIAGNOSTIC")
    print("=" * 60)
    
    success = check_database_connection()
    
    if success:
        test_login()
    
    print("\n" + "=" * 60)
    print("DIAGNOSTIC COMPLETE")
    print("=" * 60)
    print("\nIf there are issues, run: init.bat")
    print("Then choose 'y' to initialize/reset the database\n")
