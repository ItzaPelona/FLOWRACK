"""
Dashboard routes
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.models.user import User
import logging

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('', methods=['GET'])
@jwt_required()
def get_dashboard():
    """Get dashboard data based on user role"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        from backend.database import db
        
        if current_user.role == 'user':
            # User dashboard data
            dashboard_data = {
                'user_info': current_user.to_dict(),
                'request_summary': current_user.get_request_summary(),
                'debt_summary': current_user.get_debt_summary()
            }
        else:
            # Operator/Admin dashboard data
            
            # Today's deliveries
            today_deliveries_query = """
                SELECT COUNT(*) as count
                FROM requests 
                WHERE status IN ('approved', 'collecting') 
                AND requested_date = CURRENT_DATE
            """
            today_deliveries = db.execute_query(today_deliveries_query, fetch=True, fetchone=True)
            
            # Low stock products
            low_stock_query = """
                SELECT COUNT(*) as count
                FROM products 
                WHERE is_active = TRUE AND stock_quantity <= minimum_stock
            """
            low_stock = db.execute_query(low_stock_query, fetch=True, fetchone=True)
            
            # Active users
            active_users_query = """
                SELECT COUNT(*) as count
                FROM users 
                WHERE is_active = TRUE AND role = 'user'
            """
            active_users = db.execute_query(active_users_query, fetch=True, fetchone=True)
            
            # Total pending debts
            total_debts_query = """
                SELECT COALESCE(SUM(total_amount), 0) as amount
                FROM debts 
                WHERE status = 'pending'
            """
            total_debts = db.execute_query(total_debts_query, fetch=True, fetchone=True)
            
            dashboard_data = {
                'today_deliveries': today_deliveries['count'] if today_deliveries else 0,
                'low_stock_products': low_stock['count'] if low_stock else 0,
                'active_users': active_users['count'] if active_users else 0,
                'total_debts': float(total_debts['amount']) if total_debts else 0.0
            }
        
        return jsonify(dashboard_data), 200
        
    except Exception as e:
        logging.error(f"Get dashboard error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@dashboard_bp.route('/activity', methods=['GET'])
@jwt_required()
def get_recent_activity():
    """Get recent activity"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        limit = request.args.get('limit', type=int, default=10)
        
        from backend.database import db
        
        if current_user.role == 'user':
            # User's own activity
            query = """
                SELECT 
                    'request' as type,
                    'Request ' || request_number as title,
                    CASE 
                        WHEN status = 'pending' THEN 'Request submitted and pending approval'
                        WHEN status = 'approved' THEN 'Request approved, ready for collection'
                        WHEN status = 'delivered' THEN 'Materials delivered'
                        WHEN status = 'returned' THEN 'Materials returned'
                        WHEN status = 'cancelled' THEN 'Request cancelled'
                        ELSE 'Status: ' || status
                    END as description,
                    status,
                    updated_at as created_at
                FROM requests 
                WHERE user_id = %s
                ORDER BY updated_at DESC
                LIMIT %s
            """
            params = [current_user_id, limit]
        else:
            # System-wide activity for operators/admins
            query = """
                (SELECT 
                    'request' as type,
                    'Request ' || r.request_number as title,
                    'User: ' || u.first_name || ' ' || u.last_name || ' - ' ||
                    CASE 
                        WHEN r.status = 'pending' THEN 'New request submitted'
                        WHEN r.status = 'approved' THEN 'Request approved'
                        WHEN r.status = 'delivered' THEN 'Materials delivered'
                        WHEN r.status = 'returned' THEN 'Materials returned'
                        ELSE 'Status: ' || r.status
                    END as description,
                    r.status,
                    r.updated_at as created_at
                FROM requests r
                JOIN users u ON r.user_id = u.id
                ORDER BY r.updated_at DESC
                LIMIT %s)
                UNION ALL
                (SELECT 
                    'debt' as type,
                    'Debt Created' as title,
                    'User: ' || u.first_name || ' ' || u.last_name || 
                    ' - Product: ' || p.name || ' ($' || d.total_amount || ')' as description,
                    d.status,
                    d.created_at
                FROM debts d
                JOIN users u ON d.user_id = u.id
                JOIN products p ON d.product_id = p.id
                WHERE d.created_at >= CURRENT_DATE - INTERVAL '7 days'
                ORDER BY d.created_at DESC
                LIMIT %s)
                ORDER BY created_at DESC
                LIMIT %s
            """
            params = [limit // 2, limit // 2, limit]
        
        activities = db.execute_query(query, params, fetch=True)
        
        # Format activities for frontend
        formatted_activities = []
        for activity in activities or []:
            formatted_activities.append({
                'type': activity['type'],
                'title': activity['title'],
                'description': activity['description'],
                'status': activity['status'],
                'created_at': activity['created_at'].isoformat() if activity['created_at'] else None
            })
        
        return jsonify(formatted_activities), 200
        
    except Exception as e:
        logging.error(f"Get recent activity error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@dashboard_bp.route('/analytics', methods=['GET'])
@jwt_required()
def get_analytics():
    """Get analytics data (operator/admin only)"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user or current_user.role not in ['operator', 'admin']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        period = request.args.get('period', 'week')  # week, month, year
        
        from backend.database import db
        
        # Determine date range
        if period == 'week':
            date_filter = "created_at >= CURRENT_DATE - INTERVAL '7 days'"
        elif period == 'month':
            date_filter = "created_at >= CURRENT_DATE - INTERVAL '30 days'"
        elif period == 'year':
            date_filter = "created_at >= CURRENT_DATE - INTERVAL '365 days'"
        else:
            date_filter = "created_at >= CURRENT_DATE - INTERVAL '7 days'"
        
        # Request trends
        request_trends_query = f"""
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as count,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
                COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
                COUNT(CASE WHEN status = 'returned' THEN 1 END) as completed
            FROM requests 
            WHERE {date_filter}
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        """
        
        request_trends = db.execute_query(request_trends_query, fetch=True)
        
        # Product usage
        product_usage_query = f"""
            SELECT 
                p.name,
                p.category,
                COUNT(ri.id) as request_count,
                COALESCE(SUM(ri.delivered_quantity), 0) as total_delivered
            FROM products p
            LEFT JOIN request_items ri ON p.id = ri.product_id
            LEFT JOIN requests r ON ri.request_id = r.id
            WHERE r.{date_filter} OR r.id IS NULL
            GROUP BY p.id, p.name, p.category
            ORDER BY request_count DESC
            LIMIT 10
        """
        
        product_usage = db.execute_query(product_usage_query, fetch=True)
        
        # Debt trends
        debt_trends_query = f"""
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as count,
                COALESCE(SUM(total_amount), 0) as amount
            FROM debts 
            WHERE {date_filter}
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        """
        
        debt_trends = db.execute_query(debt_trends_query, fetch=True)
        
        # User activity
        user_activity_query = f"""
            SELECT 
                u.first_name || ' ' || u.last_name as user_name,
                u.department,
                COUNT(r.id) as request_count,
                COALESCE(SUM(d.total_amount), 0) as total_debts
            FROM users u
            LEFT JOIN requests r ON u.id = r.user_id AND r.{date_filter}
            LEFT JOIN debts d ON u.id = d.user_id AND d.{date_filter}
            WHERE u.role = 'user'
            GROUP BY u.id, u.first_name, u.last_name, u.department
            ORDER BY request_count DESC
            LIMIT 10
        """
        
        user_activity = db.execute_query(user_activity_query, fetch=True)
        
        analytics_data = {
            'period': period,
            'request_trends': [dict(row) for row in request_trends] if request_trends else [],
            'product_usage': [dict(row) for row in product_usage] if product_usage else [],
            'debt_trends': [dict(row) for row in debt_trends] if debt_trends else [],
            'user_activity': [dict(row) for row in user_activity] if user_activity else []
        }
        
        return jsonify(analytics_data), 200
        
    except Exception as e:
        logging.error(f"Get analytics error: {e}")
        return jsonify({'error': 'Internal server error'}), 500