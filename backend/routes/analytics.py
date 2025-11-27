"""
Analytics and reporting routes
Provides endpoints for usage statistics, forecasting, and insights
"""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.database import get_db_connection
from datetime import datetime, timedelta
import logging

analytics_bp = Blueprint('analytics', __name__)
logger = logging.getLogger(__name__)


@analytics_bp.route('/usage-statistics', methods=['GET'])
@jwt_required()
def get_usage_statistics():
    """Get comprehensive usage statistics"""
    try:
        days = int(request.args.get('days', 30))
        cutoff_date = datetime.now() - timedelta(days=days)
        
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # Most requested items
                cursor.execute("""
                    SELECT 
                        p.id,
                        p.name,
                        p.category,
                        COUNT(ri.id) as request_count,
                        COALESCE(SUM(ri.requested_quantity), 0) as total_quantity,
                        COALESCE(AVG(ri.requested_quantity), 0) as avg_quantity
                    FROM products p
                    JOIN request_items ri ON p.id = ri.product_id
                    JOIN requests r ON ri.request_id = r.id
                    WHERE r.created_at >= %s
                    GROUP BY p.id, p.name, p.category
                    ORDER BY request_count DESC
                    LIMIT 10
                """, (cutoff_date,))
                most_requested = [
                    {
                        'id': row['id'],
                        'name': row['name'],
                        'category': row['category'] if row['category'] else 'Uncategorized',
                        'request_count': row['request_count'],
                        'total_quantity': float(row['total_quantity']) if row['total_quantity'] else 0,
                        'avg_quantity': float(row['avg_quantity']) if row['avg_quantity'] else 0
                    }
                    for row in cursor.fetchall()
                ]
                
                # Requests by hour of day
                cursor.execute("""
                    SELECT 
                        EXTRACT(HOUR FROM created_at) as hour,
                        COUNT(*) as request_count
                    FROM requests
                    WHERE created_at >= %s
                    GROUP BY EXTRACT(HOUR FROM created_at)
                    ORDER BY hour
                """, (cutoff_date,))
                hourly_distribution = [
                    {'hour': int(row['hour']), 'count': row['request_count']}
                    for row in cursor.fetchall()
                ]
                
                # Requests by day of week
                cursor.execute("""
                    SELECT 
                        EXTRACT(DOW FROM created_at) as day_of_week,
                        COUNT(*) as request_count
                    FROM requests
                    WHERE created_at >= %s
                    GROUP BY EXTRACT(DOW FROM created_at)
                    ORDER BY day_of_week
                """, (cutoff_date,))
                daily_distribution = [
                    {
                        'day': int(row['day_of_week']),
                        'day_name': ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][int(row['day_of_week'])],
                        'count': row['request_count']
                    }
                    for row in cursor.fetchall()
                ]
                
                # Popular departments
                cursor.execute("""
                    SELECT 
                        u.department,
                        COUNT(r.id) as request_count,
                        COUNT(DISTINCT u.id) as active_users
                    FROM users u
                    JOIN requests r ON u.id = r.user_id
                    WHERE r.created_at >= %s AND u.department IS NOT NULL
                    GROUP BY u.department
                    ORDER BY request_count DESC
                    LIMIT 10
                """, (cutoff_date,))
                departments = [
                    {
                        'department': row['department'],
                        'request_count': row['request_count'],
                        'active_users': row['active_users']
                    }
                    for row in cursor.fetchall()
                ]
                
                # Category breakdown
                cursor.execute("""
                    SELECT 
                        COALESCE(p.category, 'Uncategorized') as category,
                        COUNT(ri.id) as request_count,
                        COALESCE(SUM(ri.requested_quantity), 0) as total_quantity
                    FROM products p
                    JOIN request_items ri ON p.id = ri.product_id
                    JOIN requests r ON ri.request_id = r.id
                    WHERE r.created_at >= %s
                    GROUP BY p.category
                    ORDER BY request_count DESC
                """, (cutoff_date,))
                categories = [
                    {
                        'category': row['category'],
                        'request_count': row['request_count'],
                        'total_quantity': float(row['total_quantity']) if row['total_quantity'] else 0
                    }
                    for row in cursor.fetchall()
                ]
                
                # Overall statistics
                cursor.execute("""
                    SELECT 
                        COUNT(DISTINCT r.id) as total_requests,
                        COUNT(DISTINCT r.user_id) as active_users,
                        COUNT(DISTINCT ri.product_id) as products_used,
                        AVG(CASE 
                            WHEN r.return_date IS NOT NULL AND r.delivery_date IS NOT NULL 
                            THEN EXTRACT(EPOCH FROM (r.return_date - r.delivery_date)) / 86400 
                        END) as avg_loan_duration_days
                    FROM requests r
                    LEFT JOIN request_items ri ON r.id = ri.request_id
                    WHERE r.created_at >= %s
                """, (cutoff_date,))
                row = cursor.fetchone()
                overall_stats = {
                    'total_requests': row['total_requests'] if row['total_requests'] else 0,
                    'active_users': row['active_users'] if row['active_users'] else 0,
                    'products_used': row['products_used'] if row['products_used'] else 0,
                    'avg_loan_duration_days': round(float(row['avg_loan_duration_days']), 1) if row['avg_loan_duration_days'] else 0
                }
        
        return jsonify({
            'period_days': days,
            'most_requested_items': most_requested,
            'hourly_distribution': hourly_distribution,
            'daily_distribution': daily_distribution,
            'popular_departments': departments,
            'category_breakdown': categories,
            'overall_stats': overall_stats
        }), 200
        
    except ZeroDivisionError as e:
        logger.error(f"Get usage statistics - division by zero error: {e}", exc_info=True)
        return jsonify({'error': 'Division by zero in calculations'}), 500
    except Exception as e:
        logger.error(f"Get usage statistics error: {type(e).__name__}: {e}", exc_info=True)
        return jsonify({'error': f'{type(e).__name__}: {str(e)}'}), 500


