"""
User model and database operations
"""

from backend.database import db
from werkzeug.security import generate_password_hash, check_password_hash
import bcrypt
from datetime import datetime

class User:
    """User model class"""
    
    def __init__(self, user_data=None):
        if user_data:
            self.id = user_data.get('id')
            self.registration_number = user_data.get('registration_number')
            self.first_name = user_data.get('first_name')
            self.last_name = user_data.get('last_name')
            self.email = user_data.get('email')
            self.phone = user_data.get('phone')
            self.role = user_data.get('role', 'user')
            self.department = user_data.get('department')
            self.is_active = user_data.get('is_active', True)
            self.created_at = user_data.get('created_at')
            self.updated_at = user_data.get('updated_at')
    
    @staticmethod
    def hash_password(password):
        """Hash password using bcrypt"""
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    @staticmethod
    def check_password(password, password_hash):
        """Check password against hash"""
        return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))
    
    @classmethod
    def create(cls, registration_number, password, first_name, last_name, email, 
               phone=None, role='user', department=None):
        """Create new user"""
        password_hash = cls.hash_password(password)
        
        query = """
            INSERT INTO users (registration_number, password_hash, first_name, last_name, 
                             email, phone, role, department)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, registration_number, first_name, last_name, email, phone, role, department, is_active, created_at
        """
        params = (registration_number, password_hash, first_name, last_name, email, phone, role, department)
        
        result = db.execute_query(query, params, fetch=True, fetchone=True)
        return cls(result) if result else None
    
    @classmethod
    def get_by_id(cls, user_id):
        """Get user by ID"""
        query = """
            SELECT id, registration_number, first_name, last_name, email, phone, 
                   role, department, is_active, created_at, updated_at
            FROM users WHERE id = %s AND is_active = TRUE
        """
        result = db.execute_query(query, (user_id,), fetch=True, fetchone=True)
        return cls(result) if result else None
    
    @classmethod
    def get_by_registration_number(cls, registration_number):
        """Get user by registration number"""
        query = """
            SELECT id, registration_number, password_hash, first_name, last_name, email, 
                   phone, role, department, is_active, created_at, updated_at
            FROM users WHERE registration_number = %s AND is_active = TRUE
        """
        result = db.execute_query(query, (registration_number,), fetch=True, fetchone=True)
        return cls(result) if result else None
    
    @classmethod
    def get_by_email(cls, email):
        """Get user by email"""
        query = """
            SELECT id, registration_number, password_hash, first_name, last_name, email, 
                   phone, role, department, is_active, created_at, updated_at
            FROM users WHERE email = %s AND is_active = TRUE
        """
        result = db.execute_query(query, (email,), fetch=True, fetchone=True)
        return cls(result) if result else None
    
    @classmethod
    def get_all(cls, role=None, limit=None, offset=None):
        """Get all users with optional filtering"""
        query = """
            SELECT id, registration_number, first_name, last_name, email, phone, 
                   role, department, is_active, created_at, updated_at
            FROM users WHERE is_active = TRUE
        """
        params = []
        
        if role:
            query += " AND role = %s"
            params.append(role)
        
        query += " ORDER BY created_at DESC"
        
        if limit:
            query += " LIMIT %s"
            params.append(limit)
        
        if offset:
            query += " OFFSET %s"
            params.append(offset)
        
        results = db.execute_query(query, params, fetch=True)
        return [cls(user_data) for user_data in results] if results else []
    
    def update(self, **kwargs):
        """Update user information"""
        updateable_fields = ['first_name', 'last_name', 'email', 'phone', 'department']
        updates = []
        params = []
        
        for field, value in kwargs.items():
            if field in updateable_fields and value is not None:
                updates.append(f"{field} = %s")
                params.append(value)
        
        if not updates:
            return False
        
        query = f"""
            UPDATE users SET {', '.join(updates)}, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING id, registration_number, first_name, last_name, email, phone, 
                     role, department, is_active, created_at, updated_at
        """
        params.append(self.id)
        
        result = db.execute_query(query, params, fetch=True, fetchone=True)
        if result:
            # Update current instance
            for key, value in result.items():
                setattr(self, key, value)
            return True
        return False
    
    def deactivate(self):
        """Deactivate user (soft delete)"""
        query = "UPDATE users SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = %s"
        rows_affected = db.execute_query(query, (self.id,))
        if rows_affected > 0:
            self.is_active = False
            return True
        return False
    
    def change_password(self, old_password, new_password):
        """Change user password"""
        # Verify old password
        user_with_hash = self.get_by_id(self.id)
        if not user_with_hash:
            return False
        
        # Get password hash from database
        query = "SELECT password_hash FROM users WHERE id = %s"
        result = db.execute_query(query, (self.id,), fetch=True, fetchone=True)
        if not result or not self.check_password(old_password, result['password_hash']):
            return False
        
        # Update password
        new_password_hash = self.hash_password(new_password)
        query = "UPDATE users SET password_hash = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s"
        rows_affected = db.execute_query(query, (new_password_hash, self.id))
        return rows_affected > 0
    
    def to_dict(self, include_sensitive=False):
        """Convert user to dictionary"""
        user_dict = {
            'id': self.id,
            'registration_number': self.registration_number,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'full_name': f"{self.first_name} {self.last_name}",
            'email': self.email,
            'phone': self.phone,
            'role': self.role,
            'department': self.department,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_sensitive and hasattr(self, 'password_hash'):
            user_dict['password_hash'] = self.password_hash
        
        return user_dict
    
    def get_request_summary(self):
        """Get user's request summary"""
        query = """
            SELECT 
                COUNT(*) as total_requests,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_requests,
                COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_requests,
                COUNT(CASE WHEN status = 'delivered' THEN 1 END) as active_requests,
                COUNT(CASE WHEN status = 'returned' THEN 1 END) as completed_requests
            FROM requests 
            WHERE user_id = %s
        """
        result = db.execute_query(query, (self.id,), fetch=True, fetchone=True)
        return dict(result) if result else {}
    
    def get_debt_summary(self):
        """Get user's debt summary"""
        query = """
            SELECT 
                COUNT(*) as total_debts,
                COALESCE(SUM(total_amount), 0) as total_amount,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_debts,
                COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_debts
            FROM debts 
            WHERE user_id = %s
        """
        result = db.execute_query(query, (self.id,), fetch=True, fetchone=True)
        return dict(result) if result else {}
    
    def __repr__(self):
        return f"<User {self.registration_number}: {self.first_name} {self.last_name}>"