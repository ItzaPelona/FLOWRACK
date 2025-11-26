"""
Request routes
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.models.request import Request
from backend.models.user import User
from backend.models.product import Product
from backend.routes.auth import get_current_user_id
from datetime import datetime, date, time, timedelta
import logging

requests_bp = Blueprint('requests', __name__)

@requests_bp.route('', methods=['GET'])
@jwt_required()
def get_requests():
    """Get requests with optional filtering"""
    try:
        current_user_id = get_current_user_id()
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
        current_user_id = get_current_user_id()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        req = Request.get_by_id(request_id)
        if not req:
            return jsonify({'error': 'Request not found'}), 404
        
        # Regular users can only see their own requests
        if current_user.role == 'user' and req.user_id != current_user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        # Include user info for operators/admins, QR code for all
        include_user = current_user.role in ['operator', 'admin']
        req_dict = req.to_dict(include_items=True, include_user=include_user, include_qr_image=True)
        
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
        current_user_id = get_current_user_id()
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
            
            # Check if product exists and has sufficient stock
            product = Product.get_by_id(item['product_id'])
            if not product:
                return jsonify({'error': f'Product with ID {item["product_id"]} not found'}), 400
            
            if product.stock_quantity < item['requested_quantity']:
                return jsonify({'error': f'Insufficient stock for {product.name}. Available: {product.stock_quantity}'}), 400
        
        # Parse dates and times
        try:
            requested_date = datetime.strptime(data['requested_date'], '%Y-%m-%d').date()
            requested_time = datetime.strptime(data['requested_time'], '%H:%M').time()
        except ValueError:
            return jsonify({'error': 'Invalid date or time format. Use YYYY-MM-DD for date and HH:MM for time'}), 400
        
        # Validate date is at least 1 day in advance
        today = date.today()
        min_request_date = today + timedelta(days=1)
        
        if requested_date < min_request_date:
            return jsonify({
                'error': f'Requests must be made at least 1 day in advance. Minimum date: {min_request_date.isoformat()}'
            }), 400
        
        # Create request with new fields
        try:
            new_request = Request.create(
                user_id=current_user_id,
                requested_date=requested_date,
                requested_time=requested_time,
                items=items,
                expected_return_datetime=data.get('expected_return_datetime'),
                estimated_usage_period=data.get('estimated_usage_period'),
                supervising_instructor=data.get('supervising_instructor'),
                purpose=data.get('purpose'),
                notes=data.get('notes')
            )
        except ValueError as ve:
            return jsonify({'error': str(ve)}), 400
        
        if not new_request:
            return jsonify({'error': 'Failed to create request'}), 500
        
        # Return request with QR code image
        return jsonify({
            'message': 'Request created successfully! Your QR code has been generated.',
            'request': new_request.to_dict(include_items=True, include_qr_image=True)
        }), 201
        
    except Exception as e:
        logging.error(f"Create request error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Internal server error'}), 500

@requests_bp.route('/<int:request_id>/status', methods=['PUT'])
@jwt_required()
def update_request_status(request_id):
    """Update request status (operator/admin only)"""
    try:
        current_user_id = get_current_user_id()
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
        current_user_id = get_current_user_id()
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
        current_user_id = get_current_user_id()
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
        current_user_id = get_current_user_id()
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
        current_user_id = get_current_user_id()
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
        current_user_id = get_current_user_id()
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

@requests_bp.route('/scan-qr', methods=['POST'])
@jwt_required()
def scan_qr_code():
    """Scan QR code to retrieve request (operator/admin only)"""
    try:
        current_user_id = get_current_user_id()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user or current_user.role not in ['operator', 'admin']:
            return jsonify({'error': 'Insufficient permissions. Only operators and admins can scan QR codes.'}), 403
        
        data = request.get_json()
        if not data or not data.get('qr_code'):
            return jsonify({'error': 'QR code is required'}), 400
        
        qr_code = data['qr_code']
        
        # Get request by QR code
        req = Request.get_by_qr_code(qr_code)
        
        if not req:
            return jsonify({'error': 'Invalid QR code. Request not found.'}), 404
        
        # Return full request details with QR image
        req_dict = req.to_dict(include_items=True, include_user=True, include_qr_image=True)
        req_dict['availability'] = req.check_availability()
        
        return jsonify({
            'message': 'QR code scanned successfully',
            'request': req_dict
        }), 200
        
    except Exception as e:
        logging.error(f"Scan QR code error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@requests_bp.route('/<int:request_id>/deliver', methods=['POST'])
@jwt_required()
def deliver_request(request_id):
    """Operator scans QR and marks request as delivered/in_use (operator/admin only)"""
    try:
        current_user_id = get_current_user_id()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user or current_user.role not in ['operator', 'admin']:
            return jsonify({'error': 'Insufficient permissions. Only operators and admins can deliver materials.'}), 403
        
        req = Request.get_by_id(request_id)
        if not req:
            return jsonify({'error': 'Request not found'}), 404
        
        # Only approved requests can be delivered
        if req.status not in ['pending', 'approved']:
            return jsonify({'error': f'Only approved requests can be delivered. Current status: {req.status}'}), 400
        
        data = request.get_json() or {}
        notes = data.get('notes', '')
        
        # Update status to delivered (in use)
        delivery_note = f"[{datetime.now().strftime('%Y-%m-%d %H:%M')}] Material delivered by operator {current_user.registration_number}"
        if notes:
            delivery_note += f" - {notes}"
        
        if req.update_status('delivered', delivery_note, current_user_id):
            # Deduct stock quantities
            from backend.database import db
            for item in req.items:
                db.execute_query(
                    "UPDATE products SET stock_quantity = stock_quantity - %s WHERE id = %s",
                    (item.approved_quantity or item.requested_quantity, item.product_id)
                )
            
            return jsonify({
                'message': 'Material delivered successfully. Status changed to IN USE.',
                'request': req.to_dict(include_items=True, include_user=True)
            }), 200
        else:
            return jsonify({'error': 'Failed to deliver request'}), 500
        
    except Exception as e:
        logging.error(f"Deliver request error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Internal server error'}), 500

@requests_bp.route('/<int:request_id>/return', methods=['POST'])
@jwt_required()
def return_request(request_id):
    """Operator processes material return with condition assessment (operator/admin only)"""
    try:
        current_user_id = get_current_user_id()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user or current_user.role not in ['operator', 'admin']:
            return jsonify({'error': 'Insufficient permissions. Only operators and admins can process returns.'}), 403
        
        req = Request.get_by_id(request_id)
        if not req:
            return jsonify({'error': 'Request not found'}), 404
        
        # Only delivered requests can be returned
        if req.status != 'delivered':
            return jsonify({'error': f'Only delivered materials can be returned. Current status: {req.status}'}), 400
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Validate required fields
        condition = data.get('condition')  # 'good', 'damaged', 'broken'
        if not condition:
            return jsonify({'error': 'Material condition is required (good/damaged/broken)'}), 400
        
        if condition not in ['good', 'damaged', 'broken']:
            return jsonify({'error': 'Condition must be one of: good, damaged, broken'}), 400
        
        notes = data.get('notes', '')
        damage_description = data.get('damage_description', '')
        
        # Calculate if return is late
        now = datetime.now()
        is_late = False
        
        if req.expected_return_datetime:
            expected_return = req.expected_return_datetime
            if isinstance(expected_return, str):
                expected_return = datetime.fromisoformat(expected_return)
            is_late = now > expected_return
        
        from backend.database import db
        
        # Update request with return information
        update_query = """
            UPDATE requests
            SET status = 'returned',
                actual_return_datetime = %s,
                is_late = %s,
                is_damaged = %s,
                notes = COALESCE(notes || E'\\n', '') || %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """
        
        is_damaged = condition in ['damaged', 'broken']
        return_note = f"[{now.strftime('%Y-%m-%d %H:%M')}] Material returned - Condition: {condition.upper()}"
        if is_late:
            return_note += " (LATE RETURN)"
        if damage_description:
            return_note += f" - Damage: {damage_description}"
        if notes:
            return_note += f" - Notes: {notes}"
        
        db.execute_query(update_query, (now, is_late, is_damaged, return_note, request_id))
        
        # Apply penalties
        penalties_applied = []
        
        # 1. Late return = strike
        if is_late:
            strike_query = """
                INSERT INTO user_strikes (user_id, request_id, reason, applied_by)
                VALUES (%s, %s, %s, %s)
            """
            db.execute_query(
                strike_query,
                (req.user_id, request_id, f'Late return - returned at {now.strftime("%Y-%m-%d %H:%M")}', current_user_id)
            )
            
            # Update user strikes count
            db.execute_query(
                "UPDATE users SET strikes = COALESCE(strikes, 0) + 1 WHERE id = %s",
                (req.user_id,)
            )
            penalties_applied.append('1 strike for late return')
        
        # 2. Damaged/broken = debt entry
        if is_damaged:
            # Get total cost of materials
            total_cost = 0
            for item in req.items:
                product = Product.get_by_id(item.product_id)
                if product:
                    quantity = item.approved_quantity or item.requested_quantity
                    total_cost += float(product.unit_price or 0) * float(quantity)
            
            # Apply damage multiplier
            damage_multiplier = 0.5 if condition == 'damaged' else 1.0  # 50% for damaged, 100% for broken
            debt_amount = total_cost * damage_multiplier
            
            # Create debt entry
            debt_query = """
                INSERT INTO debts (user_id, request_id, amount, reason, created_by, status)
                VALUES (%s, %s, %s, %s, %s, 'pending')
            """
            debt_reason = f'{condition.upper()} material - {damage_description}' if damage_description else f'{condition.upper()} material'
            db.execute_query(
                debt_query,
                (req.user_id, request_id, debt_amount, debt_reason, current_user_id)
            )
            
            penalty_msg = f'Debt of ${debt_amount:.2f} created for {condition} materials'
            penalties_applied.append(penalty_msg)
        
        # Return stock to inventory (only if condition is good)
        if condition == 'good':
            for item in req.items:
                db.execute_query(
                    "UPDATE products SET stock_quantity = stock_quantity + %s WHERE id = %s",
                    (item.approved_quantity or item.requested_quantity, item.product_id)
                )
        
        # Refresh request
        updated_req = Request.get_by_id(request_id)
        
        response_message = 'Material returned successfully'
        if penalties_applied:
            response_message += '. Penalties applied: ' + ', '.join(penalties_applied)
        
        return jsonify({
            'message': response_message,
            'is_late': is_late,
            'is_damaged': is_damaged,
            'penalties': penalties_applied,
            'request': updated_req.to_dict(include_items=True, include_user=True)
        }), 200
        
    except Exception as e:
        logging.error(f"Return request error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Internal server error'}), 500

@requests_bp.route('/<int:request_id>/extend-return', methods=['POST'])
@jwt_required()
def extend_return_time(request_id):
    """Extend return time for a request (operator/admin only)"""
    try:
        current_user_id = get_current_user_id()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user or current_user.role not in ['operator', 'admin']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        req = Request.get_by_id(request_id)
        if not req:
            return jsonify({'error': 'Request not found'}), 404
        
        data = request.get_json()
        if not data or not data.get('new_return_datetime'):
            return jsonify({'error': 'new_return_datetime is required'}), 400
        
        # Parse new return datetime
        try:
            new_return_datetime = datetime.strptime(data['new_return_datetime'], '%Y-%m-%d %H:%M')
        except ValueError:
            return jsonify({'error': 'Invalid datetime format. Use YYYY-MM-DD HH:MM'}), 400
        
        # Validate new return time is in the future
        if new_return_datetime <= datetime.now():
            return jsonify({'error': 'New return time must be in the future'}), 400
        
        # Update expected return datetime
        from backend.database import db
        query = """
            UPDATE requests
            SET expected_return_datetime = %s,
                notes = COALESCE(notes || E'\\n', '') || %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """
        
        extension_note = f"[{datetime.now().strftime('%Y-%m-%d %H:%M')}] Return time extended by {current_user.full_name} to {new_return_datetime.strftime('%Y-%m-%d %H:%M')}"
        
        db.execute_query(query, (new_return_datetime, extension_note, request_id))
        
        # Refresh request
        updated_req = Request.get_by_id(request_id)
        
        return jsonify({
            'message': 'Return time extended successfully',
            'request': updated_req.to_dict(include_items=True, include_user=True)
        }), 200
        
    except Exception as e:
        logging.error(f"Extend return time error: {e}")
        return jsonify({'error': 'Internal server error'}), 500


# Operator-specific endpoints

@requests_bp.route('/pending-deliveries', methods=['GET'])
@jwt_required()
def get_pending_deliveries():
    """Get all approved requests waiting for pickup (operator/admin only)"""
    try:
        current_user_id = get_current_user_id()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user or current_user.role not in ['admin', 'operator']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        from backend.database import db
        
        # Get all approved requests that haven't been picked up yet
        query = """
            SELECT r.*, 
                   u.first_name || ' ' || u.last_name as user_name,
                   u.department,
                   u.phone,
                   COUNT(ri.id) as item_count
            FROM requests r
            JOIN users u ON r.user_id = u.id
            LEFT JOIN request_items ri ON r.id = ri.request_id
            WHERE r.status = 'approved' 
            AND r.delivery_date IS NULL
            GROUP BY r.id, u.first_name, u.last_name, u.department, u.phone
            ORDER BY r.created_at ASC
        """
        
        results = db.execute_query(query, fetch=True)
        
        pending_deliveries = []
        for row in results:
            delivery = {
                'id': row['id'],
                'request_number': row['request_number'],
                'user_name': row['user_name'],
                'department': row['department'],
                'phone': row['phone'],
                'purpose': row['purpose'],
                'priority': row.get('priority', 'normal'),
                'expected_return': row['expected_return_datetime'].isoformat() if row['expected_return_datetime'] else None,
                'created_at': row['created_at'].isoformat() if row['created_at'] else None,
                'item_count': row['item_count'],
                'notes': row.get('notes')
            }
            pending_deliveries.append(delivery)
        
        return jsonify({
            'pending_deliveries': pending_deliveries,
            'count': len(pending_deliveries)
        }), 200
        
    except Exception as e:
        logging.error(f"Get pending deliveries error: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@requests_bp.route('/todays-schedule', methods=['GET'])
@jwt_required()
def get_todays_schedule():
    """Get all pickups and returns scheduled for today (operator/admin only)"""
    try:
        current_user_id = get_current_user_id()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user or current_user.role not in ['admin', 'operator']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        from backend.database import db
        
        today = date.today()
        
        # Get approved requests expected to be picked up today (not yet picked up)
        pending_pickups_query = """
            SELECT r.*, 
                   u.first_name || ' ' || u.last_name as user_name,
                   u.department,
                   COUNT(ri.id) as item_count
            FROM requests r
            JOIN users u ON r.user_id = u.id
            LEFT JOIN request_items ri ON r.id = ri.request_id
            WHERE r.status = 'approved'
            AND r.delivery_date IS NULL
            AND DATE(r.created_at) = %s
            GROUP BY r.id, u.first_name, u.last_name, u.department
            ORDER BY r.created_at ASC
        """
        
        # Get requests expected to be returned today
        expected_returns_query = """
            SELECT r.*, 
                   u.first_name || ' ' || u.last_name as user_name,
                   u.department,
                   COUNT(ri.id) as item_count
            FROM requests r
            JOIN users u ON r.user_id = u.id
            LEFT JOIN request_items ri ON r.id = ri.request_id
            WHERE r.status IN ('delivered', 'approved')
            AND r.delivery_date IS NOT NULL
            AND r.return_date IS NULL
            AND DATE(r.expected_return_datetime) = %s
            GROUP BY r.id, u.first_name, u.last_name, u.department
            ORDER BY r.expected_return_datetime ASC
        """
        
        # Get requests actually returned today
        completed_returns_query = """
            SELECT r.*, 
                   u.first_name || ' ' || u.last_name as user_name,
                   u.department,
                   COUNT(ri.id) as item_count
            FROM requests r
            JOIN users u ON r.user_id = u.id
            LEFT JOIN request_items ri ON r.id = ri.request_id
            WHERE r.status = 'returned'
            AND DATE(r.return_date) = %s
            GROUP BY r.id, u.first_name, u.last_name, u.department
            ORDER BY r.return_date DESC
        """
        
        pending_pickups = db.execute_query(pending_pickups_query, (today,), fetch=True) or []
        expected_returns = db.execute_query(expected_returns_query, (today,), fetch=True) or []
        completed_returns = db.execute_query(completed_returns_query, (today,), fetch=True) or []
        
        def format_schedule_item(row, event_type):
            return {
                'id': row['id'],
                'request_number': row['request_number'],
                'user_name': row['user_name'],
                'department': row['department'],
                'purpose': row['purpose'],
                'item_count': row['item_count'],
                'event_type': event_type,
                'scheduled_time': (row.get('expected_return_datetime') or row.get('created_at')).isoformat() if row.get('expected_return_datetime') or row.get('created_at') else None,
                'actual_time': (row.get('delivery_date') or row.get('return_date')).isoformat() if row.get('delivery_date') or row.get('return_date') else None
            }
        
        schedule = {
            'pending_pickups': [format_schedule_item(row, 'pickup') for row in pending_pickups],
            'expected_returns': [format_schedule_item(row, 'return') for row in expected_returns],
            'completed_returns': [format_schedule_item(row, 'completed_return') for row in completed_returns],
            'date': today.isoformat(),
            'summary': {
                'pending_pickups_count': len(pending_pickups),
                'expected_returns_count': len(expected_returns),
                'completed_returns_count': len(completed_returns)
            }
        }
        
        return jsonify(schedule), 200
        
    except Exception as e:
        logging.error(f"Get today's schedule error: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@requests_bp.route('/delivery-history', methods=['GET'])
@jwt_required()
def get_delivery_history():
    """Get delivery history for the current operator"""
    try:
        current_user_id = get_current_user_id()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user or current_user.role not in ['admin', 'operator']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        from backend.database import db
        
        # Query parameters
        days = request.args.get('days', type=int, default=30)
        limit = request.args.get('limit', type=int, default=100)
        offset = request.args.get('offset', type=int, default=0)
        
        # Get requests that have been picked up or returned
        query = """
            SELECT r.*, 
                   u.first_name || ' ' || u.last_name as user_name,
                   u.department,
                   COUNT(ri.id) as item_count,
                   CASE 
                       WHEN r.return_date IS NOT NULL THEN 'returned'
                       WHEN r.delivery_date IS NOT NULL THEN 'delivered'
                       ELSE r.status
                   END as delivery_status
            FROM requests r
            JOIN users u ON r.user_id = u.id
            LEFT JOIN request_items ri ON r.id = ri.request_id
            WHERE (r.delivery_date IS NOT NULL OR r.return_date IS NOT NULL)
            AND r.created_at >= CURRENT_DATE - INTERVAL '%s days'
            GROUP BY r.id, u.first_name, u.last_name, u.department
            ORDER BY COALESCE(r.return_date, r.delivery_date, r.created_at) DESC
            LIMIT %s OFFSET %s
        """
        
        results = db.execute_query(query, (days, limit, offset), fetch=True)
        
        history = []
        for row in results:
            item = {
                'id': row['id'],
                'request_number': row['request_number'],
                'user_name': row['user_name'],
                'department': row['department'],
                'purpose': row['purpose'],
                'status': row['delivery_status'],
                'item_count': row['item_count'],
                'pickup_time': row['delivery_date'].isoformat() if row['delivery_date'] else None,
                'return_time': row['return_date'].isoformat() if row['return_date'] else None,
                'expected_return': row['expected_return_datetime'].isoformat() if row['expected_return_datetime'] else None,
                'was_on_time': row['return_date'] <= row['expected_return_datetime'] if (row['return_date'] and row['expected_return_datetime']) else None
            }
            history.append(item)
        
        # Get statistics
        stats_query = """
            SELECT 
                COUNT(*) as total_deliveries,
                COUNT(CASE WHEN r.delivery_date IS NOT NULL THEN 1 END) as total_pickups,
                COUNT(CASE WHEN r.return_date IS NOT NULL THEN 1 END) as total_returns,
                COUNT(CASE WHEN r.return_date IS NOT NULL AND r.return_date <= r.expected_return_datetime THEN 1 END) as on_time_returns,
                COUNT(CASE WHEN r.return_date IS NOT NULL AND r.return_date > r.expected_return_datetime THEN 1 END) as late_returns
            FROM requests r
            WHERE (r.delivery_date IS NOT NULL OR r.return_date IS NOT NULL)
            AND r.created_at >= CURRENT_DATE - INTERVAL '%s days'
        """
        
        stats = db.execute_query(stats_query, (days,), fetch=True, fetchone=True)
        
        return jsonify({
            'history': history,
            'count': len(history),
            'statistics': {
                'total_deliveries': stats['total_deliveries'] if stats else 0,
                'total_pickups': stats['total_pickups'] if stats else 0,
                'total_returns': stats['total_returns'] if stats else 0,
                'on_time_returns': stats['on_time_returns'] if stats else 0,
                'late_returns': stats['late_returns'] if stats else 0,
                'on_time_percentage': round((stats['on_time_returns'] / stats['total_returns'] * 100) if stats and stats['total_returns'] > 0 else 0, 1)
            },
            'period_days': days
        }), 200
        
    except Exception as e:
        logging.error(f"Get delivery history error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