@analytics_bp.route('/stock-forecast', methods=['GET'])
@jwt_required()
def get_stock_forecast():
    """Predict when items will run low based on usage patterns"""
    try:
        days = int(request.args.get('days', 30))
        cutoff_date = datetime.now() - timedelta(days=days)
        
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # Get usage rate and stock levels
                cursor.execute("""
                    SELECT 
                        p.id,
                        p.name,
                        p.category,
                        p.stock_quantity,
                        p.minimum_stock,
                        p.location,
                        COALESCE(SUM(ri.requested_quantity), 0) as total_used,
                        COUNT(DISTINCT DATE(r.created_at)) as active_days
                    FROM products p
                    LEFT JOIN request_items ri ON p.id = ri.product_id
                    LEFT JOIN requests r ON ri.request_id = r.id AND r.created_at >= %s
                    WHERE p.is_active = TRUE
                    GROUP BY p.id, p.name, p.category, p.stock_quantity, p.minimum_stock, p.location
                    HAVING p.stock_quantity > 0
                    ORDER BY p.stock_quantity ASC
                """, (cutoff_date,))
                
                forecasts = []
                for row in cursor.fetchall():
                    # Calculate daily rate
                    daily_rate = float(row['total_used']) / row['active_days'] if row['active_days'] > 0 else 0
                    stock = float(row['stock_quantity']) if row['stock_quantity'] else 0
                    min_stock = float(row['minimum_stock']) if row['minimum_stock'] else 0
                    
                    # Calculate days until depleted
                    days_until_empty = (stock / daily_rate) if daily_rate > 0 else 999999
                    days_until_min = ((stock - min_stock) / daily_rate) if daily_rate > 0 else 999999
                    
                    # Determine status
                    if stock <= min_stock:
                        status = 'critical'
                        priority = 1
                    elif days_until_min <= 7:
                        status = 'warning'
                        priority = 2
                    elif days_until_min <= 14:
                        status = 'attention'
                        priority = 3
                    else:
                        status = 'healthy'
                        priority = 4
                    
                    forecasts.append({
                        'id': row['id'],
                        'name': row['name'],
                        'category': row['category'],
                        'current_stock': stock,
                        'minimum_stock': min_stock,
                        'location': row['location'],
                        'daily_usage_rate': round(daily_rate, 2),
                        'days_until_empty': round(days_until_empty, 1) if days_until_empty < 999999 else None,
                        'days_until_minimum': round(days_until_min, 1) if days_until_min < 999999 else None,
                        'status': status,
                        'priority': priority,
                        'total_used_period': float(row['total_used']),
                        'active_days': row['active_days']
                    })
                
                # Sort by priority (critical first)
                forecasts.sort(key=lambda x: (x['priority'], x.get('days_until_minimum') or 999999))
        
        return jsonify({
            'period_days': days,
            'forecasts': forecasts,
            'summary': {
                'critical': sum(1 for f in forecasts if f['status'] == 'critical'),
                'warning': sum(1 for f in forecasts if f['status'] == 'warning'),
                'attention': sum(1 for f in forecasts if f['status'] == 'attention'),
                'healthy': sum(1 for f in forecasts if f['status'] == 'healthy')
            }
        }), 200
        
    except ZeroDivisionError as e:
        logger.error(f"Get stock forecast - division by zero error: {e}", exc_info=True)
        return jsonify({'error': 'Division by zero in calculations'}), 500
    except Exception as e:
        logger.error(f"Get stock forecast error: {type(e).__name__}: {e}", exc_info=True)
        return jsonify({'error': f'{type(e).__name__}: {str(e)}'}), 500


