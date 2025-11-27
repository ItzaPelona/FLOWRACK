"""
Audit Trail Routes
Comprehensive activity logging and audit reporting
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.routes.auth import get_current_user_id
from backend.models.user import User
from backend.database import get_db_connection
from datetime import datetime, timedelta
import logging
import csv
import io

audit_bp = Blueprint('audit', __name__)

@audit_bp.route('/activity', methods=['GET'])
@jwt_required()
def get_activity_logs():
    """Get activity logs with filters (operator/admin only)"""
    try:
        current_user_id = get_current_user_id()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user or current_user.role not in ['admin', 'operator']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        # Query parameters
        user_id = request.args.get('user_id', type=int)
        action_type = request.args.get('action_type')
        entity_type = request.args.get('entity_type')
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        limit = request.args.get('limit', type=int, default=100)
        offset = request.args.get('offset', type=int, default=0)
        
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # Build query
                query = """
                    SELECT 
                        al.id,
                        al.user_id,
                        u.first_name || ' ' || u.last_name as user_name,
                        u.registration_number,
                        al.action_type,
                        al.entity_type,
                        al.entity_id,
                        al.description,
                        al.details,
                        al.ip_address,
                        al.user_agent,
                        al.created_at
                    FROM activity_logs al
                    LEFT JOIN users u ON al.user_id = u.id
                    WHERE 1=1
                """
                params = []
                
                if user_id:
                    query += " AND al.user_id = %s"
                    params.append(user_id)
                
                if action_type:
                    query += " AND al.action_type = %s"
                    params.append(action_type)
                
                if entity_type:
                    query += " AND al.entity_type = %s"
                    params.append(entity_type)
                
                if date_from:
                    query += " AND al.created_at >= %s"
                    params.append(date_from)
                
                if date_to:
                    query += " AND al.created_at <= %s"
                    params.append(date_to + ' 23:59:59')
                
                # Get total count
                count_query = f"SELECT COUNT(*) as total FROM ({query}) as filtered"
                cursor.execute(count_query, params)
                total = cursor.fetchone()['total']
                
                # Add ordering and pagination
                query += " ORDER BY al.created_at DESC LIMIT %s OFFSET %s"
                params.extend([limit, offset])
                
                cursor.execute(query, params)
                logs = cursor.fetchall()
                
                return jsonify({
                    'logs': [dict(log) for log in logs],
                    'total': total,
                    'limit': limit,
                    'offset': offset
                }), 200
                
    except Exception as e:
        logging.error(f"Get activity logs error: {e}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500


@audit_bp.route('/request-history/<int:request_id>', methods=['GET'])
@jwt_required()
def get_request_history(request_id):
    """Get complete timeline of request status changes"""
    try:
        current_user_id = get_current_user_id()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # Check if user can view this request
                cursor.execute("""
                    SELECT user_id FROM requests WHERE id = %s
                """, (request_id,))
                req = cursor.fetchone()
                
                if not req:
                    return jsonify({'error': 'Request not found'}), 404
                
                # Regular users can only see their own requests
                if current_user.role == 'user' and req['user_id'] != current_user_id:
                    return jsonify({'error': 'Access denied'}), 403
                
                # Get request history
                cursor.execute("""
                    SELECT 
                        al.id,
                        al.action_type,
                        al.description,
                        al.details,
                        al.created_at,
                        u.first_name || ' ' || u.last_name as performed_by,
                        u.role as performed_by_role
                    FROM activity_logs al
                    LEFT JOIN users u ON al.user_id = u.id
                    WHERE al.entity_type = 'request'
                        AND al.entity_id = %s
                    ORDER BY al.created_at ASC
                """, (request_id,))
                
                history = cursor.fetchall()
                
                return jsonify({
                    'request_id': request_id,
                    'history': [dict(h) for h in history]
                }), 200
                
    except Exception as e:
        logging.error(f"Get request history error: {e}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500


@audit_bp.route('/stock-movements', methods=['GET'])
@jwt_required()
def get_stock_movements():
    """Get stock movement log with before/after quantities (operator/admin only)"""
    try:
        current_user_id = get_current_user_id()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user or current_user.role not in ['admin', 'operator']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        # Query parameters
        product_id = request.args.get('product_id', type=int)
        movement_type = request.args.get('movement_type')
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        limit = request.args.get('limit', type=int, default=100)
        offset = request.args.get('offset', type=int, default=0)
        
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # Get stock adjustments (primary source)
                query = """
                    SELECT 
                        sa.id,
                        sa.product_id,
                        p.name as product_name,
                        p.product_code,
                        sa.adjustment_type as movement_type,
                        sa.quantity_change,
                        sa.quantity_before,
                        sa.quantity_after,
                        sa.reason,
                        sa.reference_number,
                        sa.adjusted_by,
                        u.first_name || ' ' || u.last_name as adjusted_by_name,
                        sa.created_at
                    FROM stock_adjustments sa
                    LEFT JOIN products p ON sa.product_id = p.id
                    LEFT JOIN users u ON sa.adjusted_by = u.id
                    WHERE 1=1
                """
                params = []
                
                if product_id:
                    query += " AND sa.product_id = %s"
                    params.append(product_id)
                
                if movement_type:
                    query += " AND sa.adjustment_type = %s"
                    params.append(movement_type)
                
                if date_from:
                    query += " AND sa.created_at >= %s"
                    params.append(date_from)
                
                if date_to:
                    query += " AND sa.created_at <= %s"
                    params.append(date_to + ' 23:59:59')
                
                # Get total count
                count_query = f"SELECT COUNT(*) as total FROM ({query}) as filtered"
                cursor.execute(count_query, params)
                total = cursor.fetchone()['total']
                
                # Add ordering and pagination
                query += " ORDER BY sa.created_at DESC LIMIT %s OFFSET %s"
                params.extend([limit, offset])
                
                cursor.execute(query, params)
                movements = cursor.fetchall()
                
                return jsonify({
                    'movements': [dict(m) for m in movements],
                    'total': total,
                    'limit': limit,
                    'offset': offset
                }), 200
                
    except Exception as e:
        logging.error(f"Get stock movements error: {e}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500


@audit_bp.route('/export/activity', methods=['GET'])
@jwt_required()
def export_activity_logs():
    """Export activity logs as CSV (admin only)"""
    try:
        current_user_id = get_current_user_id()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        # Query parameters
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        format_type = request.args.get('format', 'csv')
        
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                query = """
                    SELECT 
                        al.id,
                        al.created_at as timestamp,
                        u.first_name || ' ' || u.last_name as user_name,
                        u.registration_number,
                        u.role as user_role,
                        al.action_type,
                        al.entity_type,
                        al.entity_id,
                        al.description,
                        al.ip_address
                    FROM activity_logs al
                    LEFT JOIN users u ON al.user_id = u.id
                    WHERE 1=1
                """
                params = []
                
                if date_from:
                    query += " AND al.created_at >= %s"
                    params.append(date_from)
                
                if date_to:
                    query += " AND al.created_at <= %s"
                    params.append(date_to + ' 23:59:59')
                
                query += " ORDER BY al.created_at DESC"
                
                cursor.execute(query, params)
                logs = cursor.fetchall()
                
                if format_type == 'csv':
                    # Create CSV
                    output = io.StringIO()
                    writer = csv.writer(output)
                    
                    # Header
                    writer.writerow([
                        'ID', 'Timestamp', 'User Name', 'Registration Number', 
                        'User Role', 'Action Type', 'Entity Type', 'Entity ID',
                        'Description', 'IP Address'
                    ])
                    
                    # Data
                    for log in logs:
                        writer.writerow([
                            log['id'],
                            log['timestamp'],
                            log['user_name'],
                            log['registration_number'],
                            log['user_role'],
                            log['action_type'],
                            log['entity_type'],
                            log['entity_id'],
                            log['description'],
                            log['ip_address']
                        ])
                    
                    # Prepare response
                    output.seek(0)
                    from flask import make_response
                    response = make_response(output.getvalue())
                    response.headers['Content-Type'] = 'text/csv'
                    response.headers['Content-Disposition'] = f'attachment; filename=activity_logs_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
                    
                    return response
                
                else:
                    return jsonify({'error': 'Unsupported format'}), 400
                
    except Exception as e:
        logging.error(f"Export activity logs error: {e}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500


@audit_bp.route('/export/stock-movements', methods=['GET'])
@jwt_required()
def export_stock_movements():
    """Export stock movements as CSV (admin only)"""
    try:
        current_user_id = get_current_user_id()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        # Query parameters
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        product_id = request.args.get('product_id', type=int)
        
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                query = """
                    SELECT 
                        sa.id,
                        sa.created_at as timestamp,
                        p.product_code,
                        p.name as product_name,
                        sa.adjustment_type as movement_type,
                        sa.quantity_change,
                        sa.quantity_before,
                        sa.quantity_after,
                        sa.reason,
                        sa.reference_number,
                        u.first_name || ' ' || u.last_name as adjusted_by
                    FROM stock_adjustments sa
                    LEFT JOIN products p ON sa.product_id = p.id
                    LEFT JOIN users u ON sa.adjusted_by = u.id
                    WHERE 1=1
                """
                params = []
                
                if product_id:
                    query += " AND sa.product_id = %s"
                    params.append(product_id)
                
                if date_from:
                    query += " AND sa.created_at >= %s"
                    params.append(date_from)
                
                if date_to:
                    query += " AND sa.created_at <= %s"
                    params.append(date_to + ' 23:59:59')
                
                query += " ORDER BY sa.created_at DESC"
                
                cursor.execute(query, params)
                movements = cursor.fetchall()
                
                # Create CSV
                output = io.StringIO()
                writer = csv.writer(output)
                
                # Header
                writer.writerow([
                    'ID', 'Timestamp', 'Product Code', 'Product Name',
                    'Movement Type', 'Quantity Change', 'Before', 'After',
                    'Reason', 'Reference Number', 'Adjusted By'
                ])
                
                # Data
                for movement in movements:
                    writer.writerow([
                        movement['id'],
                        movement['timestamp'],
                        movement['product_code'],
                        movement['product_name'],
                        movement['movement_type'],
                        movement['quantity_change'],
                        movement['quantity_before'],
                        movement['quantity_after'],
                        movement['reason'],
                        movement['reference_number'],
                        movement['adjusted_by']
                    ])
                
                # Prepare response
                output.seek(0)
                from flask import make_response
                response = make_response(output.getvalue())
                response.headers['Content-Type'] = 'text/csv'
                response.headers['Content-Disposition'] = f'attachment; filename=stock_movements_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
                
                return response
                
    except Exception as e:
        logging.error(f"Export stock movements error: {e}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500


@audit_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_audit_stats():
    """Get audit statistics (admin only)"""
    try:
        current_user_id = get_current_user_id()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # Total logs
                cursor.execute("""
                    SELECT COUNT(*) as total_logs FROM activity_logs
                """)
                total_logs = cursor.fetchone()['total_logs']
                
                # Logs by action type
                cursor.execute("""
                    SELECT 
                        action_type,
                        COUNT(*) as count
                    FROM activity_logs
                    GROUP BY action_type
                    ORDER BY count DESC
                """)
                by_action = cursor.fetchall()
                
                # Logs by entity type
                cursor.execute("""
                    SELECT 
                        entity_type,
                        COUNT(*) as count
                    FROM activity_logs
                    GROUP BY entity_type
                    ORDER BY count DESC
                """)
                by_entity = cursor.fetchall()
                
                # Most active users (last 30 days)
                cursor.execute("""
                    SELECT 
                        u.first_name || ' ' || u.last_name as user_name,
                        u.registration_number,
                        COUNT(*) as action_count
                    FROM activity_logs al
                    JOIN users u ON al.user_id = u.id
                    WHERE al.created_at >= NOW() - INTERVAL '30 days'
                    GROUP BY u.id, user_name, u.registration_number
                    ORDER BY action_count DESC
                    LIMIT 10
                """)
                most_active = cursor.fetchall()
                
                # Recent activity (last 24 hours)
                cursor.execute("""
                    SELECT COUNT(*) as count
                    FROM activity_logs
                    WHERE created_at >= NOW() - INTERVAL '24 hours'
                """)
                last_24h = cursor.fetchone()['count']
                
                return jsonify({
                    'total_logs': total_logs,
                    'by_action_type': [dict(row) for row in by_action],
                    'by_entity_type': [dict(row) for row in by_entity],
                    'most_active_users': [dict(row) for row in most_active],
                    'last_24_hours': last_24h
                }), 200
                
    except Exception as e:
        logging.error(f"Get audit stats error: {e}", exc_info=True)
        return jsonify({'error': 'Internal server error'}), 500
