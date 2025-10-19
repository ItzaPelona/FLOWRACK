"""
Authentication routes
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, create_access_token, get_jwt_identity, get_jwt
from backend.models.user import User
import logging

auth_bp = Blueprint('auth', __name__)

# In-memory blacklist for JWT tokens (in production, use Redis)
blacklisted_tokens = set()

@auth_bp.route('/login', methods=['POST'])
def login():
    """User login endpoint"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        registration_number = data.get('registration_number')
        password = data.get('password')
        
        if not registration_number or not password:
            return jsonify({'error': 'Registration number and password are required'}), 400
        
        # Get user by registration number
        user = User.get_by_registration_number(registration_number)
        
        if not user:
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Check password
        user_with_hash = User.get_by_registration_number(registration_number)
        if not hasattr(user_with_hash, 'password_hash'):
            # Get password hash from database
            from backend.database import db
            query = "SELECT password_hash FROM users WHERE registration_number = %s"
            result = db.execute_query(query, (registration_number,), fetch=True, fetchone=True)
            if not result:
                return jsonify({'error': 'Invalid credentials'}), 401
            password_hash = result['password_hash']
        else:
            password_hash = user_with_hash.password_hash
        
        if not User.check_password(password, password_hash):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Create access token
        access_token = create_access_token(identity=user.id)
        
        return jsonify({
            'message': 'Login successful',
            'access_token': access_token,
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        logging.error(f"Login error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@auth_bp.route('/register', methods=['POST'])
def register():
    """User registration endpoint (admin only in production)"""
    try:
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
            'message': 'User registered successfully',
            'user': user.to_dict()
        }), 201
        
    except Exception as e:
        logging.error(f"Registration error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """User logout endpoint"""
    try:
        # Add token to blacklist
        jti = get_jwt()['jti']
        blacklisted_tokens.add(jti)
        
        return jsonify({'message': 'Logged out successfully'}), 200
        
    except Exception as e:
        logging.error(f"Logout error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    """Get current user profile"""
    try:
        current_user_id = get_jwt_identity()
        user = User.get_by_id(current_user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Get additional user statistics
        request_summary = user.get_request_summary()
        debt_summary = user.get_debt_summary()
        
        profile_data = user.to_dict()
        profile_data['statistics'] = {
            'requests': request_summary,
            'debts': debt_summary
        }
        
        return jsonify(profile_data), 200
        
    except Exception as e:
        logging.error(f"Profile error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@auth_bp.route('/change-password', methods=['POST'])
@jwt_required()
def change_password():
    """Change user password"""
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        old_password = data.get('old_password')
        new_password = data.get('new_password')
        
        if not old_password or not new_password:
            return jsonify({'error': 'Old password and new password are required'}), 400
        
        if len(new_password) < 6:
            return jsonify({'error': 'New password must be at least 6 characters long'}), 400
        
        user = User.get_by_id(current_user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Change password
        if not user.change_password(old_password, new_password):
            return jsonify({'error': 'Invalid old password'}), 400
        
        return jsonify({'message': 'Password changed successfully'}), 200
        
    except Exception as e:
        logging.error(f"Change password error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@auth_bp.route('/verify-token', methods=['POST'])
@jwt_required()
def verify_token():
    """Verify JWT token validity"""
    try:
        current_user_id = get_jwt_identity()
        jti = get_jwt()['jti']
        
        # Check if token is blacklisted
        if jti in blacklisted_tokens:
            return jsonify({'error': 'Token is blacklisted'}), 401
        
        user = User.get_by_id(current_user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({
            'valid': True,
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        logging.error(f"Token verification error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

# JWT token blacklist checker
from flask_jwt_extended import JWTManager

def check_if_token_revoked(jwt_header, jwt_payload):
    """Check if JWT token is revoked"""
    jti = jwt_payload['jti']
    return jti in blacklisted_tokens