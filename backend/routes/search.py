"""
Advanced Search & Filters Routes
Handles saved searches, filtering, sorting, and CSV exports
"""

from flask import Blueprint, request, jsonify, Response
from datetime import datetime, timedelta
from psycopg.rows import dict_row
from functools import wraps
import jwt
import os
import csv
import io
import json
from backend.database import get_db_connection

search_bp = Blueprint('search', __name__)

# JWT configuration
SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')

def token_required(f):
    """Decorator to require valid JWT token"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        try:
            if token.startswith('Bearer '):
                token = token[7:]
            data = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
            request.user_id = data['user_id']
            request.role = data.get('role', 'operator')
        except Exception as e:
            return jsonify({'error': 'Invalid token'}), 401
        
        return f(*args, **kwargs)
    return decorated


# ============= SAVED SEARCHES =============

@search_bp.route('/api/saved-searches', methods=['GET'])
@token_required
def get_saved_searches():
    """Get user's saved searches"""
    try:
        search_type = request.args.get('type')
        include_public = request.args.get('include_public', 'false').lower() == 'true'
        
        conn = get_db_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            if include_public:
                query = """
                    SELECT * FROM user_saved_searches
                    WHERE user_id = %s OR is_public = TRUE
                    ORDER BY is_default DESC, use_count DESC, last_used_at DESC NULLS LAST
                """
                params = (request.user_id,)
            else:
                query = """
                    SELECT * FROM user_saved_searches
                    WHERE user_id = %s
                    ORDER BY is_default DESC, use_count DESC, last_used_at DESC NULLS LAST
                """
                params = (request.user_id,)
            
            if search_type:
                query = query.replace("ORDER BY", "AND search_type = %s ORDER BY")
                params = params + (search_type,)
            
            cur.execute(query, params)
            searches = cur.fetchall()
            
            return jsonify({
                'saved_searches': [dict(s) for s in searches],
                'count': len(searches)
            }), 200
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@search_bp.route('/api/saved-searches', methods=['POST'])
@token_required
def create_saved_search():
    """Create a new saved search"""
    try:
        data = request.get_json()
        name = data.get('name')
        description = data.get('description', '')
        search_type = data.get('search_type')
        filters = data.get('filters', {})
        sorting = data.get('sorting')
        is_default = data.get('is_default', False)
        is_public = data.get('is_public', False)
        
        if not name or not search_type:
            return jsonify({'error': 'Name and search_type required'}), 400
        
        conn = get_db_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            # If setting as default, unset other defaults for this type
            if is_default:
                cur.execute("""
                    UPDATE saved_searches
                    SET is_default = FALSE
                    WHERE user_id = %s AND search_type = %s
                """, (request.user_id, search_type))
            
            # Create saved search
            cur.execute("""
                INSERT INTO saved_searches 
                (user_id, name, description, search_type, filters, sorting, is_default, is_public)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
            """, (request.user_id, name, description, search_type, 
                  json.dumps(filters), json.dumps(sorting) if sorting else None,
                  is_default, is_public))
            
            saved_search = cur.fetchone()
            conn.commit()
            
            return jsonify({
                'success': True,
                'saved_search': dict(saved_search)
            }), 201
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@search_bp.route('/api/saved-searches/<int:search_id>', methods=['PUT'])
@token_required
def update_saved_search(search_id):
    """Update a saved search"""
    try:
        data = request.get_json()
        
        conn = get_db_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            # Check ownership
            cur.execute("""
                SELECT * FROM saved_searches WHERE id = %s
            """, (search_id,))
            
            saved_search = cur.fetchone()
            if not saved_search:
                return jsonify({'error': 'Saved search not found'}), 404
            
            if saved_search['user_id'] != request.user_id:
                return jsonify({'error': 'Can only update your own saved searches'}), 403
            
            # Update fields
            updates = []
            params = []
            
            if 'name' in data:
                updates.append('name = %s')
                params.append(data['name'])
            if 'description' in data:
                updates.append('description = %s')
                params.append(data['description'])
            if 'filters' in data:
                updates.append('filters = %s')
                params.append(json.dumps(data['filters']))
            if 'sorting' in data:
                updates.append('sorting = %s')
                params.append(json.dumps(data['sorting']))
            if 'is_default' in data:
                if data['is_default']:
                    # Unset other defaults
                    cur.execute("""
                        UPDATE saved_searches
                        SET is_default = FALSE
                        WHERE user_id = %s AND search_type = %s AND id != %s
                    """, (request.user_id, saved_search['search_type'], search_id))
                updates.append('is_default = %s')
                params.append(data['is_default'])
            if 'is_public' in data:
                updates.append('is_public = %s')
                params.append(data['is_public'])
            
            if not updates:
                return jsonify({'error': 'No fields to update'}), 400
            
            updates.append('updated_at = CURRENT_TIMESTAMP')
            params.append(search_id)
            
            query = f"""
                UPDATE saved_searches
                SET {', '.join(updates)}
                WHERE id = %s
                RETURNING *
            """
            
            cur.execute(query, params)
            updated_search = cur.fetchone()
            conn.commit()
            
            return jsonify({
                'success': True,
                'saved_search': dict(updated_search)
            }), 200
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@search_bp.route('/api/saved-searches/<int:search_id>', methods=['DELETE'])
@token_required
def delete_saved_search(search_id):
    """Delete a saved search"""
    try:
        conn = get_db_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            # Check ownership
            cur.execute("""
                SELECT * FROM saved_searches WHERE id = %s
            """, (search_id,))
            
            saved_search = cur.fetchone()
            if not saved_search:
                return jsonify({'error': 'Saved search not found'}), 404
            
            if saved_search['user_id'] != request.user_id:
                return jsonify({'error': 'Can only delete your own saved searches'}), 403
            
            # Delete
            cur.execute("""
                DELETE FROM saved_searches WHERE id = %s
            """, (search_id,))
            
            conn.commit()
            
            return jsonify({'success': True}), 200
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@search_bp.route('/api/saved-searches/<int:search_id>/use', methods=['POST'])
@token_required
def use_saved_search(search_id):
    """Mark a saved search as used (updates usage stats)"""
    try:
        conn = get_db_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("""
                UPDATE saved_searches
                SET last_used_at = CURRENT_TIMESTAMP,
                    use_count = use_count + 1
                WHERE id = %s
                RETURNING *
            """, (search_id,))
            
            saved_search = cur.fetchone()
            if not saved_search:
                return jsonify({'error': 'Saved search not found'}), 404
            
            conn.commit()
            
            return jsonify({
                'success': True,
                'saved_search': dict(saved_search)
            }), 200
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============= ADVANCED SEARCH =============

