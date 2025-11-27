"""
Stock Adjustments routes
Handle inventory corrections and adjustments with audit trail
"""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.database import get_db_connection
from backend.utils.audit_logger import log_stock_adjustment
from datetime import datetime
import logging

adjustments_bp = Blueprint('adjustments', __name__)
logger = logging.getLogger(__name__)


@adjustments_bp.route('', methods=['GET'])
@jwt_required()
def get_stock_adjustments():
    """Get stock adjustments history with optional filters"""
    try:
        # Query parameters
        product_id = request.args.get('product_id', type=int)
        adjustment_type = request.args.get('type')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        limit = request.args.get('limit', 50, type=int)
        offset = request.args.get('offset', 0, type=int)
        
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # Build query with filters
                query = """
                    SELECT 
                        sa.id,
                        sa.product_id,
                        p.name as product_name,
                        p.category as product_category,
                        sa.adjustment_type,
                        sa.quantity_change,
                        sa.quantity_before,
                        sa.quantity_after,
                        sa.reason,
                        sa.reference_number,
                        sa.adjustment_date,
                        u.registration_number as adjusted_by_reg,
                        u.first_name || ' ' || u.last_name as adjusted_by_name,
                        approver.first_name || ' ' || approver.last_name as approved_by_name,
                        sa.created_at
                    FROM stock_adjustments sa
                    JOIN products p ON sa.product_id = p.id
                    JOIN users u ON sa.adjusted_by = u.id
                    LEFT JOIN users approver ON sa.approved_by = approver.id
                    WHERE 1=1
                """
                params = []
                
                if product_id:
                    query += " AND sa.product_id = %s"
                    params.append(product_id)
                
                if adjustment_type:
                    query += " AND sa.adjustment_type = %s"
                    params.append(adjustment_type)
                
                if start_date:
                    query += " AND sa.adjustment_date >= %s"
                    params.append(start_date)
                
                if end_date:
                    query += " AND sa.adjustment_date <= %s"
                    params.append(end_date)
                
                query += " ORDER BY sa.adjustment_date DESC LIMIT %s OFFSET %s"
                params.extend([limit, offset])
                
                cursor.execute(query, params)
                adjustments = [
                    {
                        'id': row['id'],
                        'product_id': row['product_id'],
                        'product_name': row['product_name'],
                        'product_category': row['product_category'],
                        'adjustment_type': row['adjustment_type'],
                        'quantity_change': row['quantity_change'],
                        'quantity_before': row['quantity_before'],
                        'quantity_after': row['quantity_after'],
                        'reason': row['reason'],
                        'reference_number': row['reference_number'],
                        'adjustment_date': row['adjustment_date'].isoformat(),
                        'adjusted_by': {
                            'registration_number': row['adjusted_by_reg'],
                            'name': row['adjusted_by_name']
                        },
                        'approved_by_name': row['approved_by_name'],
                        'created_at': row['created_at'].isoformat()
                    }
                    for row in cursor.fetchall()
                ]
                
                # Get total count
                count_query = """
                    SELECT COUNT(*) as total
                    FROM stock_adjustments sa
                    WHERE 1=1
                """
                count_params = []
                
                if product_id:
                    count_query += " AND sa.product_id = %s"
                    count_params.append(product_id)
                
                if adjustment_type:
                    count_query += " AND sa.adjustment_type = %s"
                    count_params.append(adjustment_type)
                
                if start_date:
                    count_query += " AND sa.adjustment_date >= %s"
                    count_params.append(start_date)
                
                if end_date:
                    count_query += " AND sa.adjustment_date <= %s"
                    count_params.append(end_date)
                
                cursor.execute(count_query, count_params)
                total = cursor.fetchone()['total']
        
        return jsonify({
            'adjustments': adjustments,
            'total': total,
            'limit': limit,
            'offset': offset
        }), 200
        
    except Exception as e:
        logger.error(f"Get stock adjustments error: {type(e).__name__}: {e}", exc_info=True)
        return jsonify({'error': f'{type(e).__name__}: {str(e)}'}), 500


