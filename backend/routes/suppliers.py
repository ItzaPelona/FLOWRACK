"""
Suppliers management routes
Handle CRUD operations for suppliers and product-supplier relationships
"""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.database import get_db_connection
import logging

suppliers_bp = Blueprint('suppliers', __name__)
logger = logging.getLogger(__name__)


@suppliers_bp.route('', methods=['GET'])
@jwt_required()
def get_suppliers():
    """Get all suppliers with optional filters"""
    try:
        is_active = request.args.get('active', type=lambda v: v.lower() == 'true')
        search = request.args.get('search', '').strip()
        
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                query = """
                    SELECT 
                        s.id,
                        s.name,
                        s.contact_person,
                        s.email,
                        s.phone,
                        s.address,
                        s.website,
                        s.notes,
                        s.is_active,
                        s.created_at,
                        s.updated_at,
                        COUNT(DISTINCT ps.product_id) as product_count
                    FROM suppliers s
                    LEFT JOIN product_suppliers ps ON s.id = ps.supplier_id
                    WHERE 1=1
                """
                params = []
                
                if is_active is not None:
                    query += " AND s.is_active = %s"
                    params.append(is_active)
                
                if search:
                    query += " AND (s.name ILIKE %s OR s.contact_person ILIKE %s OR s.email ILIKE %s)"
                    search_pattern = f'%{search}%'
                    params.extend([search_pattern, search_pattern, search_pattern])
                
                query += " GROUP BY s.id ORDER BY s.name"
                
                cursor.execute(query, params)
                suppliers = [
                    {
                        'id': row['id'],
                        'name': row['name'],
                        'contact_person': row['contact_person'],
                        'email': row['email'],
                        'phone': row['phone'],
                        'address': row['address'],
                        'website': row['website'],
                        'notes': row['notes'],
                        'is_active': row['is_active'],
                        'product_count': row['product_count'],
                        'created_at': row['created_at'].isoformat(),
                        'updated_at': row['updated_at'].isoformat()
                    }
                    for row in cursor.fetchall()
                ]
        
        return jsonify({'suppliers': suppliers}), 200
        
    except Exception as e:
        logger.error(f"Get suppliers error: {type(e).__name__}: {e}", exc_info=True)
        return jsonify({'error': f'{type(e).__name__}: {str(e)}'}), 500


@suppliers_bp.route('/<int:supplier_id>', methods=['GET'])
@jwt_required()
def get_supplier(supplier_id):
    """Get a specific supplier with its products"""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # Get supplier details
                cursor.execute("""
                    SELECT 
                        id, name, contact_person, email, phone,
                        address, website, notes, is_active,
                        created_at, updated_at
                    FROM suppliers
                    WHERE id = %s
                """, (supplier_id,))
                
                row = cursor.fetchone()
                if not row:
                    return jsonify({'error': 'Supplier not found'}), 404
                
                supplier = {
                    'id': row['id'],
                    'name': row['name'],
                    'contact_person': row['contact_person'],
                    'email': row['email'],
                    'phone': row['phone'],
                    'address': row['address'],
                    'website': row['website'],
                    'notes': row['notes'],
                    'is_active': row['is_active'],
                    'created_at': row['created_at'].isoformat(),
                    'updated_at': row['updated_at'].isoformat()
                }
                
                # Get supplier's products
                cursor.execute("""
                    SELECT 
                        p.id,
                        p.name,
                        p.category,
                        p.stock_quantity,
                        p.minimum_stock,
                        ps.supplier_product_code,
                        ps.cost_price,
                        ps.lead_time_days,
                        ps.minimum_order_quantity,
                        ps.is_preferred
                    FROM product_suppliers ps
                    JOIN products p ON ps.product_id = p.id
                    WHERE ps.supplier_id = %s
                    ORDER BY p.name
                """, (supplier_id,))
                
                products = [
                    {
                        'id': row['id'],
                        'name': row['name'],
                        'category': row['category'],
                        'stock_quantity': row['stock_quantity'],
                        'minimum_stock': row['minimum_stock'],
                        'supplier_product_code': row['supplier_product_code'],
                        'cost_price': float(row['cost_price']) if row['cost_price'] else None,
                        'lead_time_days': row['lead_time_days'],
                        'minimum_order_quantity': row['minimum_order_quantity'],
                        'is_preferred': row['is_preferred']
                    }
                    for row in cursor.fetchall()
                ]
                
                supplier['products'] = products
        
        return jsonify(supplier), 200
        
    except Exception as e:
        logger.error(f"Get supplier error: {type(e).__name__}: {e}", exc_info=True)
        return jsonify({'error': f'{type(e).__name__}: {str(e)}'}), 500


