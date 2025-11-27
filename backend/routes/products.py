"""
Product routes
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.models.product import Product
from backend.models.user import User
from backend.routes.auth import get_current_user_id
import logging

products_bp = Blueprint('products', __name__)

@products_bp.route('', methods=['GET'])
@jwt_required()
def get_products():
    """Get all products with optional filtering"""
    try:
        # Query parameters
        category = request.args.get('category')
        search = request.args.get('search')
        active_only = request.args.get('active_only', 'true').lower() == 'true'
        limit = request.args.get('limit', type=int)
        offset = request.args.get('offset', type=int, default=0)
        
        products = Product.get_all(
            category=category,
            active_only=active_only,
            limit=limit,
            offset=offset,
            search=search
        )
        
        return jsonify({
            'products': [product.to_dict() for product in products],
            'count': len(products)
        }), 200
        
    except Exception as e:
        logging.error(f"Get products error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@products_bp.route('/<int:product_id>', methods=['GET'])
@jwt_required()
def get_product(product_id):
    """Get specific product by ID"""
    try:
        product = Product.get_by_id(product_id)
        
        if not product:
            return jsonify({'error': 'Product not found'}), 404
        
        # Get additional product information
        product_data = product.to_dict()
        product_data['transaction_history'] = product.get_transaction_history(limit=10)
        product_data['pending_requests'] = product.get_pending_requests()
        
        return jsonify(product_data), 200
        
    except Exception as e:
        logging.error(f"Get product error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@products_bp.route('', methods=['POST'])
@jwt_required()
def create_product():
    """Create new product (admin/operator only)"""
    try:
        current_user_id = get_current_user_id()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user or current_user.role not in ['admin', 'operator']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        required_fields = ['name', 'unit_of_measure']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        product = Product.create(
            name=data['name'],
            description=data.get('description'),
            category=data.get('category'),
            unit_of_measure=data['unit_of_measure'],
            stock_quantity=float(data.get('stock_quantity', 0)),
            minimum_stock=float(data.get('minimum_stock', 0)),
            unit_price=float(data['unit_price']) if data.get('unit_price') else None,
            location=data.get('location')
        )
        
        if not product:
            return jsonify({'error': 'Failed to create product'}), 500
        
        return jsonify({
            'message': 'Product created successfully',
            'product': product.to_dict()
        }), 201
        
    except Exception as e:
        logging.error(f"Create product error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@products_bp.route('/<int:product_id>', methods=['PUT'])
@jwt_required()
def update_product(product_id):
    """Update product (admin/operator only)"""
    try:
        current_user_id = get_current_user_id()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user or current_user.role not in ['admin', 'operator']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        product = Product.get_by_id(product_id)
        if not product:
            return jsonify({'error': 'Product not found'}), 404
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Update product
        if product.update(**data):
            return jsonify({
                'message': 'Product updated successfully',
                'product': product.to_dict()
            }), 200
        else:
            return jsonify({'error': 'Failed to update product'}), 500
        
    except Exception as e:
        logging.error(f"Update product error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@products_bp.route('/<int:product_id>/stock', methods=['PUT'])
@jwt_required()
def update_stock(product_id):
    """Update product stock (admin/operator only)"""
    try:
        current_user_id = get_current_user_id()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user or current_user.role not in ['admin', 'operator']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        product = Product.get_by_id(product_id)
        if not product:
            return jsonify({'error': 'Product not found'}), 404
        
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        quantity_change = data.get('quantity_change')
        transaction_type = data.get('transaction_type')  # 'in', 'out', 'adjustment'
        notes = data.get('notes')
        
        if quantity_change is None or not transaction_type:
            return jsonify({'error': 'quantity_change and transaction_type are required'}), 400
        
        try:
            quantity_change = float(quantity_change)
        except (ValueError, TypeError):
            return jsonify({'error': 'quantity_change must be a number'}), 400
        
        # For 'out' transactions, make quantity negative
        if transaction_type == 'out' and quantity_change > 0:
            quantity_change = -quantity_change
        
        # Update stock
        if product.update_stock(
            quantity_change=quantity_change,
            transaction_type=transaction_type,
            reference_type='manual',
            performed_by=current_user_id,
            notes=notes
        ):
            return jsonify({
                'message': 'Stock updated successfully',
                'product': product.to_dict()
            }), 200
        else:
            return jsonify({'error': 'Failed to update stock'}), 500
        
    except Exception as e:
        logging.error(f"Update stock error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@products_bp.route('/<int:product_id>', methods=['DELETE'])
@jwt_required()
def delete_product(product_id):
    """Deactivate product (admin only)"""
    try:
        current_user_id = get_current_user_id()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        product = Product.get_by_id(product_id)
        if not product:
            return jsonify({'error': 'Product not found'}), 404
        
        if product.deactivate():
            return jsonify({'message': 'Product deactivated successfully'}), 200
        else:
            return jsonify({'error': 'Failed to deactivate product'}), 500
        
    except Exception as e:
        logging.error(f"Delete product error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@products_bp.route('/categories', methods=['GET'])
@jwt_required()
def get_categories():
    """Get all product categories"""
    try:
        categories = Product.get_categories()
        return jsonify({'categories': categories}), 200
        
    except Exception as e:
        logging.error(f"Get categories error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@products_bp.route('/<int:product_id>/availability', methods=['GET'])
@jwt_required()
def check_availability(product_id):
    """Check product availability"""
    try:
        product = Product.get_by_id(product_id)
        if not product:
            return jsonify({'error': 'Product not found'}), 404
        
        requested_quantity = float(request.args.get('quantity', 0))
        available = product.check_availability(requested_quantity)
        
        return jsonify({
            'product_id': product_id,
            'requested_quantity': requested_quantity,
            'current_stock': product.stock_quantity,
            'available': available,
            'max_available': product.stock_quantity
        }), 200
        
    except Exception as e:
        logging.error(f"Check availability error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@products_bp.route('/<int:product_id>/transactions', methods=['GET'])
@jwt_required()
def get_product_transactions(product_id):
    """Get product transaction history (operator/admin only)"""
    try:
        current_user_id = get_current_user_id()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user or current_user.role not in ['admin', 'operator']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        product = Product.get_by_id(product_id)
        if not product:
            return jsonify({'error': 'Product not found'}), 404
        
        limit = int(request.args.get('limit', 50))
        transactions = product.get_transaction_history(limit=limit)
        
        return jsonify({
            'product_id': product_id,
            'transactions': transactions
        }), 200
        
    except Exception as e:
        logging.error(f"Get product transactions error: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@products_bp.route('/batch-update', methods=['POST'])
@jwt_required()
def batch_update_products():
    """Update multiple products at once (admin only)"""
    try:
        current_user_id = get_current_user_id()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        
        data = request.get_json()
        product_ids = data.get('product_ids', [])
        updates = data.get('updates', {})
        
        if not product_ids:
            return jsonify({'error': 'No products specified'}), 400
        
        if not updates:
            return jsonify({'error': 'No updates specified'}), 400
        
        # Build update query dynamically
        from backend.database import get_db_connection
        
        allowed_fields = ['category', 'location', 'minimum_stock', 'reorder_point', 
                         'reorder_quantity', 'is_active', 'barcode']
        update_fields = []
        params = []
        
        for field, value in updates.items():
            if field in allowed_fields:
                update_fields.append(f"{field} = %s")
                params.append(value)
        
        if not update_fields:
            return jsonify({'error': 'No valid fields to update'}), 400
        
        params.append(tuple(product_ids))
        
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                query = f"""
                    UPDATE products 
                    SET {', '.join(update_fields)}, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ANY(%s)
                    RETURNING id
                """
                cursor.execute(query, params)
                updated_ids = [row['id'] for row in cursor.fetchall()]
                conn.commit()
        
        return jsonify({
            'message': f'Successfully updated {len(updated_ids)} products',
            'updated_ids': updated_ids
        }), 200
        
    except Exception as e:
        logging.error(f"Batch update products error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@products_bp.route('/low-stock', methods=['GET'])
@jwt_required()
def get_low_stock_products():
    """Get products with low stock levels"""
    try:
        from backend.database import get_db_connection
        
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT 
                        p.id,
                        p.name,
                        p.category,
                        p.stock_quantity,
                        p.minimum_stock,
                        p.reorder_point,
                        p.reorder_quantity,
                        p.location,
                        p.barcode,
                        s.id as supplier_id,
                        s.name as supplier_name,
                        s.email as supplier_email,
                        s.phone as supplier_phone,
                        ps.cost_price,
                        ps.lead_time_days,
                        ps.minimum_order_quantity
                    FROM products p
                    LEFT JOIN product_suppliers ps ON p.id = ps.product_id AND ps.is_preferred = TRUE
                    LEFT JOIN suppliers s ON ps.supplier_id = s.id
                    WHERE p.is_active = TRUE 
                        AND (
                            p.stock_quantity <= COALESCE(p.reorder_point, p.minimum_stock)
                            OR p.stock_quantity <= p.minimum_stock
                        )
                    ORDER BY 
                        CASE 
                            WHEN p.stock_quantity <= 0 THEN 1
                            WHEN p.stock_quantity <= p.minimum_stock THEN 2
                            WHEN p.stock_quantity <= p.reorder_point THEN 3
                            ELSE 4
                        END,
                        p.stock_quantity ASC
                """)
                
                low_stock_products = [
                    {
                        'id': row['id'],
                        'name': row['name'],
                        'category': row['category'],
                        'stock_quantity': row['stock_quantity'],
                        'minimum_stock': row['minimum_stock'],
                        'reorder_point': row['reorder_point'],
                        'reorder_quantity': row['reorder_quantity'],
                        'location': row['location'],
                        'barcode': row['barcode'],
                        'status': 'out_of_stock' if row['stock_quantity'] <= 0 else 
                                 'critical' if row['stock_quantity'] <= row['minimum_stock'] else 
                                 'low',
                        'supplier': {
                            'id': row['supplier_id'],
                            'name': row['supplier_name'],
                            'email': row['supplier_email'],
                            'phone': row['supplier_phone'],
                            'cost_price': float(row['cost_price']) if row['cost_price'] else None,
                            'lead_time_days': row['lead_time_days'],
                            'minimum_order_quantity': row['minimum_order_quantity']
                        } if row['supplier_id'] else None
                    }
                    for row in cursor.fetchall()
                ]
        
        return jsonify({
            'low_stock_products': low_stock_products,
            'count': len(low_stock_products)
        }), 200
        
    except Exception as e:
        logging.error(f"Get low stock products error: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500
