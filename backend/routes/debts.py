"""
Debt routes
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.models.user import User
import logging

debts_bp = Blueprint('debts', __name__)

@debts_bp.route('', methods=['GET'])
@jwt_required()
def get_debts():
    """Get debts with optional filtering"""
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
        
        # Regular users can only see their own debts
        if current_user.role == 'user':
            user_id = current_user_id
        
        # Build query
        from backend.database import db
        
        query = """
            SELECT d.*, u.first_name || ' ' || u.last_name as user_name,
                   u.registration_number, p.name as product_name,
                   r.request_number
            FROM debts d
            JOIN users u ON d.user_id = u.id
            JOIN products p ON d.product_id = p.id
            LEFT JOIN requests r ON d.request_id = r.id
            WHERE 1=1
        """
        params = []
        
        if user_id:
            query += " AND d.user_id = %s"
            params.append(user_id)
        
        if status:
            query += " AND d.status = %s"
            params.append(status)
        
        query += " ORDER BY d.created_at DESC"
        
        if limit:
            query += " LIMIT %s"
            params.append(limit)
        
        if offset:
            query += " OFFSET %s"
            params.append(offset)
        
        debts = db.execute_query(query, params, fetch=True)
        
        return jsonify({
            'debts': debts or [],
            'count': len(debts) if debts else 0
        }), 200
        
    except Exception as e:
        logging.error(f"Get debts error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@debts_bp.route('/<int:debt_id>', methods=['GET'])
@jwt_required()
def get_debt(debt_id):
    """Get specific debt by ID"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        from backend.database import db
        
        query = """
            SELECT d.*, u.first_name || ' ' || u.last_name as user_name,
                   u.registration_number, p.name as product_name,
                   r.request_number, cb.first_name || ' ' || cb.last_name as created_by_name,
                   rb.first_name || ' ' || rb.last_name as resolved_by_name
            FROM debts d
            JOIN users u ON d.user_id = u.id
            JOIN products p ON d.product_id = p.id
            LEFT JOIN requests r ON d.request_id = r.id
            LEFT JOIN users cb ON d.created_by = cb.id
            LEFT JOIN users rb ON d.resolved_by = rb.id
            WHERE d.id = %s
        """
        
        debt = db.execute_query(query, (debt_id,), fetch=True, fetchone=True)
        
        if not debt:
            return jsonify({'error': 'Debt not found'}), 404
        
        # Regular users can only see their own debts
        if current_user.role == 'user' and debt['user_id'] != current_user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        return jsonify(debt), 200
        
    except Exception as e:
        logging.error(f"Get debt error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@debts_bp.route('', methods=['POST'])
@jwt_required()
def create_debt():
    """Create new debt (operator/admin only)"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user or current_user.role not in ['operator', 'admin']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        required_fields = ['user_id', 'product_id', 'quantity', 'unit_price']
        for field in required_fields:
            if data.get(field) is None:
                return jsonify({'error': f'{field} is required'}), 400
        
        # Validate numeric fields
        try:
            quantity = float(data['quantity'])
            unit_price = float(data['unit_price'])
            total_amount = quantity * unit_price
            
            if quantity <= 0 or unit_price < 0:
                return jsonify({'error': 'Invalid quantity or unit price'}), 400
                
        except (ValueError, TypeError):
            return jsonify({'error': 'Invalid numeric values'}), 400
        
        from backend.database import db
        
        query = """
            INSERT INTO debts (user_id, product_id, request_id, debt_type, quantity,
                             unit_price, total_amount, description, created_by, due_date)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, user_id, product_id, debt_type, quantity, unit_price,
                     total_amount, status, description, created_at
        """
        
        params = (
            data['user_id'], data['product_id'], data.get('request_id'),
            data.get('debt_type', 'missing'), quantity, unit_price, total_amount,
            data.get('description'), current_user_id, data.get('due_date')
        )
        
        result = db.execute_query(query, params, fetch=True, fetchone=True)
        
        if result:
            return jsonify({
                'message': 'Debt created successfully',
                'debt': dict(result)
            }), 201
        else:
            return jsonify({'error': 'Failed to create debt'}), 500
        
    except Exception as e:
        logging.error(f"Create debt error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@debts_bp.route('/<int:debt_id>/resolve', methods=['POST'])
@jwt_required()
def resolve_debt(debt_id):
    """Resolve debt (operator/admin only)"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user or current_user.role not in ['operator', 'admin']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        resolution_status = data.get('status')  # 'paid', 'waived', 'disputed'
        notes = data.get('notes', '')
        
        if not resolution_status or resolution_status not in ['paid', 'waived', 'disputed']:
            return jsonify({'error': 'Invalid resolution status'}), 400
        
        from backend.database import db
        
        # Check if debt exists and is pending
        check_query = "SELECT * FROM debts WHERE id = %s AND status = 'pending'"
        debt = db.execute_query(check_query, (debt_id,), fetch=True, fetchone=True)
        
        if not debt:
            return jsonify({'error': 'Debt not found or already resolved'}), 404
        
        # Update debt
        update_query = """
            UPDATE debts 
            SET status = %s, resolved_by = %s, resolved_date = CURRENT_TIMESTAMP,
                description = CASE WHEN %s != '' THEN CONCAT(COALESCE(description, ''), ' | Resolution: ', %s) ELSE description END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING *
        """
        
        result = db.execute_query(update_query, (resolution_status, current_user_id, notes, notes, debt_id), 
                                fetch=True, fetchone=True)
        
        if result:
            return jsonify({
                'message': 'Debt resolved successfully',
                'debt': dict(result)
            }), 200
        else:
            return jsonify({'error': 'Failed to resolve debt'}), 500
        
    except Exception as e:
        logging.error(f"Resolve debt error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@debts_bp.route('/statistics', methods=['GET'])
@jwt_required()
def get_debt_statistics():
    """Get debt statistics (operator/admin only)"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user or current_user.role not in ['operator', 'admin']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        from backend.database import db
        
        query = """
            SELECT 
                COUNT(*) as total_debts,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_debts,
                COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_debts,
                COUNT(CASE WHEN status = 'waived' THEN 1 END) as waived_debts,
                COUNT(CASE WHEN status = 'disputed' THEN 1 END) as disputed_debts,
                COALESCE(SUM(CASE WHEN status = 'pending' THEN total_amount ELSE 0 END), 0) as pending_amount,
                COALESCE(SUM(total_amount), 0) as total_amount,
                COUNT(DISTINCT user_id) as users_with_debts
            FROM debts
            WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        """
        
        result = db.execute_query(query, fetch=True, fetchone=True)
        statistics = dict(result) if result else {}
        
        return jsonify({
            'statistics': statistics
        }), 200
        
    except Exception as e:
        logging.error(f"Get debt statistics error: {e}")
        return jsonify({'error': 'Internal server error'}), 500