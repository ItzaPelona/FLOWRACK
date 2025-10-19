"""
WebSocket events for real-time communication
"""

from flask_socketio import emit, join_room, leave_room
from flask_jwt_extended import decode_token
from backend.app import socketio
from backend.models.user import User
import logging

# Store connected users
connected_users = {}

@socketio.on('connect')
def handle_connect(auth):
    """Handle client connection"""
    try:
        # Verify JWT token
        if auth and 'token' in auth:
            token = auth['token']
            decoded = decode_token(token)
            user_id = decoded['sub']
            
            user = User.get_by_id(user_id)
            if user:
                connected_users[request.sid] = {
                    'user_id': user_id,
                    'user': user.to_dict(),
                    'connected_at': datetime.utcnow()
                }
                
                # Join room based on user role
                join_room(f"role_{user.role}")
                join_room(f"user_{user_id}")
                
                emit('connected', {
                    'message': 'Connected successfully',
                    'user': user.to_dict()
                })
                
                # Notify operators about new user connection
                if user.role == 'user':
                    socketio.emit('user_connected', {
                        'user': user.to_dict(),
                        'timestamp': datetime.utcnow().isoformat()
                    }, room='role_operator')
                    
                logging.info(f"User {user.registration_number} connected via WebSocket")
            else:
                emit('error', {'message': 'Invalid user'})
                return False
        else:
            emit('error', {'message': 'Authentication required'})
            return False
            
    except Exception as e:
        logging.error(f"WebSocket connection error: {e}")
        emit('error', {'message': 'Connection failed'})
        return False

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    try:
        if request.sid in connected_users:
            user_info = connected_users[request.sid]
            user_id = user_info['user_id']
            user = user_info['user']
            
            # Leave rooms
            leave_room(f"role_{user['role']}")
            leave_room(f"user_{user_id}")
            
            # Notify operators about user disconnection
            if user['role'] == 'user':
                socketio.emit('user_disconnected', {
                    'user': user,
                    'timestamp': datetime.utcnow().isoformat()
                }, room='role_operator')
            
            del connected_users[request.sid]
            logging.info(f"User {user['registration_number']} disconnected from WebSocket")
            
    except Exception as e:
        logging.error(f"WebSocket disconnection error: {e}")

@socketio.on('join_room')
def handle_join_room(data):
    """Handle joining specific rooms"""
    try:
        if request.sid not in connected_users:
            emit('error', {'message': 'Not authenticated'})
            return
        
        room = data.get('room')
        if room:
            join_room(room)
            emit('joined_room', {'room': room})
            
    except Exception as e:
        logging.error(f"Join room error: {e}")
        emit('error', {'message': 'Failed to join room'})

@socketio.on('leave_room')
def handle_leave_room(data):
    """Handle leaving specific rooms"""
    try:
        room = data.get('room')
        if room:
            leave_room(room)
            emit('left_room', {'room': room})
            
    except Exception as e:
        logging.error(f"Leave room error: {e}")
        emit('error', {'message': 'Failed to leave room'})

# Utility functions to emit events to specific users/roles

def emit_to_user(user_id, event, data):
    """Emit event to specific user"""
    try:
        socketio.emit(event, data, room=f"user_{user_id}")
        logging.info(f"Emitted {event} to user {user_id}")
    except Exception as e:
        logging.error(f"Failed to emit {event} to user {user_id}: {e}")

def emit_to_role(role, event, data):
    """Emit event to all users with specific role"""
    try:
        socketio.emit(event, data, room=f"role_{role}")
        logging.info(f"Emitted {event} to role {role}")
    except Exception as e:
        logging.error(f"Failed to emit {event} to role {role}: {e}")

def emit_to_operators(event, data):
    """Emit event to all operators and admins"""
    try:
        socketio.emit(event, data, room='role_operator')
        socketio.emit(event, data, room='role_admin')
        logging.info(f"Emitted {event} to operators/admins")
    except Exception as e:
        logging.error(f"Failed to emit {event} to operators/admins: {e}")

# Event handlers for business logic events

def notify_request_created(request_data):
    """Notify about new request creation"""
    try:
        # Notify the user who created the request
        emit_to_user(request_data['user_id'], 'request_created', {
            'message': f"Your request {request_data['request_number']} has been created",
            'request': request_data
        })
        
        # Notify operators
        emit_to_operators('new_request', {
            'message': f"New request {request_data['request_number']} from {request_data.get('user_name', 'User')}",
            'request': request_data
        })
        
    except Exception as e:
        logging.error(f"Failed to notify request creation: {e}")

def notify_request_status_update(request_data, old_status, new_status):
    """Notify about request status update"""
    try:
        status_messages = {
            'approved': 'Your request has been approved',
            'collecting': 'Your materials are being prepared for delivery',
            'delivered': 'Your materials have been delivered',
            'returned': 'Your materials have been returned',
            'cancelled': 'Your request has been cancelled'
        }
        
        message = status_messages.get(new_status, f'Your request status has been updated to {new_status}')
        
        # Notify the user
        emit_to_user(request_data['user_id'], 'request_status_updated', {
            'message': message,
            'request': request_data,
            'old_status': old_status,
            'new_status': new_status
        })
        
        # Notify operators about status changes
        if new_status in ['delivered', 'returned']:
            emit_to_operators('delivery_updated', {
                'message': f"Request {request_data['request_number']} status updated to {new_status}",
                'request': request_data
            })
        
    except Exception as e:
        logging.error(f"Failed to notify request status update: {e}")

def notify_debt_created(debt_data):
    """Notify about new debt creation"""
    try:
        # Notify the user who has the debt
        emit_to_user(debt_data['user_id'], 'debt_created', {
            'message': f"A debt of ${debt_data['total_amount']} has been recorded for {debt_data.get('product_name', 'item')}",
            'debt': debt_data
        })
        
        # Notify operators
        emit_to_operators('debt_notification', {
            'message': f"New debt created for {debt_data.get('user_name', 'user')} - ${debt_data['total_amount']}",
            'debt': debt_data
        })
        
    except Exception as e:
        logging.error(f"Failed to notify debt creation: {e}")

def notify_low_stock(product_data):
    """Notify operators about low stock"""
    try:
        emit_to_operators('low_stock_alert', {
            'message': f"Low stock alert: {product_data['name']} (Current: {product_data['stock_quantity']}, Minimum: {product_data['minimum_stock']})",
            'product': product_data
        })
        
    except Exception as e:
        logging.error(f"Failed to notify low stock: {e}")

def broadcast_system_message(message, message_type='info'):
    """Broadcast system-wide message"""
    try:
        socketio.emit('system_message', {
            'message': message,
            'type': message_type,
            'timestamp': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logging.error(f"Failed to broadcast system message: {e}")

# Import datetime at the top of the file
from datetime import datetime