"""
Test script to verify avatar_url is being returned in profile
"""
import sys
sys.path.insert(0, 'C:\\Users\\itzelh5\\FLOWRACK')

from backend.models.user import User

# Get admin user
user = User.get_by_registration_number('ADMIN001')
if user:
    print("User found:")
    print(f"  ID: {user.id}")
    print(f"  Name: {user.first_name} {user.last_name}")
    print(f"  Email: {user.email}")
    print(f"  Status: {getattr(user, 'status', 'N/A')}")
    print(f"  Avatar URL: {getattr(user, 'avatar_url', 'N/A')}")
    print("\nto_dict() output:")
    user_dict = user.to_dict()
    print(f"  Contains 'status': {'status' in user_dict}")
    print(f"  Contains 'avatar_url': {'avatar_url' in user_dict}")
    print(f"  Status value: {user_dict.get('status', 'N/A')}")
    print(f"  Avatar URL value: {user_dict.get('avatar_url', 'N/A')}")
else:
    print("User not found")