@adjustments_bp.route('', methods=['POST'])
@jwt_required()
def create_stock_adjustment():
    """Create a new stock adjustment"""
    try:
        data = request.get_json()
        user_id = get_jwt_identity()
        
        # Validate required fields
        required_fields = ['product_id', 'adjustment_type', 'quantity_change', 'reason']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        product_id = data['product_id']
        adjustment_type = data['adjustment_type']
        quantity_change = int(data['quantity_change'])
        reason = data['reason']
        reference_number = data.get('reference_number')
        
        # Validate adjustment type
        valid_types = ['correction', 'damage', 'loss', 'found', 'transfer', 'return', 'initial']
        if adjustment_type not in valid_types:
            return jsonify({'error': f'Invalid adjustment type. Must be one of: {", ".join(valid_types)}'}), 400
        
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # Get current stock quantity
                cursor.execute(
                    "SELECT stock_quantity FROM products WHERE id = %s AND is_active = TRUE",
                    (product_id,)
                )
                product = cursor.fetchone()
                if not product:
                    return jsonify({'error': 'Product not found or inactive'}), 404
                
                quantity_before = product['stock_quantity']
                quantity_after = quantity_before + quantity_change
                
                # Prevent negative stock
                if quantity_after < 0:
                    return jsonify({'error': f'Adjustment would result in negative stock ({quantity_after})'}), 400
                
                # Create adjustment record
                cursor.execute("""
                    INSERT INTO stock_adjustments (
                        product_id, adjustment_type, quantity_change,
                        quantity_before, quantity_after, reason,
                        reference_number, adjusted_by
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id, adjustment_date
                """, (
                    product_id, adjustment_type, quantity_change,
                    quantity_before, quantity_after, reason,
                    reference_number, user_id
                ))
                
                result = cursor.fetchone()
                adjustment_id = result['id']
                adjustment_date = result['adjustment_date']
                
                # Update product stock quantity
                cursor.execute("""
                    UPDATE products 
                    SET stock_quantity = %s, updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                """, (quantity_after, product_id))
                
                # Get product name for logging
                cursor.execute("SELECT name FROM products WHERE id = %s", (product_id,))
                product_name = cursor.fetchone()['name']
                
                conn.commit()
                
                # Log the stock adjustment
                log_stock_adjustment(
                    user_id=user_id,
                    adjustment_id=adjustment_id,
                    product_id=product_id,
                    product_name=product_name,
                    adjustment_type=adjustment_type,
                    quantity_change=quantity_change,
                    quantity_before=quantity_before,
                    quantity_after=quantity_after
                )
        
        return jsonify({
            'message': 'Stock adjustment created successfully',
            'adjustment': {
                'id': adjustment_id,
                'product_id': product_id,
                'adjustment_type': adjustment_type,
                'quantity_change': quantity_change,
                'quantity_before': quantity_before,
                'quantity_after': quantity_after,
                'reason': reason,
                'reference_number': reference_number,
                'adjustment_date': adjustment_date.isoformat()
            }
        }), 201
        
    except ValueError as e:
        return jsonify({'error': f'Invalid value: {str(e)}'}), 400
    except Exception as e:
        logger.error(f"Create stock adjustment error: {type(e).__name__}: {e}", exc_info=True)
        return jsonify({'error': f'{type(e).__name__}: {str(e)}'}), 500


