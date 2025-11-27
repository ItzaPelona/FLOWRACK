"""
User routes
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.models.user import User
from backend.routes.auth import get_current_user_id
from backend.database import db
import logging

users_bp = Blueprint('users', __name__)

@users_bp.route('', methods=['GET'])
@jwt_required()
def get_users():
    """Get all users (admin/operator only)"""
    try:
        current_user_id = get_current_user_id()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user or current_user.role not in ['admin', 'operator']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        # Query parameters
        role = request.args.get('role')
        limit = request.args.get('limit', type=int)
        offset = request.args.get('offset', type=int, default=0)
        
        users = User.get_all(role=role, limit=limit, offset=offset)
        
        return jsonify({
            'users': [user.to_dict() for user in users],
            'count': len(users)
        }), 200
        
    except Exception as e:
        logging.error(f"Get users error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@users_bp.route('/<int:user_id>', methods=['GET'])
@jwt_required()
def get_user(user_id):
    """Get specific user by ID"""
    try:
        current_user_id = get_current_user_id()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        # Users can only see their own profile, operators/admins can see all
        if current_user.role == 'user' and user_id != current_user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        user = User.get_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        user_data = user.to_dict()
        
        # Add statistics for the user
        if current_user.role in ['admin', 'operator'] or user_id == current_user_id:
            user_data['request_summary'] = user.get_request_summary()
            user_data['debt_summary'] = user.get_debt_summary()
        
        return jsonify(user_data), 200
        
    except Exception as e:
        logging.error(f"Get user error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@users_bp.route('', methods=['POST'])
@jwt_required()
def create_user():
    """Create new user (admin only)"""
    try:
        current_user_id = get_current_user_id()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        required_fields = ['registration_number', 'password', 'first_name', 'last_name', 'email']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Check if user already exists
        existing_user = User.get_by_registration_number(data['registration_number'])
        if existing_user:
            return jsonify({'error': 'User with this registration number already exists'}), 409
        
        existing_email = User.get_by_email(data['email'])
        if existing_email:
            return jsonify({'error': 'User with this email already exists'}), 409
        
        # Create new user
        user = User.create(
            registration_number=data['registration_number'],
            password=data['password'],
            first_name=data['first_name'],
            last_name=data['last_name'],
            email=data['email'],
            phone=data.get('phone'),
            role=data.get('role', 'user'),
            department=data.get('department')
        )
        
        if not user:
            return jsonify({'error': 'Failed to create user'}), 500
        
        return jsonify({
            'message': 'User created successfully',
            'user': user.to_dict()
        }), 201
        
    except Exception as e:
        logging.error(f"Create user error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@users_bp.route('/<int:user_id>', methods=['PUT'])
@jwt_required()
def update_user(user_id):
    """Update user information"""
    try:
        current_user_id = get_current_user_id()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        # Users can only update their own profile, admins can update all
        if current_user.role != 'admin' and user_id != current_user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        user = User.get_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Update user
        if user.update(**data):
            return jsonify({
                'message': 'User updated successfully',
                'user': user.to_dict()
            }), 200
        else:
            return jsonify({'error': 'No changes made'}), 400
        
    except Exception as e:
        logging.error(f"Update user error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@users_bp.route('/<int:user_id>', methods=['DELETE'])
@jwt_required()
def deactivate_user(user_id):
    """Deactivate user (admin only)"""
    try:
        current_user_id = get_current_user_id()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        if user_id == current_user_id:
            return jsonify({'error': 'Cannot deactivate your own account'}), 400
        
        user = User.get_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        if user.deactivate():
            return jsonify({'message': 'User deactivated successfully'}), 200
        else:
            return jsonify({'error': 'Failed to deactivate user'}), 500
        
    except Exception as e:
        logging.error(f"Deactivate user error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@users_bp.route('/strikes', methods=['GET'])
@jwt_required()
def get_current_user_strikes():
    """Get current user's strike history"""
    try:
        current_user_id = get_current_user_id()
        
        from backend.database import db
        
        # Get user's strikes
        query = """
            SELECT 
                us.*,
                r.request_number,
                u.first_name || ' ' || u.last_name as applied_by_name
            FROM user_strikes us
            LEFT JOIN requests r ON us.request_id = r.id
            LEFT JOIN users u ON us.applied_by = u.id
            WHERE us.user_id = %s
            ORDER BY us.created_at DESC
        """
        
        strikes = db.execute_query(query, (current_user_id,), fetch=True)
        
        return jsonify({
            'strikes': strikes or []
        }), 200
        
    except Exception as e:
        logging.error(f"Get user strikes error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@users_bp.route('/all-strikes', methods=['GET'])
@jwt_required()
def get_all_users_strikes():
    """Get all users with their strike counts (admin only)"""
    try:
        current_user_id = get_current_user_id()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Insufficient permissions. Admin access required.'}), 403
        
        from backend.database import db
        
        # Get all users with strike counts
        query = """
            SELECT 
                u.id,
                u.registration_number,
                u.first_name,
                u.last_name,
                u.email,
                u.department,
                u.role,
                COALESCE(u.strikes, 0) as strikes
            FROM users u
            ORDER BY u.strikes DESC NULLS LAST, u.last_name, u.first_name
        """
        
        users = db.execute_query(query, fetch=True)
        
        return jsonify({
            'users': users or []
        }), 200
        
    except Exception as e:
        logging.error(f"Get all strikes error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@users_bp.route('/<int:user_id>/strikes', methods=['GET'])
@jwt_required()
def get_user_strikes(user_id):
    """Get specific user's strike history (admin only)"""
    try:
        current_user_id = get_current_user_id()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Insufficient permissions. Admin access required.'}), 403
        
        from backend.database import db
        
        # Get user's strikes
        query = """
            SELECT 
                us.*,
                r.request_number,
                u.first_name || ' ' || u.last_name as applied_by_name
            FROM user_strikes us
            LEFT JOIN requests r ON us.request_id = r.id
            LEFT JOIN users u ON us.applied_by = u.id
            WHERE us.user_id = %s
            ORDER BY us.created_at DESC
        """
        
        strikes = db.execute_query(query, (user_id,), fetch=True)
        
        return jsonify({
            'strikes': strikes or []
        }), 200
        
    except Exception as e:
        logging.error(f"Get user strikes error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@users_bp.route('/<int:user_id>/strikes', methods=['DELETE'])
@jwt_required()
def clear_user_strikes(user_id):
    """Clear all strikes for a user (admin only)"""
    try:
        current_user_id = get_current_user_id()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Insufficient permissions. Admin access required.'}), 403
        
        user = User.get_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        from backend.database import db
        
        # Delete all strikes for the user
        db.execute_query(
            "DELETE FROM user_strikes WHERE user_id = %s",
            (user_id,)
        )
        
        # Reset strike count
        db.execute_query(
            "UPDATE users SET strikes = 0 WHERE id = %s",
            (user_id,)
        )
        
        return jsonify({
            'message': f'All strikes cleared for {user.full_name}'
        }), 200
        
    except Exception as e:
        logging.error(f"Clear user strikes error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@users_bp.route('/change-password', methods=['POST'])
@jwt_required()
def change_password():
    """Allow users to change their own password"""
    try:
        current_user_id = get_current_user_id()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        # Validate input
        if not data or not data.get('current_password') or not data.get('new_password'):
            return jsonify({'error': 'Current password and new password are required'}), 400
        
        current_password = data['current_password']
        new_password = data['new_password']
        
        # Verify minimum length for new password
        if len(new_password) < 6:
            return jsonify({'error': 'New password must be at least 6 characters'}), 400
        
        # Get current password hash from database
        query = "SELECT password_hash FROM users WHERE id = %s"
        result = db.execute_query(query, (current_user_id,), fetch=True, fetchone=True)
        
        if not result:
            return jsonify({'error': 'User not found'}), 404
        
        # Verify current password using static method
        if not User.check_password(current_password, result['password_hash']):
            return jsonify({'error': 'Current password is incorrect'}), 401
        
        # Update password
        import bcrypt
        
        password_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        db.execute_query(
            "UPDATE users SET password_hash = %s WHERE id = %s",
            (password_hash, current_user_id)
        )
        
        return jsonify({
            'message': 'Password changed successfully'
        }), 200
        
    except Exception as e:
        logging.error(f"Change password error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@users_bp.route('/update-profile', methods=['PUT'])
@jwt_required()
def update_profile():
    """Allow users to update their own profile information"""
    try:
        current_user_id = get_current_user_id()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Fields users can update
        allowed_fields = ['email', 'phone', 'first_name', 'last_name', 'department']
        updates = {}
        
        for field in allowed_fields:
            if field in data and data[field] is not None:
                # Validate email format if provided
                if field == 'email' and data[field]:
                    import re
                    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
                    if not re.match(email_pattern, data[field]):
                        return jsonify({'error': 'Invalid email format'}), 400
                
                updates[field] = data[field]
        
        if not updates:
            return jsonify({'error': 'No valid fields to update'}), 400
        
        # Build UPDATE query
        from backend.database import db
        
        set_clauses = ', '.join([f"{field} = %s" for field in updates.keys()])
        values = list(updates.values())
        values.append(current_user_id)
        
        query = f"UPDATE users SET {set_clauses} WHERE id = %s"
        db.execute_query(query, tuple(values))
        
        # Get updated user
        updated_user = User.get_by_id(current_user_id)
        
        return jsonify({
            'message': 'Profile updated successfully',
            'user': updated_user.to_dict()
        }), 200
        
    except Exception as e:
        logging.error(f"Update profile error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@users_bp.route('/register', methods=['POST'])
def register_user():
    """Public endpoint for user self-registration (creates pending account)"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['registration_number', 'password', 'first_name', 'last_name', 'email']
        for field in required_fields:
            if not data or not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Check if registration number already exists
        existing_user = User.get_by_registration_number(data['registration_number'])
        if existing_user:
            return jsonify({'error': 'Registration number already exists'}), 409
        
        # Validate email format
        import re
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, data['email']):
            return jsonify({'error': 'Invalid email format'}), 400
        
        # Validate password length
        if len(data['password']) < 6:
            return jsonify({'error': 'Password must be at least 6 characters'}), 400
        
        # Create user with pending status
        import bcrypt
        from backend.database import db
        
        password_hash = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        query = """
            INSERT INTO users (
                registration_number, password_hash, first_name, last_name, 
                email, phone, department, role, status, is_active
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """
        
        result = db.execute_query(
            query,
            (
                data['registration_number'],
                password_hash,
                data['first_name'],
                data['last_name'],
                data['email'],
                data.get('phone', ''),
                data.get('department', ''),
                'user',  # Default role
                'pending',  # Status set to pending
                False  # Not active until approved
            ),
            fetch=True
        )
        
        if result:
            return jsonify({
                'message': 'Registration submitted successfully! Your account is pending admin approval.',
                'registration_number': data['registration_number']
            }), 201
        else:
            return jsonify({'error': 'Failed to create account'}), 500
        
    except Exception as e:
        logging.error(f"Register user error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@users_bp.route('/pending', methods=['GET'])
@jwt_required()
def get_pending_users():
    """Get all pending user registrations (admin only)"""
    try:
        current_user_id = get_current_user_id()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Insufficient permissions. Admin access required.'}), 403
        
        from backend.database import db
        
        query = """
            SELECT 
                id, registration_number, first_name, last_name, 
                email, phone, department, created_at
            FROM users
            WHERE status = 'pending'
            ORDER BY created_at DESC
        """
        
        pending_users = db.execute_query(query, fetch=True)
        
        return jsonify({
            'users': pending_users or [],
            'count': len(pending_users) if pending_users else 0
        }), 200
        
    except Exception as e:
        logging.error(f"Get pending users error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@users_bp.route('/<int:user_id>/approve', methods=['POST'])
@jwt_required()
def approve_user(user_id):
    """Approve a pending user registration (admin only)"""
    try:
        current_user_id = get_current_user_id()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Insufficient permissions. Admin access required.'}), 403
        
        from backend.database import db
        
        # Fetch user directly without is_active filter (pending users may be inactive)
        user_data = db.execute_query(
            "SELECT id, registration_number, first_name, last_name, email, phone, role, department, is_active, created_at, updated_at, status, avatar_url FROM users WHERE id = %s",
            (user_id,),
            fetch=True,
            fetchone=True
        )
        
        if not user_data:
            return jsonify({'error': 'User not found'}), 404
        
        # Update user status to active
        db.execute_query(
            "UPDATE users SET status = 'active', is_active = TRUE WHERE id = %s",
            (user_id,)
        )
        
        return jsonify({
            'message': f'User {user_data["registration_number"]} approved successfully'
        }), 200
        
    except Exception as e:
        logging.error(f"Approve user error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@users_bp.route('/<int:user_id>/reject', methods=['DELETE'])
@jwt_required()
def reject_user(user_id):
    """Reject and delete a pending user registration (admin only)"""
    try:
        current_user_id = get_current_user_id()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Insufficient permissions. Admin access required.'}), 403
        
        user = User.get_by_id(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        from backend.database import db
        
        # Delete the pending user
        db.execute_query("DELETE FROM users WHERE id = %s AND status = 'pending'", (user_id,))
        
        return jsonify({
            'message': f'Registration for {user.registration_number} rejected and removed'
        }), 200
        
    except Exception as e:
        logging.error(f"Reject user error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@users_bp.route('/upload-avatar', methods=['POST'])
@jwt_required()
def upload_avatar():
    """Upload user avatar as base64 image"""
    try:
        current_user_id = get_current_user_id()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        if not data or not data.get('avatar_data'):
            return jsonify({'error': 'Avatar data is required'}), 400
        
        avatar_data = data['avatar_data']
        
        # Validate it's a valid base64 image data URL
        if not avatar_data.startswith('data:image/'):
            return jsonify({'error': 'Invalid image format. Must be a base64 data URL'}), 400
        
        # Optional: Limit size (e.g., 2MB in base64)
        if len(avatar_data) > 2 * 1024 * 1024:  # 2MB limit
            return jsonify({'error': 'Image too large. Maximum size is 2MB'}), 400
        
        # Update user avatar
        from backend.database import db
        
        db.execute_query(
            "UPDATE users SET avatar_url = %s WHERE id = %s",
            (avatar_data, current_user_id)
        )
        
        return jsonify({
            'message': 'Avatar uploaded successfully',
            'avatar_url': avatar_data
        }), 200
        
    except Exception as e:
        logging.error(f"Upload avatar error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@users_bp.route('/remove-avatar', methods=['DELETE'])
@jwt_required()
def remove_avatar():
    """Remove user avatar"""
    try:
        current_user_id = get_current_user_id()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        # Remove avatar
        from backend.database import db
        
        db.execute_query(
            "UPDATE users SET avatar_url = NULL WHERE id = %s",
            (current_user_id,)
        )
        
        return jsonify({
            'message': 'Avatar removed successfully'
        }), 200
        
    except Exception as e:
        logging.error(f"Remove avatar error: {e}")
        return jsonify({'error': 'Internal server error'}), 500