@analytics_bp.route('/late-returns', methods=['GET'])
@jwt_required()
def get_late_return_analytics():
    """Track which users/departments have most late returns"""
    try:
        days = int(request.args.get('days', 90))
        cutoff_date = datetime.now() - timedelta(days=days)
        
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # Users with most late returns
                cursor.execute("""
                    SELECT 
                        u.id,
                        u.registration_number,
                        u.first_name,
                        u.last_name,
                        u.department,
                        COUNT(r.id) as late_return_count,
                        AVG(EXTRACT(EPOCH FROM (r.return_date - r.expected_return_datetime)) / 86400) as avg_days_late,
                        MAX(EXTRACT(EPOCH FROM (r.return_date - r.expected_return_datetime)) / 86400) as max_days_late,
                        COALESCE(u.strikes, 0) as strikes
                    FROM users u
                    JOIN requests r ON u.id = r.user_id
                    WHERE r.return_date IS NOT NULL 
                        AND r.expected_return_datetime IS NOT NULL
                        AND r.return_date > r.expected_return_datetime
                        AND r.created_at >= %s
                    GROUP BY u.id, u.registration_number, u.first_name, u.last_name, u.department, u.strikes
                    ORDER BY late_return_count DESC
                    LIMIT 20
                """, (cutoff_date,))
                late_users = [
                    {
                        'id': row['id'],
                        'registration_number': row['registration_number'],
                        'name': f"{row['first_name']} {row['last_name']}",
                        'department': row['department'],
                        'late_return_count': row['late_return_count'],
                        'avg_days_late': round(float(row['avg_days_late']), 1),
                        'max_days_late': round(float(row['max_days_late']), 1),
                        'strikes': row['strikes']
                    }
                    for row in cursor.fetchall()
                ]
                
                # Departments with most late returns
                cursor.execute("""
                    SELECT 
                        u.department,
                        COUNT(r.id) as late_return_count,
                        COUNT(DISTINCT u.id) as users_with_late_returns,
                        AVG(EXTRACT(EPOCH FROM (r.return_date - r.expected_return_datetime)) / 86400) as avg_days_late
                    FROM users u
                    JOIN requests r ON u.id = r.user_id
                    WHERE r.return_date IS NOT NULL 
                        AND r.expected_return_datetime IS NOT NULL
                        AND r.return_date > r.expected_return_datetime
                        AND r.created_at >= %s
                        AND u.department IS NOT NULL
                    GROUP BY u.department
                    ORDER BY late_return_count DESC
                """, (cutoff_date,))
                late_departments = [
                    {
                        'department': row['department'],
                        'late_return_count': row['late_return_count'],
                        'users_with_late_returns': row['users_with_late_returns'],
                        'avg_days_late': round(float(row['avg_days_late']), 1)
                    }
                    for row in cursor.fetchall()
                ]
                
                # Late return trends over time
                cursor.execute("""
                    SELECT 
                        DATE_TRUNC('week', r.return_date) as week,
                        COUNT(*) as late_returns
                    FROM requests r
                    WHERE r.return_date IS NOT NULL 
                        AND r.expected_return_datetime IS NOT NULL
                        AND r.return_date > r.expected_return_datetime
                        AND r.created_at >= %s
                    GROUP BY DATE_TRUNC('week', r.return_date)
                    ORDER BY week
                """, (cutoff_date,))
                trends = [
                    {
                        'week': row['week'].isoformat(),
                        'late_returns': row['late_returns']
                    }
                    for row in cursor.fetchall()
                ]
                
                # Overall statistics
                cursor.execute("""
                    SELECT 
                        COUNT(*) as total_late_returns,
                        COUNT(DISTINCT user_id) as users_with_late_returns,
                        AVG(EXTRACT(EPOCH FROM (return_date - expected_return_datetime)) / 86400) as avg_days_late,
                        MAX(EXTRACT(EPOCH FROM (return_date - expected_return_datetime)) / 86400) as max_days_late
                    FROM requests
                    WHERE return_date IS NOT NULL 
                        AND expected_return_datetime IS NOT NULL
                        AND return_date > expected_return_datetime
                        AND created_at >= %s
                """, (cutoff_date,))
                row = cursor.fetchone()
                overall_stats = {
                    'total_late_returns': row['total_late_returns'],
                    'users_with_late_returns': row['users_with_late_returns'],
                    'avg_days_late': round(float(row['avg_days_late']), 1) if row['avg_days_late'] else 0,
                    'max_days_late': round(float(row['max_days_late']), 1) if row['max_days_late'] else 0
                }
        
        return jsonify({
            'period_days': days,
            'top_late_users': late_users,
            'departments': late_departments,
            'trends': trends,
            'overall_stats': overall_stats
        }), 200
        
    except ZeroDivisionError as e:
        logger.error(f"Get late return analytics - division by zero error: {e}", exc_info=True)
        return jsonify({'error': 'Division by zero in calculations'}), 500
    except Exception as e:
        logger.error(f"Get late return analytics error: {type(e).__name__}: {e}", exc_info=True)
        return jsonify({'error': f'{type(e).__name__}: {str(e)}'}), 500


