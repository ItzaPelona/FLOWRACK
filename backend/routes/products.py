"""
Product routes
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.models.product import Product
from backend.models.user import User
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
        current_user_id = get_jwt_identity()
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
        current_user_id = get_jwt_identity()
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
        current_user_id = get_jwt_identity()
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
        current_user_id = get_jwt_identity()
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

@products_bp.route('/low-stock', methods=['GET'])
@jwt_required()
def get_low_stock_products():
    """Get products with low stock (operator/admin only)"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.get_by_id(current_user_id)
        
        if not current_user or current_user.role not in ['admin', 'operator']:
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        threshold = float(request.args.get('threshold', 1.0))
        products = Product.get_low_stock_products(threshold_multiplier=threshold)
        
        return jsonify({
            'products': [product.to_dict() for product in products],
            'count': len(products)
        }), 200
        
    except Exception as e:
        logging.error(f"Get low stock products error: {e}")
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
        current_user_id = get_jwt_identity()
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