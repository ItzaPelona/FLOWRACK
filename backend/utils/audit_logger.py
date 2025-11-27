"""
Audit Logger Utility
Helper functions for logging user activities
"""

from backend.database import get_db_connection
from flask import request
import json
import logging

def log_activity(user_id, action_type, description, entity_type=None, entity_id=None, details=None):
    """
    Log user activity to the activity_logs table
    
    Args:
        user_id: ID of the user performing the action
        action_type: Type of action (create, update, delete, approve, etc.)
        description: Human-readable description
        entity_type: Type of entity affected (user, product, request, etc.)
        entity_id: ID of the affected entity
        details: Additional structured data (dict)
    """
    try:
        # Get IP and user agent from request context
        ip_address = request.remote_addr if request else None
        user_agent = request.headers.get('User-Agent') if request else None
        
        # Convert details to JSON if provided
        details_json = json.dumps(details) if details else None
        
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO activity_logs 
                    (user_id, action_type, entity_type, entity_id, description, details, ip_address, user_agent)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (user_id, action_type, entity_type, entity_id, description, details_json, ip_address, user_agent))
                
                log_id = cursor.fetchone()['id']
                conn.commit()
                
                return log_id
                
    except Exception as e:
        logging.error(f"Activity logging error: {e}", exc_info=True)
        # Don't fail the main operation if logging fails
        return None


def log_login(user_id, registration_number, success=True):
    """Log user login attempt"""
    description = f"User {registration_number} logged in successfully" if success else f"Failed login attempt for {registration_number}"
    return log_activity(
        user_id=user_id if success else None,
        action_type='login' if success else 'login_failed',
        description=description,
        entity_type='user',
        entity_id=user_id if success else None
    )


def log_logout(user_id, registration_number):
    """Log user logout"""
    return log_activity(
        user_id=user_id,
        action_type='logout',
        description=f"User {registration_number} logged out",
        entity_type='user',
        entity_id=user_id
    )


def log_request_create(user_id, request_id, request_number, items_count):
    """Log new request creation"""
    return log_activity(
        user_id=user_id,
        action_type='create',
        description=f"Created new request {request_number} with {items_count} items",
        entity_type='request',
        entity_id=request_id,
        details={'request_number': request_number, 'items_count': items_count}
    )


def log_request_status_change(user_id, request_id, request_number, old_status, new_status):
    """Log request status change"""
    return log_activity(
        user_id=user_id,
        action_type='status_change',
        description=f"Changed request {request_number} status from '{old_status}' to '{new_status}'",
        entity_type='request',
        entity_id=request_id,
        details={'old_status': old_status, 'new_status': new_status}
    )


def log_request_approval(user_id, request_id, request_number):
    """Log request approval"""
    return log_activity(
        user_id=user_id,
        action_type='approve',
        description=f"Approved request {request_number}",
        entity_type='request',
        entity_id=request_id
    )


def log_request_rejection(user_id, request_id, request_number, reason):
    """Log request rejection"""
    return log_activity(
        user_id=user_id,
        action_type='reject',
        description=f"Rejected request {request_number}: {reason}",
        entity_type='request',
        entity_id=request_id,
        details={'reason': reason}
    )


def log_stock_adjustment(user_id, adjustment_id, product_id, product_name, adjustment_type, quantity_change, quantity_before, quantity_after):
    """Log stock adjustment"""
    return log_activity(
        user_id=user_id,
        action_type='stock_adjustment',
        description=f"{adjustment_type}: {product_name} - Changed from {quantity_before} to {quantity_after} ({quantity_change:+})",
        entity_type='adjustment',
        entity_id=adjustment_id,
        details={
            'product_id': product_id,
            'product_name': product_name,
            'adjustment_type': adjustment_type,
            'quantity_change': str(quantity_change),
            'quantity_before': str(quantity_before),
            'quantity_after': str(quantity_after)
        }
    )


def log_product_create(user_id, product_id, product_name):
    """Log new product creation"""
    return log_activity(
        user_id=user_id,
        action_type='create',
        description=f"Created new product: {product_name}",
        entity_type='product',
        entity_id=product_id
    )


def log_product_update(user_id, product_id, product_name, changes):
    """Log product update"""
    return log_activity(
        user_id=user_id,
        action_type='update',
        description=f"Updated product: {product_name}",
        entity_type='product',
        entity_id=product_id,
        details={'changes': changes}
    )


def log_product_delete(user_id, product_id, product_name):
    """Log product deletion"""
    return log_activity(
        user_id=user_id,
        action_type='delete',
        description=f"Deleted product: {product_name}",
        entity_type='product',
        entity_id=product_id
    )


def log_user_create(admin_id, new_user_id, registration_number, role):
    """Log new user creation"""
    return log_activity(
        user_id=admin_id,
        action_type='create',
        description=f"Created new user {registration_number} with role '{role}'",
        entity_type='user',
        entity_id=new_user_id,
        details={'registration_number': registration_number, 'role': role}
    )


def log_user_update(admin_id, target_user_id, registration_number, changes):
    """Log user update"""
    return log_activity(
        user_id=admin_id,
        action_type='update',
        description=f"Updated user {registration_number}",
        entity_type='user',
        entity_id=target_user_id,
        details={'changes': changes}
    )


def log_user_status_change(admin_id, target_user_id, registration_number, old_status, new_status):
    """Log user status change"""
    return log_activity(
        user_id=admin_id,
        action_type='status_change',
        description=f"Changed user {registration_number} status from '{old_status}' to '{new_status}'",
        entity_type='user',
        entity_id=target_user_id,
        details={'old_status': old_status, 'new_status': new_status}
    )


def log_supplier_create(user_id, supplier_id, supplier_name):
    """Log new supplier creation"""
    return log_activity(
        user_id=user_id,
        action_type='create',
        description=f"Created new supplier: {supplier_name}",
        entity_type='supplier',
        entity_id=supplier_id
    )


def log_supplier_update(user_id, supplier_id, supplier_name):
    """Log supplier update"""
    return log_activity(
        user_id=user_id,
        action_type='update',
        description=f"Updated supplier: {supplier_name}",
        entity_type='supplier',
        entity_id=supplier_id
    )