@analytics_bp.route('/debt-collection', methods=['GET'])
@jwt_required()
def get_debt_collection_dashboard():
    """Admin view of outstanding debts with payment tracking"""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # Outstanding debts by user
                cursor.execute("""
                    SELECT 
                        u.id,
                        u.registration_number,
                        u.first_name,
                        u.last_name,
                        u.department,
                        u.email,
                        u.phone,
                        COUNT(d.id) as debt_count,
                        SUM(d.total_amount) as total_debt,
                        MIN(d.created_at) as oldest_debt_date,
                        MAX(d.created_at) as newest_debt_date
                    FROM users u
                    JOIN debts d ON u.id = d.user_id
                    WHERE d.status = 'pending'
                    GROUP BY u.id, u.registration_number, u.first_name, u.last_name, u.department, u.email, u.phone
                    ORDER BY total_debt DESC
                """)
                debts_by_user = [
                    {
                        'user_id': row['id'],
                        'registration_number': row['registration_number'],
                        'name': f"{row['first_name']} {row['last_name']}",
                        'department': row['department'],
                        'email': row['email'],
                        'phone': row['phone'],
                        'debt_count': row['debt_count'],
                        'total_debt': float(row['total_debt']),
                        'oldest_debt_date': row['oldest_debt_date'].isoformat() if row['oldest_debt_date'] else None,
                        'newest_debt_date': row['newest_debt_date'].isoformat() if row['newest_debt_date'] else None
                    }
                    for row in cursor.fetchall()
                ]
                
                # Debts by type
                cursor.execute("""
                    SELECT 
                        debt_type,
                        COUNT(*) as count,
                        SUM(total_amount) as total_amount
                    FROM debts
                    WHERE status = 'pending'
                    GROUP BY debt_type
                    ORDER BY total_amount DESC
                """)
                debts_by_type = [
                    {
                        'debt_type': row['debt_type'],
                        'count': row['count'],
                        'total_amount': float(row['total_amount'])
                    }
                    for row in cursor.fetchall()
                ]
                
                # Recent debt activity
                cursor.execute("""
                    SELECT 
                        d.id,
                        d.debt_type,
                        d.total_amount,
                        d.status,
                        d.created_at,
                        d.resolved_date,
                        u.registration_number,
                        u.first_name,
                        u.last_name,
                        p.name as product_name,
                        resolver.first_name as resolved_by_first_name,
                        resolver.last_name as resolved_by_last_name
                    FROM debts d
                    JOIN users u ON d.user_id = u.id
                    LEFT JOIN products p ON d.product_id = p.id
                    LEFT JOIN users resolver ON d.resolved_by = resolver.id
                    ORDER BY d.created_at DESC
                    LIMIT 20
                """)
                recent_activity = [
                    {
                        'id': row['id'],
                        'debt_type': row['debt_type'],
                        'total_amount': float(row['total_amount']),
                        'status': row['status'],
                        'created_at': row['created_at'].isoformat(),
                        'resolved_date': row['resolved_date'].isoformat() if row['resolved_date'] else None,
                        'user': f"{row['registration_number']} - {row['first_name']} {row['last_name']}",
                        'product_name': row['product_name'],
                        'resolved_by': f"{row['resolved_by_first_name']} {row['resolved_by_last_name']}" if row['resolved_by_first_name'] else None
                    }
                    for row in cursor.fetchall()
                ]
                
                # Overall statistics
                cursor.execute("""
                    SELECT 
                        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
                        SUM(CASE WHEN status = 'pending' THEN total_amount ELSE 0 END) as pending_amount,
                        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
                        SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END) as paid_amount,
                        COUNT(CASE WHEN status = 'waived' THEN 1 END) as waived_count,
                        SUM(CASE WHEN status = 'waived' THEN total_amount ELSE 0 END) as waived_amount,
                        COUNT(CASE WHEN status = 'disputed' THEN 1 END) as disputed_count,
                        SUM(CASE WHEN status = 'disputed' THEN total_amount ELSE 0 END) as disputed_amount
                    FROM debts
                """)
                row = cursor.fetchone()
                overall_stats = {
                    'pending': {'count': row['pending_count'], 'amount': float(row['pending_amount'] or 0)},
                    'paid': {'count': row['paid_count'], 'amount': float(row['paid_amount'] or 0)},
                    'waived': {'count': row['waived_count'], 'amount': float(row['waived_amount'] or 0)},
                    'disputed': {'count': row['disputed_count'], 'amount': float(row['disputed_amount'] or 0)}
                }
                
                # Aging analysis
                cursor.execute("""
                    SELECT 
                        CASE 
                            WHEN CURRENT_DATE - d.created_at::date <= 30 THEN '0-30 days'
                            WHEN CURRENT_DATE - d.created_at::date <= 60 THEN '31-60 days'
                            WHEN CURRENT_DATE - d.created_at::date <= 90 THEN '61-90 days'
                            ELSE '90+ days'
                        END as age_group,
                        COUNT(*) as count,
                        SUM(total_amount) as total_amount
                    FROM debts d
                    WHERE status = 'pending'
                    GROUP BY 
                        CASE 
                            WHEN CURRENT_DATE - d.created_at::date <= 30 THEN '0-30 days'
                            WHEN CURRENT_DATE - d.created_at::date <= 60 THEN '31-60 days'
                            WHEN CURRENT_DATE - d.created_at::date <= 90 THEN '61-90 days'
                            ELSE '90+ days'
                        END
                    ORDER BY 
                        CASE 
                            WHEN CURRENT_DATE - d.created_at::date <= 30 THEN 1
                            WHEN CURRENT_DATE - d.created_at::date <= 60 THEN 2
                            WHEN CURRENT_DATE - d.created_at::date <= 90 THEN 3
                            ELSE 4
                        END
                """)
                aging = [
                    {
                        'age_group': row['age_group'],
                        'count': row['count'],
                        'total_amount': float(row['total_amount'])
                    }
                    for row in cursor.fetchall()
                ]
        
        return jsonify({
            'debts_by_user': debts_by_user,
            'debts_by_type': debts_by_type,
            'recent_activity': recent_activity,
            'overall_stats': overall_stats,
            'aging_analysis': aging
        }), 200
        
    except ZeroDivisionError as e:
        logger.error(f"Get debt collection dashboard - division by zero error: {e}", exc_info=True)
        return jsonify({'error': 'Division by zero in calculations'}), 500
    except Exception as e:
        logger.error(f"Get debt collection dashboard error: {type(e).__name__}: {e}", exc_info=True)
        return jsonify({'error': f'{type(e).__name__}: {str(e)}'}), 500
