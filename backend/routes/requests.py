"""
Request routes
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.models.request import Request
from backend.models.user import User
from backend.models.product import Product
from datetime import datetime, date, time
import logging

requests_bp = Blueprint('requests', __name__)

@requests_bp.route('', methods=['GET'])
@jwt_required()
def get_requests():
    """Get requests with optional filtering"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        # Query parameters
        status = request.args.get('status')
        user_id = request.args.get('user_id', type=int)
        limit = request.args.get('limit', type=int, default=50)
        offset = request.args.get('offset', type=int, default=0)
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        
        # Parse dates if provided
        parsed_date_from = None
        parsed_date_to = None
        
        if date_from:
            try:
                parsed_date_from = datetime.strptime(date_from, '%Y-%m-%d').date()
            except ValueError:
                return jsonify({'error': 'Invalid date_from format. Use YYYY-MM-DD'}), 400
        
        if date_to:
            try:
                parsed_date_to = datetime.strptime(date_to, '%Y-%m-%d').date()
            except ValueError:
                return jsonify({'error': 'Invalid date_to format. Use YYYY-MM-DD'}), 400
        
        # Regular users can only see their own requests
        if current_user.role == 'user':
            user_id = current_user_id
        
        # Get requests
        requests = Request.get_all(
            status=status,
            user_id=user_id,
            limit=limit,
            offset=offset,
            date_from=parsed_date_from,
            date_to=parsed_date_to
        )
        
        # Convert to dict with items and user info for operators/admins
        include_user = current_user.role in ['operator', 'admin']
        requests_data = []
        
        for req in requests:
            req_dict = req.to_dict(include_items=True, include_user=include_user)
            requests_data.append(req_dict)
        
        return jsonify({
            'requests': requests_data,
            'count': len(requests_data)
        }), 200
        
    except Exception as e:
        logging.error(f"Get requests error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@requests_bp.route('/<int:request_id>', methods=['GET'])
@jwt_required()
def get_request(request_id):
    """Get specific request by ID"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        req = Request.get_by_id(request_id)
        if not req:
            return jsonify({'error': 'Request not found'}), 404
        
        # Regular users can only see their own requests
        if current_user.role == 'user' and req.user_id != current_user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        # Include user info for operators/admins
        include_user = current_user.role in ['operator', 'admin']
        req_dict = req.to_dict(include_items=True, include_user=include_user)
        
        # Add availability check
        req_dict['availability'] = req.check_availability()
        
        return jsonify(req_dict), 200
        
    except Exception as e:
        logging.error(f"Get request error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@requests_bp.route('', methods=['POST'])
@jwt_required()
def create_request():
    """Create new request"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Validate required fields
        required_fields = ['requested_date', 'requested_time', 'items']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Validate items
        items = data.get('items', [])
        if not items or len(items) == 0:
            return jsonify({'error': 'At least one item is required'}), 400
        
        # Validate each item
        for item in items:
            if not item.get('product_id') or not item.get('requested_quantity'):
                return jsonify({'error': 'Each item must have product_id and requested_quantity'}), 400
            
            try:
                item['requested_quantity'] = float(item['requested_quantity'])
                if item['requested_quantity'] <= 0:
                    return jsonify({'error': 'Requested quantity must be greater than 0'}), 400
            except (ValueError, TypeError):
                return jsonify({'error': 'Invalid requested_quantity'}), 400
            
            # Check if product exists
            product = Product.get_by_id(item['product_id'])
            if not product:
                return jsonify({'error': f'Product with ID {item["product_id"]} not found'}), 400
        
        # Parse dates and times
        try:
            requested_date = datetime.strptime(data['requested_date'], '%Y-%m-%d').date()
            requested_time = datetime.strptime(data['requested_time'], '%H:%M').time()
        except ValueError:
            return jsonify({'error': 'Invalid date or time format'}), 400
        
        # Validate date is not in the past
        if requested_date < date.today():
            return jsonify({'error': 'Requested date cannot be in the past'}), 400
        
        # Create request
        new_request = Request.create(
            user_id=current_user_id,
            requested_date=requested_date,
            requested_time=requested_time,
            items=items,
            estimated_usage_period=data.get('estimated_usage_period'),
            supervising_instructor=data.get('supervising_instructor'),
            purpose=data.get('purpose')
        )
        
        if not new_request:
            return jsonify({'error': 'Failed to create request'}), 500
        
        return jsonify({
            'message': 'Request created successfully',
            'request': new_request.to_dict(include_items=True)
        }), 201
        
    except Exception as e:
        logging.error(f"Create request error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@requests_bp.route('/<int:request_id>/status', methods=['PUT'])
@jwt_required()
def update_request_status(request_id):
    """Update request status (operator/admin only)"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user or current_user.role not in ['operator', 'admin']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        req = Request.get_by_id(request_id)
        if not req:
            return jsonify({'error': 'Request not found'}), 404
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        new_status = data.get('status')
        notes = data.get('notes')
        
        if not new_status:
            return jsonify({'error': 'Status is required'}), 400
        
        valid_statuses = ['pending', 'approved', 'collecting', 'delivered', 'returned', 'cancelled']
        if new_status not in valid_statuses:
            return jsonify({'error': f'Invalid status. Must be one of: {", ".join(valid_statuses)}'}), 400
        
        # Update status
        if req.update_status(new_status, notes, current_user_id):
            return jsonify({
                'message': 'Request status updated successfully',
                'request': req.to_dict(include_items=True, include_user=True)
            }), 200
        else:
            return jsonify({'error': 'Failed to update request status'}), 500
        
    except Exception as e:
        logging.error(f"Update request status error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@requests_bp.route('/<int:request_id>/approve', methods=['POST'])
@jwt_required()
def approve_request(request_id):
    """Approve request with specific quantities (operator/admin only)"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user or current_user.role not in ['operator', 'admin']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        req = Request.get_by_id(request_id)
        if not req:
            return jsonify({'error': 'Request not found'}), 404
        
        if req.status != 'pending':
            return jsonify({'error': 'Only pending requests can be approved'}), 400
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        item_approvals = data.get('item_approvals', [])
        if not item_approvals:
            return jsonify({'error': 'Item approvals are required'}), 400
        
        # Validate item approvals
        for approval in item_approvals:
            if not approval.get('item_id') or approval.get('approved_quantity') is None:
                return jsonify({'error': 'Each approval must have item_id and approved_quantity'}), 400
            
            try:
                approval['approved_quantity'] = float(approval['approved_quantity'])
                if approval['approved_quantity'] < 0:
                    return jsonify({'error': 'Approved quantity cannot be negative'}), 400
            except (ValueError, TypeError):
                return jsonify({'error': 'Invalid approved_quantity'}), 400
        
        # Approve items
        if req.approve_items(item_approvals):
            return jsonify({
                'message': 'Request approved successfully',
                'request': req.to_dict(include_items=True, include_user=True)
            }), 200
        else:
            return jsonify({'error': 'Failed to approve request'}), 500
        
    except Exception as e:
        logging.error(f"Approve request error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@requests_bp.route('/<int:request_id>/cancel', methods=['POST'])
@jwt_required()
def cancel_request(request_id):
    """Cancel request"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        req = Request.get_by_id(request_id)
        if not req:
            return jsonify({'error': 'Request not found'}), 404
        
        # Users can only cancel their own requests, operators/admins can cancel any
        if current_user.role == 'user' and req.user_id != current_user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        # Only pending and approved requests can be cancelled
        if req.status not in ['pending', 'approved']:
            return jsonify({'error': 'Only pending or approved requests can be cancelled'}), 400
        
        data = request.get_json() or {}
        reason = data.get('reason', '')
        
        # Cancel request
        if req.update_status('cancelled', reason, current_user_id):
            return jsonify({
                'message': 'Request cancelled successfully',
                'request': req.to_dict(include_items=True)
            }), 200
        else:
            return jsonify({'error': 'Failed to cancel request'}), 500
        
    except Exception as e:
        logging.error(f"Cancel request error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@requests_bp.route('/<int:request_id>/delivery/weights', methods=['POST'])
@jwt_required()
def record_delivery_weights(request_id):
    """Record weights during delivery (operator/admin only)"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user or current_user.role not in ['operator', 'admin']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        req = Request.get_by_id(request_id)
        if not req:
            return jsonify({'error': 'Request not found'}), 404
        
        if req.status != 'collecting':
            return jsonify({'error': 'Request must be in collecting status to record delivery weights'}), 400
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        weight_data = data.get('weights', [])
        if not weight_data:
            return jsonify({'error': 'Weight data is required'}), 400
        
        # Record weights
        if req.record_delivery_weights(weight_data):
            # Update status to delivered
            req.update_status('delivered', 'Delivery weights recorded', current_user_id)
            
            return jsonify({
                'message': 'Delivery weights recorded successfully',
                'request': req.to_dict(include_items=True)
            }), 200
        else:
            return jsonify({'error': 'Failed to record delivery weights'}), 500
        
    except Exception as e:
        logging.error(f"Record delivery weights error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@requests_bp.route('/<int:request_id>/return/weights', methods=['POST'])
@jwt_required()
def record_return_weights(request_id):
    """Record weights during return (operator/admin only)"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user or current_user.role not in ['operator', 'admin']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        req = Request.get_by_id(request_id)
        if not req:
            return jsonify({'error': 'Request not found'}), 404
        
        if req.status != 'delivered':
            return jsonify({'error': 'Request must be delivered to record return weights'}), 400
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        weight_data = data.get('weights', [])
        if not weight_data:
            return jsonify({'error': 'Weight data is required'}), 400
        
        # Record weights
        if req.record_return_weights(weight_data):
            # Update status to returned
            req.update_status('returned', 'Return weights recorded', current_user_id)
            
            return jsonify({
                'message': 'Return weights recorded successfully',
                'request': req.to_dict(include_items=True)
            }), 200
        else:
            return jsonify({'error': 'Failed to record return weights'}), 500
        
    except Exception as e:
        logging.error(f"Record return weights error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@requests_bp.route('/statistics', methods=['GET'])
@jwt_required()
def get_request_statistics():
    """Get request statistics (operator/admin only)"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user or current_user.role not in ['operator', 'admin']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        # Get statistics from database
        query = """
            SELECT 
                COUNT(*) as total_requests,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_requests,
                COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_requests,
                COUNT(CASE WHEN status = 'collecting' THEN 1 END) as collecting_requests,
                COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_requests,
                COUNT(CASE WHEN status = 'returned' THEN 1 END) as completed_requests,
                COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_requests,
                COUNT(CASE WHEN requested_date = CURRENT_DATE THEN 1 END) as today_requests
            FROM requests
            WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        """
        
        from backend.database import db
        result = db.execute_query(query, fetch=True, fetchone=True)
        
        statistics = dict(result) if result else {}
        
        return jsonify({
            'statistics': statistics
        }), 200
        
    except Exception as e:
        logging.error(f"Get request statistics error: {e}")
        return jsonify({'error': 'Internal server error'}), 500