@suppliers_bp.route('', methods=['POST'])
@jwt_required()
def create_supplier():
    """Create a new supplier"""
    try:
        data = request.get_json()
        
        # Validate required fields
        if 'name' not in data:
            return jsonify({'error': 'Supplier name is required'}), 400
        
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO suppliers (
                        name, contact_person, email, phone,
                        address, website, notes, is_active
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id, created_at
                """, (
                    data['name'],
                    data.get('contact_person'),
                    data.get('email'),
                    data.get('phone'),
                    data.get('address'),
                    data.get('website'),
                    data.get('notes'),
                    data.get('is_active', True)
                ))
                
                result = cursor.fetchone()
                conn.commit()
        
        return jsonify({
            'message': 'Supplier created successfully',
            'supplier': {
                'id': result['id'],
                'name': data['name'],
                'created_at': result['created_at'].isoformat()
            }
        }), 201
        
    except Exception as e:
        logger.error(f"Create supplier error: {type(e).__name__}: {e}", exc_info=True)
        return jsonify({'error': f'{type(e).__name__}: {str(e)}'}), 500


@suppliers_bp.route('/<int:supplier_id>', methods=['PUT'])
@jwt_required()
def update_supplier(supplier_id):
    """Update an existing supplier"""
    try:
        data = request.get_json()
        
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # Check if supplier exists
                cursor.execute("SELECT id FROM suppliers WHERE id = %s", (supplier_id,))
                if not cursor.fetchone():
                    return jsonify({'error': 'Supplier not found'}), 404
                
                # Build update query
                update_fields = []
                params = []
                
                if 'name' in data:
                    update_fields.append("name = %s")
                    params.append(data['name'])
                
                if 'contact_person' in data:
                    update_fields.append("contact_person = %s")
                    params.append(data['contact_person'])
                
                if 'email' in data:
                    update_fields.append("email = %s")
                    params.append(data['email'])
                
                if 'phone' in data:
                    update_fields.append("phone = %s")
                    params.append(data['phone'])
                
                if 'address' in data:
                    update_fields.append("address = %s")
                    params.append(data['address'])
                
                if 'website' in data:
                    update_fields.append("website = %s")
                    params.append(data['website'])
                
                if 'notes' in data:
                    update_fields.append("notes = %s")
                    params.append(data['notes'])
                
                if 'is_active' in data:
                    update_fields.append("is_active = %s")
                    params.append(data['is_active'])
                
                if not update_fields:
                    return jsonify({'error': 'No fields to update'}), 400
                
                update_fields.append("updated_at = CURRENT_TIMESTAMP")
                params.append(supplier_id)
                
                query = f"UPDATE suppliers SET {', '.join(update_fields)} WHERE id = %s"
                cursor.execute(query, params)
                conn.commit()
        
        return jsonify({'message': 'Supplier updated successfully'}), 200
        
    except Exception as e:
        logger.error(f"Update supplier error: {type(e).__name__}: {e}", exc_info=True)
        return jsonify({'error': f'{type(e).__name__}: {str(e)}'}), 500


@suppliers_bp.route('/<int:supplier_id>', methods=['DELETE'])
@jwt_required()
def delete_supplier(supplier_id):
    """Delete a supplier (or deactivate if has products)"""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # Check if supplier has products
                cursor.execute("""
                    SELECT COUNT(*) as product_count
                    FROM product_suppliers
                    WHERE supplier_id = %s
                """, (supplier_id,))
                
                result = cursor.fetchone()
                if result['product_count'] > 0:
                    # Deactivate instead of deleting
                    cursor.execute("""
                        UPDATE suppliers 
                        SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
                        WHERE id = %s
                    """, (supplier_id,))
                    message = 'Supplier deactivated (has associated products)'
                else:
                    # Safe to delete
                    cursor.execute("DELETE FROM suppliers WHERE id = %s", (supplier_id,))
                    message = 'Supplier deleted successfully'
                
                conn.commit()
        
        return jsonify({'message': message}), 200
        
    except Exception as e:
        logger.error(f"Delete supplier error: {type(e).__name__}: {e}", exc_info=True)
        return jsonify({'error': f'{type(e).__name__}: {str(e)}'}), 500


@suppliers_bp.route('/<int:supplier_id>/products', methods=['POST'])
@jwt_required()
def add_product_to_supplier(supplier_id):
    """Associate a product with a supplier"""
    try:
        data = request.get_json()
        
        if 'product_id' not in data:
            return jsonify({'error': 'product_id is required'}), 400
        
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # If this is set as preferred, unset other preferred suppliers for this product
                if data.get('is_preferred', False):
                    cursor.execute("""
                        UPDATE product_suppliers 
                        SET is_preferred = FALSE
                        WHERE product_id = %s
                    """, (data['product_id'],))
                
                cursor.execute("""
                    INSERT INTO product_suppliers (
                        product_id, supplier_id, supplier_product_code,
                        cost_price, lead_time_days, minimum_order_quantity, is_preferred
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (product_id, supplier_id) 
                    DO UPDATE SET
                        supplier_product_code = EXCLUDED.supplier_product_code,
                        cost_price = EXCLUDED.cost_price,
                        lead_time_days = EXCLUDED.lead_time_days,
                        minimum_order_quantity = EXCLUDED.minimum_order_quantity,
                        is_preferred = EXCLUDED.is_preferred,
                        updated_at = CURRENT_TIMESTAMP
                    RETURNING id
                """, (
                    data['product_id'],
                    supplier_id,
                    data.get('supplier_product_code'),
                    data.get('cost_price'),
                    data.get('lead_time_days', 7),
                    data.get('minimum_order_quantity', 1),
                    data.get('is_preferred', False)
                ))
                
                result = cursor.fetchone()
                conn.commit()
        
        return jsonify({
            'message': 'Product associated with supplier successfully',
            'id': result['id']
        }), 201
        
    except Exception as e:
        logger.error(f"Add product to supplier error: {type(e).__name__}: {e}", exc_info=True)
        return jsonify({'error': f'{type(e).__name__}: {str(e)}'}), 500


@suppliers_bp.route('/<int:supplier_id>/products/<int:product_id>', methods=['DELETE'])
@jwt_required()
def remove_product_from_supplier(supplier_id, product_id):
    """Remove product-supplier association"""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    DELETE FROM product_suppliers
                    WHERE supplier_id = %s AND product_id = %s
                """, (supplier_id, product_id))
                
                conn.commit()
        
        return jsonify({'message': 'Product removed from supplier'}), 200
        
    except Exception as e:
        logger.error(f"Remove product from supplier error: {type(e).__name__}: {e}", exc_info=True)
        return jsonify({'error': f'{type(e).__name__}: {str(e)}'}), 500
