"""
Request model and database operations
"""

from backend.database import db
from backend.models.user import User
from backend.models.product import Product
from datetime import datetime, date, time

class Request:
    """Request model class"""
    
    def __init__(self, request_data=None):
        if request_data:
            self.id = request_data.get('id')
            self.user_id = request_data.get('user_id')
            self.request_number = request_data.get('request_number')
            self.status = request_data.get('status', 'pending')
            self.requested_date = request_data.get('requested_date')
            self.requested_time = request_data.get('requested_time')
            self.estimated_usage_period = request_data.get('estimated_usage_period')
            self.supervising_instructor = request_data.get('supervising_instructor')
            self.purpose = request_data.get('purpose')
            self.collection_date = request_data.get('collection_date')
            self.delivery_date = request_data.get('delivery_date')
            self.return_date = request_data.get('return_date')
            self.notes = request_data.get('notes')
            self.created_at = request_data.get('created_at')
            self.updated_at = request_data.get('updated_at')
    
    @classmethod
    def generate_request_number(cls):
        """Generate unique request number"""
        from datetime import datetime
        import random
        import string
        
        # Format: REQ-YYYYMMDD-XXXX
        date_str = datetime.now().strftime("%Y%m%d")
        random_str = ''.join(random.choices(string.digits, k=4))
        return f"REQ-{date_str}-{random_str}"
    
    @classmethod
    def create(cls, user_id, requested_date, requested_time, items, 
               estimated_usage_period=None, supervising_instructor=None, purpose=None):
        """Create new request with items"""
        try:
            # Generate request number
            request_number = cls.generate_request_number()
            
            # Ensure unique request number
            while cls.get_by_request_number(request_number):
                request_number = cls.generate_request_number()
            
            # Prepare queries for transaction
            queries_and_params = []
            
            # Create request
            create_request_query = """
                INSERT INTO requests (user_id, request_number, requested_date, requested_time,
                                    estimated_usage_period, supervising_instructor, purpose)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id, user_id, request_number, status, requested_date, requested_time,
                         estimated_usage_period, supervising_instructor, purpose, created_at
            """
            queries_and_params.append((create_request_query,
                (user_id, request_number, requested_date, requested_time,
                 estimated_usage_period, supervising_instructor, purpose)))
            
            # Execute transaction to create request
            results = db.execute_transaction(queries_and_params)
            
            if results and len(results) > 0:
                request_data = results[0][0]  # First result, first row
                request = cls(request_data)
                
                # Add items to request
                for item in items:
                    request.add_item(
                        product_id=item['product_id'],
                        requested_quantity=item['requested_quantity']
                    )
                
                return request
            
            return None
            
        except Exception as e:
            print(f"Error creating request: {e}")
            return None
    
    @classmethod
    def get_by_id(cls, request_id):
        """Get request by ID"""
        query = """
            SELECT id, user_id, request_number, status, requested_date, requested_time,
                   estimated_usage_period, supervising_instructor, purpose, collection_date,
                   delivery_date, return_date, notes, created_at, updated_at
            FROM requests WHERE id = %s
        """
        result = db.execute_query(query, (request_id,), fetch=True, fetchone=True)
        return cls(result) if result else None
    
    @classmethod
    def get_by_request_number(cls, request_number):
        """Get request by request number"""
        query = """
            SELECT id, user_id, request_number, status, requested_date, requested_time,
                   estimated_usage_period, supervising_instructor, purpose, collection_date,
                   delivery_date, return_date, notes, created_at, updated_at
            FROM requests WHERE request_number = %s
        """
        result = db.execute_query(query, (request_number,), fetch=True, fetchone=True)
        return cls(result) if result else None
    
    @classmethod
    def get_by_user(cls, user_id, status=None, limit=None, offset=None):
        """Get requests by user"""
        query = """
            SELECT id, user_id, request_number, status, requested_date, requested_time,
                   estimated_usage_period, supervising_instructor, purpose, collection_date,
                   delivery_date, return_date, notes, created_at, updated_at
            FROM requests WHERE user_id = %s
        """
        params = [user_id]
        
        if status:
            query += " AND status = %s"
            params.append(status)
        
        query += " ORDER BY created_at DESC"
        
        if limit:
            query += " LIMIT %s"
            params.append(limit)
        
        if offset:
            query += " OFFSET %s"
            params.append(offset)
        
        results = db.execute_query(query, params, fetch=True)
        return [cls(request_data) for request_data in results] if results else []
    
    @classmethod
    def get_all(cls, status=None, user_id=None, limit=None, offset=None, date_from=None, date_to=None):
        """Get all requests with optional filtering"""
        query = """
            SELECT r.id, r.user_id, r.request_number, r.status, r.requested_date, r.requested_time,
                   r.estimated_usage_period, r.supervising_instructor, r.purpose, r.collection_date,
                   r.delivery_date, r.return_date, r.notes, r.created_at, r.updated_at,
                   u.first_name || ' ' || u.last_name as user_name,
                   u.registration_number
            FROM requests r
            JOIN users u ON r.user_id = u.id
            WHERE 1=1
        """
        params = []
        
        if status:
            query += " AND r.status = %s"
            params.append(status)
        
        if user_id:
            query += " AND r.user_id = %s"
            params.append(user_id)
        
        if date_from:
            query += " AND r.requested_date >= %s"
            params.append(date_from)
        
        if date_to:
            query += " AND r.requested_date <= %s"
            params.append(date_to)
        
        query += " ORDER BY r.created_at DESC"
        
        if limit:
            query += " LIMIT %s"
            params.append(limit)
        
        if offset:
            query += " OFFSET %s"
            params.append(offset)
        
        results = db.execute_query(query, params, fetch=True)
        return [cls(result) for result in results] if results else []
    
    def add_item(self, product_id, requested_quantity):
        """Add item to request"""
        try:
            query = """
                INSERT INTO request_items (request_id, product_id, requested_quantity)
                VALUES (%s, %s, %s)
                RETURNING id
            """
            result = db.execute_query(query, (self.id, product_id, requested_quantity), 
                                    fetch=True, fetchone=True)
            return result['id'] if result else None
            
        except Exception as e:
            print(f"Error adding item to request: {e}")
            return None
    
    def get_items(self):
        """Get all items in this request"""
        query = """
            SELECT ri.*, p.name as product_name, p.unit_of_measure, p.stock_quantity
            FROM request_items ri
            JOIN products p ON ri.product_id = p.id
            WHERE ri.request_id = %s
            ORDER BY ri.created_at
        """
        results = db.execute_query(query, (self.id,), fetch=True)
        return results if results else []
    
    def update_status(self, new_status, notes=None, performed_by=None):
        """Update request status"""
        try:
            updates = ["status = %s", "updated_at = CURRENT_TIMESTAMP"]
            params = [new_status]
            
            if notes:
                updates.append("notes = %s")
                params.append(notes)
            
            # Set timestamps based on status
            if new_status == 'collecting':
                updates.append("collection_date = CURRENT_TIMESTAMP")
            elif new_status == 'delivered':
                updates.append("delivery_date = CURRENT_TIMESTAMP")
            elif new_status == 'returned':
                updates.append("return_date = CURRENT_TIMESTAMP")
            
            query = f"""
                UPDATE requests SET {', '.join(updates)}
                WHERE id = %s
                RETURNING status, collection_date, delivery_date, return_date, updated_at
            """
            params.append(self.id)
            
            result = db.execute_query(query, params, fetch=True, fetchone=True)
            
            if result:
                # Update current instance
                self.status = result['status']
                self.collection_date = result['collection_date']
                self.delivery_date = result['delivery_date']
                self.return_date = result['return_date']
                self.updated_at = result['updated_at']
                if notes:
                    self.notes = notes
                return True
            
            return False
            
        except Exception as e:
            print(f"Error updating request status: {e}")
            return False
    
    def approve_items(self, item_approvals):
        """Approve specific quantities for items"""
        try:
            queries_and_params = []
            
            for item_approval in item_approvals:
                item_id = item_approval['item_id']
                approved_quantity = item_approval['approved_quantity']
                
                query = """
                    UPDATE request_items 
                    SET approved_quantity = %s
                    WHERE id = %s AND request_id = %s
                """
                queries_and_params.append((query, (approved_quantity, item_id, self.id)))
            
            # Update request status to approved
            status_query = """
                UPDATE requests 
                SET status = 'approved', updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """
            queries_and_params.append((status_query, (self.id,)))
            
            results = db.execute_transaction(queries_and_params)
            
            if results:
                self.status = 'approved'
                return True
            
            return False
            
        except Exception as e:
            print(f"Error approving items: {e}")
            return False
    
    def record_delivery_weights(self, weight_data):
        """Record weights during delivery"""
        try:
            queries_and_params = []
            
            for weight_item in weight_data:
                item_id = weight_item['item_id']
                delivered_quantity = weight_item['delivered_quantity']
                delivered_weight = weight_item.get('delivered_weight')
                
                query = """
                    UPDATE request_items 
                    SET delivered_quantity = %s, delivered_weight = %s
                    WHERE id = %s AND request_id = %s
                """
                queries_and_params.append((query, 
                    (delivered_quantity, delivered_weight, item_id, self.id)))
            
            results = db.execute_transaction(queries_and_params)
            return bool(results)
            
        except Exception as e:
            print(f"Error recording delivery weights: {e}")
            return False
    
    def record_return_weights(self, weight_data):
        """Record weights during return"""
        try:
            queries_and_params = []
            
            for weight_item in weight_data:
                item_id = weight_item['item_id']
                returned_quantity = weight_item['returned_quantity']
                returned_weight = weight_item.get('returned_weight')
                
                query = """
                    UPDATE request_items 
                    SET returned_quantity = %s, returned_weight = %s
                    WHERE id = %s AND request_id = %s
                """
                queries_and_params.append((query, 
                    (returned_quantity, returned_weight, item_id, self.id)))
            
            results = db.execute_transaction(queries_and_params)
            return bool(results)
            
        except Exception as e:
            print(f"Error recording return weights: {e}")
            return False
    
    def get_user(self):
        """Get user who made this request"""
        return User.get_by_id(self.user_id)
    
    def check_availability(self):
        """Check if all requested items are available"""
        items = self.get_items()
        availability = {}
        all_available = True
        
        for item in items:
            product = Product.get_by_id(item['product_id'])
            if product:
                available = product.check_availability(item['requested_quantity'])
                availability[item['product_id']] = {
                    'available': available,
                    'requested': item['requested_quantity'],
                    'in_stock': product.stock_quantity
                }
                if not available:
                    all_available = False
        
        return {
            'all_available': all_available,
            'items': availability
        }
    
    def to_dict(self, include_items=False, include_user=False):
        """Convert request to dictionary"""
        request_dict = {
            'id': self.id,
            'user_id': self.user_id,
            'request_number': self.request_number,
            'status': self.status,
            'requested_date': self.requested_date.isoformat() if self.requested_date else None,
            'requested_time': str(self.requested_time) if self.requested_time else None,
            'estimated_usage_period': self.estimated_usage_period,
            'supervising_instructor': self.supervising_instructor,
            'purpose': self.purpose,
            'collection_date': self.collection_date.isoformat() if self.collection_date else None,
            'delivery_date': self.delivery_date.isoformat() if self.delivery_date else None,
            'return_date': self.return_date.isoformat() if self.return_date else None,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_items:
            request_dict['items'] = self.get_items()
        
        if include_user:
            user = self.get_user()
            if user:
                request_dict['user'] = user.to_dict()
        
        return request_dict
    
    def __repr__(self):
        return f"<Request {self.request_number}: {self.status}>"