@search_bp.route('/api/search/<search_type>', methods=['POST'])
@token_required
def advanced_search(search_type):
    """Execute an advanced search with filters and sorting"""
    try:
        data = request.get_json()
        filters = data.get('filters', {})
        sorting = data.get('sorting', {})
        page = int(data.get('page', 1))
        per_page = int(data.get('per_page', 50))
        
        # Track search in history
        conn = get_db_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            # Build query based on search type
            query, count_query, params = build_search_query(search_type, filters, sorting, request.user_id, request.role)
            
            # Get total count
            cur.execute(count_query, params)
            total_count = cur.fetchone()['count']
            
            # Add pagination
            offset = (page - 1) * per_page
            query += f" LIMIT {per_page} OFFSET {offset}"
            
            # Execute search
            cur.execute(query, params)
            results = cur.fetchall()
            
            # Log search history
            cur.execute("""
                INSERT INTO search_history (user_id, search_type, filters, result_count)
                VALUES (%s, %s, %s, %s)
            """, (request.user_id, search_type, json.dumps(filters), total_count))
            
            conn.commit()
            
            return jsonify({
                'results': [dict(r) for r in results],
                'total': total_count,
                'page': page,
                'per_page': per_page,
                'total_pages': (total_count + per_page - 1) // per_page
            }), 200
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def build_search_query(search_type, filters, sorting, user_id, user_role):
    """Build SQL query based on search type and filters"""
    
    # Base queries for different types
    base_queries = {
        'requests': """
            SELECT r.*, u.username, p.name as product_name
            FROM requests r
            JOIN users u ON r.user_id = u.id
            LEFT JOIN products p ON r.product_id = p.id
        """,
        'products': """
            SELECT * FROM products
        """,
        'debts': """
            SELECT d.*, u.username, p.name as product_name
            FROM debts d
            JOIN users u ON d.user_id = u.id
            LEFT JOIN products p ON d.product_id = p.id
        """,
        'users': """
            SELECT id, username, email, role, status, registration_number, created_at
            FROM users
        """,
        'payments': """
            SELECT pr.*, u.username
            FROM payment_records pr
            JOIN users u ON pr.user_id = u.id
        """
    }
    
    if search_type not in base_queries:
        raise ValueError(f"Invalid search type: {search_type}")
    
    query = base_queries[search_type]
    count_query = query.replace("SELECT r.*, u.username, p.name as product_name", "SELECT COUNT(*) as count")
    count_query = count_query.replace("SELECT *", "SELECT COUNT(*) as count")
    
    where_clauses = []
    params = []
    
    # Apply filters
    if 'status' in filters and filters['status']:
        statuses = filters['status'] if isinstance(filters['status'], list) else [filters['status']]
        where_clauses.append(f"status = ANY(%s)")
        params.append(statuses)
    
    if 'user_id' in filters and filters['user_id']:
        user_ids = filters['user_id'] if isinstance(filters['user_id'], list) else [filters['user_id']]
        where_clauses.append(f"user_id = ANY(%s)")
        params.append(user_ids)
    
    if 'date_range' in filters:
        dr = filters['date_range']
        if isinstance(dr, str):
            # Predefined ranges
            if dr == 'today':
                where_clauses.append("DATE(created_at) = CURRENT_DATE")
            elif dr == 'yesterday':
                where_clauses.append("DATE(created_at) = CURRENT_DATE - 1")
            elif dr == 'last_7_days':
                where_clauses.append("created_at >= CURRENT_DATE - INTERVAL '7 days'")
            elif dr == 'last_30_days':
                where_clauses.append("created_at >= CURRENT_DATE - INTERVAL '30 days'")
            elif dr == 'this_month':
                where_clauses.append("DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)")
            elif dr == 'last_month':
                where_clauses.append("DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')")
        elif isinstance(dr, dict):
            if 'start' in dr:
                where_clauses.append("created_at >= %s")
                params.append(dr['start'])
            if 'end' in dr:
                where_clauses.append("created_at <= %s")
                params.append(dr['end'])
    
    if 'price_range' in filters and search_type in ['products', 'debts']:
        pr = filters['price_range']
        if 'min' in pr:
            where_clauses.append("price >= %s" if search_type == 'products' else "total_amount >= %s")
            params.append(pr['min'])
        if 'max' in pr:
            where_clauses.append("price <= %s" if search_type == 'products' else "total_amount <= %s")
            params.append(pr['max'])
    
    if 'keywords' in filters and filters['keywords']:
        # Simple keyword search (can be enhanced with full-text search)
        keyword = f"%{filters['keywords']}%"
        if search_type == 'requests':
            where_clauses.append("(p.name ILIKE %s OR u.username ILIKE %s)")
            params.extend([keyword, keyword])
        elif search_type == 'products':
            where_clauses.append("(name ILIKE %s OR description ILIKE %s)")
            params.extend([keyword, keyword])
    
    if 'overdue' in filters and filters['overdue'] and search_type == 'requests':
        where_clauses.append("delivery_date < CURRENT_TIMESTAMP AND status != 'delivered'")
    
    # User-specific filters (non-admin sees only their data)
    if user_role not in ['admin', 'operator'] and search_type in ['requests', 'debts', 'payments']:
        where_clauses.append("user_id = %s")
        params.append(user_id)
    
    # Add WHERE clause
    if where_clauses:
        where_sql = " WHERE " + " AND ".join(where_clauses)
        query += where_sql
        count_query += where_sql
    
    # Add sorting
    sort_column = sorting.get('column', 'created_at')
    sort_direction = sorting.get('direction', 'DESC').upper()
    
    if sort_direction not in ['ASC', 'DESC']:
        sort_direction = 'DESC'
    
    query += f" ORDER BY {sort_column} {sort_direction}"
    
    return query, count_query, params