@adjustments_bp.route('/<int:adjustment_id>', methods=['GET'])
@jwt_required()
def get_stock_adjustment(adjustment_id):
    """Get a specific stock adjustment by ID"""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT 
                        sa.id,
                        sa.product_id,
                        p.name as product_name,
                        p.category as product_category,
                        p.barcode,
                        sa.adjustment_type,
                        sa.quantity_change,
                        sa.quantity_before,
                        sa.quantity_after,
                        sa.reason,
                        sa.reference_number,
                        sa.adjustment_date,
                        sa.adjusted_by,
                        u.registration_number as adjusted_by_reg,
                        u.first_name || ' ' || u.last_name as adjusted_by_name,
                        sa.approved_by,
                        approver.first_name || ' ' || approver.last_name as approved_by_name,
                        sa.created_at
                    FROM stock_adjustments sa
                    JOIN products p ON sa.product_id = p.id
                    JOIN users u ON sa.adjusted_by = u.id
                    LEFT JOIN users approver ON sa.approved_by = approver.id
                    WHERE sa.id = %s
                """, (adjustment_id,))
                
                row = cursor.fetchone()
                if not row:
                    return jsonify({'error': 'Stock adjustment not found'}), 404
                
                adjustment = {
                    'id': row['id'],
                    'product': {
                        'id': row['product_id'],
                        'name': row['product_name'],
                        'category': row['product_category'],
                        'barcode': row['barcode']
                    },
                    'adjustment_type': row['adjustment_type'],
                    'quantity_change': row['quantity_change'],
                    'quantity_before': row['quantity_before'],
                    'quantity_after': row['quantity_after'],
                    'reason': row['reason'],
                    'reference_number': row['reference_number'],
                    'adjustment_date': row['adjustment_date'].isoformat(),
                    'adjusted_by': {
                        'id': row['adjusted_by'],
                        'registration_number': row['adjusted_by_reg'],
                        'name': row['adjusted_by_name']
                    },
                    'approved_by': {
                        'id': row['approved_by'],
                        'name': row['approved_by_name']
                    } if row['approved_by'] else None,
                    'created_at': row['created_at'].isoformat()
                }
        
        return jsonify(adjustment), 200
        
    except Exception as e:
        logger.error(f"Get stock adjustment error: {type(e).__name__}: {e}", exc_info=True)
        return jsonify({'error': f'{type(e).__name__}: {str(e)}'}), 500


@adjustments_bp.route('/types', methods=['GET'])
@jwt_required()
def get_adjustment_types():
    """Get list of valid adjustment types"""
    return jsonify({
        'types': [
            {'value': 'correction', 'label': 'Stock Correction', 'description': 'Correct counting errors'},
            {'value': 'damage', 'label': 'Damaged', 'description': 'Items damaged and removed'},
            {'value': 'loss', 'label': 'Lost/Stolen', 'description': 'Items lost or stolen'},
            {'value': 'found', 'label': 'Found', 'description': 'Previously missing items found'},
            {'value': 'transfer', 'label': 'Transfer', 'description': 'Transferred to/from another location'},
            {'value': 'return', 'label': 'Return', 'description': 'Items returned from users'},
            {'value': 'initial', 'label': 'Initial Stock', 'description': 'Initial inventory count'}
        ]
    }), 200


@adjustments_bp.route('/summary', methods=['GET'])
@jwt_required()
def get_adjustments_summary():
    """Get summary statistics for stock adjustments"""
    try:
        days = request.args.get('days', 30, type=int)
        
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # Get summary by type
                cursor.execute("""
                    SELECT 
                        adjustment_type,
                        COUNT(*) as count,
                        SUM(ABS(quantity_change)) as total_quantity,
                        SUM(CASE WHEN quantity_change > 0 THEN quantity_change ELSE 0 END) as additions,
                        SUM(CASE WHEN quantity_change < 0 THEN ABS(quantity_change) ELSE 0 END) as removals
                    FROM stock_adjustments
                    WHERE adjustment_date >= CURRENT_DATE - INTERVAL '%s days'
                    GROUP BY adjustment_type
                    ORDER BY count DESC
                """, (days,))
                
                by_type = [
                    {
                        'adjustment_type': row['adjustment_type'],
                        'count': row['count'],
                        'total_quantity': row['total_quantity'],
                        'additions': row['additions'],
                        'removals': row['removals']
                    }
                    for row in cursor.fetchall()
                ]
                
                # Get most adjusted products
                cursor.execute("""
                    SELECT 
                        p.id,
                        p.name,
                        p.category,
                        COUNT(sa.id) as adjustment_count,
                        SUM(ABS(sa.quantity_change)) as total_changed
                    FROM stock_adjustments sa
                    JOIN products p ON sa.product_id = p.id
                    WHERE sa.adjustment_date >= CURRENT_DATE - INTERVAL '%s days'
                    GROUP BY p.id, p.name, p.category
                    ORDER BY adjustment_count DESC
                    LIMIT 10
                """, (days,))
                
                most_adjusted = [
                    {
                        'product_id': row['id'],
                        'product_name': row['name'],
                        'category': row['category'],
                        'adjustment_count': row['adjustment_count'],
                        'total_changed': row['total_changed']
                    }
                    for row in cursor.fetchall()
                ]
                
                # Overall stats
                cursor.execute("""
                    SELECT 
                        COUNT(*) as total_adjustments,
                        SUM(CASE WHEN quantity_change > 0 THEN quantity_change ELSE 0 END) as total_additions,
                        SUM(CASE WHEN quantity_change < 0 THEN ABS(quantity_change) ELSE 0 END) as total_removals,
                        COUNT(DISTINCT product_id) as products_affected,
                        COUNT(DISTINCT adjusted_by) as users_involved
                    FROM stock_adjustments
                    WHERE adjustment_date >= CURRENT_DATE - INTERVAL '%s days'
                """, (days,))
                
                stats = cursor.fetchone()
        
        return jsonify({
            'period_days': days,
            'by_type': by_type,
            'most_adjusted_products': most_adjusted,
            'overall_stats': {
                'total_adjustments': stats['total_adjustments'],
                'total_additions': stats['total_additions'],
                'total_removals': stats['total_removals'],
                'products_affected': stats['products_affected'],
                'users_involved': stats['users_involved']
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Get adjustments summary error: {type(e).__name__}: {e}", exc_info=True)
        return jsonify({'error': f'{type(e).__name__}: {str(e)}'}), 500
