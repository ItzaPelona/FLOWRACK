"""
User routes
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.models.user import User
import logging

users_bp = Blueprint('users', __name__)

@users_bp.route('', methods=['GET'])
@jwt_required()
def get_users():
    """Get all users (admin/operator only)"""
    try:
        current_user_id = get_jwt_identity()
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
        current_user_id = get_jwt_identity()
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
        current_user_id = get_jwt_identity()
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
        current_user_id = get_jwt_identity()
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
        current_user_id = get_jwt_identity()
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