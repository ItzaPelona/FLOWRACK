"""
Product model and database operations
"""

from backend.database import db
from datetime import datetime

class Product:
    """Product model class"""
    
    def __init__(self, product_data=None):
        if product_data:
            self.id = product_data.get('id')
            self.name = product_data.get('name')
            self.description = product_data.get('description')
            self.category = product_data.get('category')
            self.unit_of_measure = product_data.get('unit_of_measure')
            self.stock_quantity = float(product_data.get('stock_quantity', 0))
            self.minimum_stock = float(product_data.get('minimum_stock', 0))
            self.unit_price = float(product_data.get('unit_price', 0)) if product_data.get('unit_price') else None
            self.location = product_data.get('location')
            self.is_active = product_data.get('is_active', True)
            self.created_at = product_data.get('created_at')
            self.updated_at = product_data.get('updated_at')
    
    @classmethod
    def create(cls, name, unit_of_measure, description=None, category=None, 
               stock_quantity=0, minimum_stock=0, unit_price=None, location=None):
        """Create new product"""
        query = """
            INSERT INTO products (name, description, category, unit_of_measure, 
                                stock_quantity, minimum_stock, unit_price, location)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, name, description, category, unit_of_measure, stock_quantity, 
                     minimum_stock, unit_price, location, is_active, created_at
        """
        params = (name, description, category, unit_of_measure, stock_quantity, 
                 minimum_stock, unit_price, location)
        
        result = db.execute_query(query, params, fetch=True, fetchone=True)
        return cls(result) if result else None
    
    @classmethod
    def get_by_id(cls, product_id):
        """Get product by ID"""
        query = """
            SELECT id, name, description, category, unit_of_measure, stock_quantity,
                   minimum_stock, unit_price, location, is_active, created_at, updated_at
            FROM products WHERE id = %s
        """
        result = db.execute_query(query, (product_id,), fetch=True, fetchone=True)
        return cls(result) if result else None
    
    @classmethod
    def get_all(cls, category=None, active_only=True, limit=None, offset=None, search=None):
        """Get all products with optional filtering"""
        query = """
            SELECT id, name, description, category, unit_of_measure, stock_quantity,
                   minimum_stock, unit_price, location, is_active, created_at, updated_at
            FROM products WHERE 1=1
        """
        params = []
        
        if active_only:
            query += " AND is_active = TRUE"
        
        if category:
            query += " AND category = %s"
            params.append(category)
        
        if search:
            query += " AND (name ILIKE %s OR description ILIKE %s OR category ILIKE %s)"
            search_param = f"%{search}%"
            params.extend([search_param, search_param, search_param])
        
        query += " ORDER BY name ASC"
        
        if limit:
            query += " LIMIT %s"
            params.append(limit)
        
        if offset:
            query += " OFFSET %s"
            params.append(offset)
        
        results = db.execute_query(query, params, fetch=True)
        return [cls(product_data) for product_data in results] if results else []
    
    @classmethod
    def get_categories(cls):
        """Get all product categories"""
        query = "SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND is_active = TRUE ORDER BY category"
        results = db.execute_query(query, fetch=True)
        return [row['category'] for row in results] if results else []
    
    @classmethod
    def get_low_stock_products(cls, threshold_multiplier=1.0):
        """Get products with low stock"""
        query = """
            SELECT id, name, description, category, unit_of_measure, stock_quantity,
                   minimum_stock, unit_price, location, is_active, created_at, updated_at
            FROM products 
            WHERE is_active = TRUE AND stock_quantity <= (minimum_stock * %s)
            ORDER BY (stock_quantity / GREATEST(minimum_stock, 1)) ASC
        """
        results = db.execute_query(query, (threshold_multiplier,), fetch=True)
        return [cls(product_data) for product_data in results] if results else []
    
    def update(self, **kwargs):
        """Update product information"""
        updateable_fields = ['name', 'description', 'category', 'unit_of_measure', 
                           'stock_quantity', 'minimum_stock', 'unit_price', 'location']
        updates = []
        params = []
        
        for field, value in kwargs.items():
            if field in updateable_fields and value is not None:
                updates.append(f"{field} = %s")
                params.append(value)
        
        if not updates:
            return False
        
        query = f"""
            UPDATE products SET {', '.join(updates)}, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING id, name, description, category, unit_of_measure, stock_quantity,
                     minimum_stock, unit_price, location, is_active, created_at, updated_at
        """
        params.append(self.id)
        
        result = db.execute_query(query, params, fetch=True, fetchone=True)
        if result:
            # Update current instance
            for key, value in result.items():
                setattr(self, key, value)
            return True
        return False
    
    def update_stock(self, quantity_change, transaction_type, reference_type=None, 
                     reference_id=None, performed_by=None, notes=None):
        """Update product stock and record transaction"""
        try:
            # Prepare queries for transaction
            queries_and_params = []
            
            # Update stock quantity
            update_query = """
                UPDATE products SET stock_quantity = stock_quantity + %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                RETURNING stock_quantity
            """
            queries_and_params.append((update_query, (quantity_change, self.id)))
            
            # Record inventory transaction
            transaction_query = """
                INSERT INTO inventory_transactions 
                (product_id, transaction_type, quantity, reference_type, reference_id, 
                 performed_by, notes)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """
            queries_and_params.append((transaction_query, 
                (self.id, transaction_type, abs(quantity_change), reference_type, 
                 reference_id, performed_by, notes)))
            
            # Execute transaction
            results = db.execute_transaction(queries_and_params)
            
            if results and len(results) > 0:
                # Update current instance stock quantity
                self.stock_quantity = float(results[0][0]['stock_quantity'])
                return True
            return False
            
        except Exception as e:
            print(f"Error updating stock: {e}")
            return False
    
    def check_availability(self, requested_quantity):
        """Check if requested quantity is available"""
        return self.stock_quantity >= requested_quantity
    
    def deactivate(self):
        """Deactivate product (soft delete)"""
        query = "UPDATE products SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = %s"
        rows_affected = db.execute_query(query, (self.id,))
        if rows_affected > 0:
            self.is_active = False
            return True
        return False
    
    def get_transaction_history(self, limit=50):
        """Get product transaction history"""
        query = """
            SELECT it.*, u.first_name || ' ' || u.last_name as performed_by_name
            FROM inventory_transactions it
            LEFT JOIN users u ON it.performed_by = u.id
            WHERE it.product_id = %s
            ORDER BY it.created_at DESC
            LIMIT %s
        """
        results = db.execute_query(query, (self.id, limit), fetch=True)
        return results if results else []
    
    def get_pending_requests(self):
        """Get pending requests for this product"""
        query = """
            SELECT r.id, r.request_number, r.requested_date, r.requested_time,
                   ri.requested_quantity, u.first_name || ' ' || u.last_name as user_name
            FROM request_items ri
            JOIN requests r ON ri.request_id = r.id
            JOIN users u ON r.user_id = u.id
            WHERE ri.product_id = %s AND r.status IN ('pending', 'approved')
            ORDER BY r.requested_date, r.requested_time
        """
        results = db.execute_query(query, (self.id,), fetch=True)
        return results if results else []
    
    @property
    def stock_status(self):
        """Get stock status"""
        if self.stock_quantity == 0:
            return 'out_of_stock'
        elif self.stock_quantity <= self.minimum_stock:
            return 'low_stock'
        else:
            return 'in_stock'
    
    @property
    def stock_status_display(self):
        """Get display-friendly stock status"""
        status_map = {
            'out_of_stock': 'Out of Stock',
            'low_stock': 'Low Stock',
            'in_stock': 'In Stock'
        }
        return status_map.get(self.stock_status, 'Unknown')
    
    def to_dict(self):
        """Convert product to dictionary"""
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'category': self.category,
            'unit_of_measure': self.unit_of_measure,
            'stock_quantity': self.stock_quantity,
            'minimum_stock': self.minimum_stock,
            'unit_price': self.unit_price,
            'location': self.location,
            'is_active': self.is_active,
            'stock_status': self.stock_status,
            'stock_status_display': self.stock_status_display,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def __repr__(self):
        return f"<Product {self.id}: {self.name} ({self.stock_quantity} {self.unit_of_measure})>"