# ============= CSV EXPORT =============

@search_bp.route('/api/export/<export_type>', methods=['POST'])
@token_required
def export_to_csv(export_type):
    """Export search results to CSV"""
    try:
        data = request.get_json()
        filters = data.get('filters', {})
        sorting = data.get('sorting', {})
        
        conn = get_db_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            # Build query
            query, _, params = build_search_query(export_type, filters, sorting, request.user_id, request.role)
            
            # Execute query (no pagination for export)
            cur.execute(query, params)
            results = cur.fetchall()
            
            if not results:
                return jsonify({'error': 'No data to export'}), 400
            
            # Create CSV
            output = io.StringIO()
            writer = csv.DictWriter(output, fieldnames=results[0].keys())
            writer.writeheader()
            writer.writerows([dict(r) for r in results])
            
            # Log export
            cur.execute("""
                INSERT INTO export_history (user_id, export_type, filters, record_count, file_name)
                VALUES (%s, %s, %s, %s, %s)
            """, (request.user_id, export_type, json.dumps(filters), len(results), 
                  f"{export_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"))
            
            conn.commit()
            
            # Return CSV as downloadable file
            csv_data = output.getvalue()
            return Response(
                csv_data,
                mimetype='text/csv',
                headers={
                    'Content-Disposition': f'attachment; filename={export_type}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
                }
            )
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============= FILTER SUGGESTIONS =============

@search_bp.route('/api/filter-suggestions/<search_type>', methods=['GET'])
@token_required
def get_filter_suggestions(search_type):
    """Get filter suggestions based on user's search history"""
    try:
        conn = get_db_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("""
                SELECT * FROM get_filter_suggestions(%s, %s)
            """, (request.user_id, search_type))
            
            suggestions = cur.fetchall()
            
            return jsonify({
                'suggestions': [dict(s) for s in suggestions]
            }), 200
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============= POPULAR SEARCHES =============

@search_bp.route('/api/popular-searches', methods=['GET'])
@token_required
def get_popular_searches():
    """Get popular searches across all users"""
    try:
        conn = get_db_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("SELECT * FROM popular_searches")
            
            popular = cur.fetchall()
            
            return jsonify({
                'popular_searches': [dict(p) for p in popular]
            }), 200
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500
