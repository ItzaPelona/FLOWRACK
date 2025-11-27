"""
Collaboration Features Routes
Handles request comments, internal notes, sharing, and team requests
"""

from flask import Blueprint, request, jsonify
from datetime import datetime
from psycopg.rows import dict_row
from functools import wraps
import jwt
import os
from backend.database import get_db_connection

collaboration_bp = Blueprint('collaboration', __name__)

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

def admin_or_operator_required(f):
    """Decorator to require admin or operator role"""
    @wraps(f)
    @token_required
    def decorated(*args, **kwargs):
        if request.role not in ['admin', 'operator']:
            return jsonify({'error': 'Operator or admin access required'}), 403
        return f(*args, **kwargs)
    return decorated


# ============= REQUEST COMMENTS =============

@collaboration_bp.route('/api/requests/<int:request_id>/comments', methods=['GET'])
@token_required
def get_request_comments(request_id):
    """Get all comments for a request"""
    try:
        include_internal = request.args.get('include_internal', 'false').lower() == 'true'
        
        conn = get_db_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            # Check if user has access to this request
            cur.execute("""
                SELECT user_has_request_access(%s, %s) as has_access
            """, (request.user_id, request_id))
            
            if not cur.fetchone()['has_access']:
                return jsonify({'error': 'Access denied'}), 403
            
            # Build query based on access level
            if request.role in ['admin', 'operator'] and include_internal:
                query = """
                    SELECT * FROM request_comments_view
                    WHERE request_id = %s
                    ORDER BY created_at ASC
                """
            else:
                query = """
                    SELECT * FROM request_comments_view
                    WHERE request_id = %s AND is_internal = FALSE
                    ORDER BY created_at ASC
                """
            
            cur.execute(query, (request_id,))
            comments = cur.fetchall()
            
            return jsonify({
                'comments': [dict(c) for c in comments],
                'count': len(comments)
            }), 200
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@collaboration_bp.route('/api/requests/<int:request_id>/comments', methods=['POST'])
@token_required
def add_comment(request_id):
    """Add a comment to a request"""
    try:
        data = request.get_json()
        comment_text = data.get('comment')
        is_internal = data.get('is_internal', False)
        parent_comment_id = data.get('parent_comment_id')
        
        if not comment_text or not comment_text.strip():
            return jsonify({'error': 'Comment cannot be empty'}), 400
        
        # Only operators/admins can create internal notes
        if is_internal and request.role not in ['admin', 'operator']:
            return jsonify({'error': 'Only staff can create internal notes'}), 403
        
        conn = get_db_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            # Check access
            cur.execute("""
                SELECT user_has_request_access(%s, %s) as has_access
            """, (request.user_id, request_id))
            
            if not cur.fetchone()['has_access']:
                return jsonify({'error': 'Access denied'}), 403
            
            # Insert comment
            cur.execute("""
                INSERT INTO request_comments 
                (request_id, user_id, comment, is_internal, parent_comment_id)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING *
            """, (request_id, request.user_id, comment_text, is_internal, parent_comment_id))
            
            comment = cur.fetchone()
            conn.commit()
            
            return jsonify({
                'success': True,
                'comment': dict(comment)
            }), 201
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@collaboration_bp.route('/api/comments/<int:comment_id>', methods=['PUT'])
@token_required
def update_comment(comment_id):
    """Update a comment"""
    try:
        data = request.get_json()
        new_comment_text = data.get('comment')
        
        if not new_comment_text or not new_comment_text.strip():
            return jsonify({'error': 'Comment cannot be empty'}), 400
        
        conn = get_db_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            # Check ownership
            cur.execute("""
                SELECT * FROM request_comments WHERE id = %s
            """, (comment_id,))
            
            comment = cur.fetchone()
            if not comment:
                return jsonify({'error': 'Comment not found'}), 404
            
            if comment['user_id'] != request.user_id and request.role != 'admin':
                return jsonify({'error': 'Can only edit your own comments'}), 403
            
            # Update comment
            cur.execute("""
                UPDATE request_comments
                SET comment = %s
                WHERE id = %s
                RETURNING *
            """, (new_comment_text, comment_id))
            
            updated_comment = cur.fetchone()
            conn.commit()
            
            return jsonify({
                'success': True,
                'comment': dict(updated_comment)
            }), 200
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@collaboration_bp.route('/api/comments/<int:comment_id>', methods=['DELETE'])
@token_required
def delete_comment(comment_id):
    """Soft delete a comment"""
    try:
        conn = get_db_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            # Check ownership
            cur.execute("""
                SELECT * FROM request_comments WHERE id = %s
            """, (comment_id,))
            
            comment = cur.fetchone()
            if not comment:
                return jsonify({'error': 'Comment not found'}), 404
            
            if comment['user_id'] != request.user_id and request.role != 'admin':
                return jsonify({'error': 'Can only delete your own comments'}), 403
            
            # Soft delete
            cur.execute("""
                UPDATE request_comments
                SET deleted = TRUE, deleted_at = CURRENT_TIMESTAMP, deleted_by = %s
                WHERE id = %s
            """, (request.user_id, comment_id))
            
            conn.commit()
            
            return jsonify({'success': True}), 200
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@collaboration_bp.route('/api/comments/<int:comment_id>/react', methods=['POST'])
@token_required
def react_to_comment(comment_id):
    """Add a reaction to a comment"""
    try:
        data = request.get_json()
        reaction_type = data.get('reaction_type', 'like')
        
        conn = get_db_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            # Toggle reaction (remove if exists, add if not)
            cur.execute("""
                INSERT INTO comment_reactions (comment_id, user_id, reaction_type)
                VALUES (%s, %s, %s)
                ON CONFLICT (comment_id, user_id, reaction_type) 
                DO DELETE WHERE comment_reactions.comment_id = %s 
                    AND comment_reactions.user_id = %s 
                    AND comment_reactions.reaction_type = %s
                RETURNING *
            """, (comment_id, request.user_id, reaction_type, comment_id, request.user_id, reaction_type))
            
            result = cur.fetchone()
            conn.commit()
            
            action = 'added' if result else 'removed'
            
            return jsonify({
                'success': True,
                'action': action
            }), 200
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============= REQUEST SHARING =============

@collaboration_bp.route('/api/requests/<int:request_id>/share', methods=['POST'])
@token_required
def share_request(request_id):
    """Share a request with another user"""
    try:
        data = request.get_json()
        shared_with_id = data.get('user_id')
        permission_level = data.get('permission_level', 'view')
        message = data.get('message', '')
        expires_days = data.get('expires_days')
        
        if not shared_with_id:
            return jsonify({'error': 'User ID required'}), 400
        
        if permission_level not in ['view', 'edit', 'admin']:
            return jsonify({'error': 'Invalid permission level'}), 400
        
        conn = get_db_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            # Check if user owns the request or has admin rights
            cur.execute("""
                SELECT user_id FROM requests WHERE id = %s
            """, (request_id,))
            
            req = cur.fetchone()
            if not req or (req['user_id'] != request.user_id and request.role != 'admin'):
                return jsonify({'error': 'Can only share your own requests'}), 403
            
            # Calculate expiration
            expires_at = None
            if expires_days:
                cur.execute("SELECT CURRENT_TIMESTAMP + INTERVAL '%s days' as expires", (expires_days,))
                expires_at = cur.fetchone()['expires']
            
            # Share request
            cur.execute("""
                INSERT INTO request_shares 
                (request_id, shared_by, shared_with, permission_level, message, expires_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (request_id, shared_by, shared_with) 
                DO UPDATE SET 
                    permission_level = EXCLUDED.permission_level,
                    message = EXCLUDED.message,
                    expires_at = EXCLUDED.expires_at,
                    is_active = TRUE
                RETURNING *
            """, (request_id, request.user_id, shared_with_id, permission_level, message, expires_at))
            
            share = cur.fetchone()
            conn.commit()
            
            return jsonify({
                'success': True,
                'share': dict(share)
            }), 201
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@collaboration_bp.route('/api/requests/<int:request_id>/shares', methods=['GET'])
@token_required
def get_request_shares(request_id):
    """Get all shares for a request"""
    try:
        conn = get_db_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("""
                SELECT * FROM shared_requests_view
                WHERE request_id = %s
            """, (request_id,))
            
            shares = cur.fetchall()
            
            return jsonify({
                'shares': [dict(s) for s in shares],
                'count': len(shares)
            }), 200
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@collaboration_bp.route('/api/shares/<int:share_id>', methods=['DELETE'])
@token_required
def revoke_share(share_id):
    """Revoke a request share"""
    try:
        conn = get_db_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            # Check ownership
            cur.execute("""
                SELECT * FROM request_shares WHERE id = %s
            """, (share_id,))
            
            share = cur.fetchone()
            if not share:
                return jsonify({'error': 'Share not found'}), 404
            
            if share['shared_by'] != request.user_id and request.role != 'admin':
                return jsonify({'error': 'Can only revoke your own shares'}), 403
            
            # Deactivate share
            cur.execute("""
                UPDATE request_shares
                SET is_active = FALSE
                WHERE id = %s
            """, (share_id,))
            
            conn.commit()
            
            return jsonify({'success': True}), 200
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============= TEAM REQUESTS =============

@collaboration_bp.route('/api/requests/<int:request_id>/team', methods=['POST'])
@token_required
def add_team_member(request_id):
    """Add a user to a team request"""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        role = data.get('role', 'member')
        
        if not user_id:
            return jsonify({'error': 'User ID required'}), 400
        
        if role not in ['owner', 'member', 'viewer']:
            return jsonify({'error': 'Invalid role'}), 400
        
        conn = get_db_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            # Check permissions
            cur.execute("""
                SELECT get_user_request_permission(%s, %s) as permission
            """, (request.user_id, request_id))
            
            permission = cur.fetchone()['permission']
            if permission not in ['owner', 'admin']:
                return jsonify({'error': 'Only request owner can add team members'}), 403
            
            # Add team member
            cur.execute("""
                INSERT INTO team_requests (request_id, user_id, role, added_by)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (request_id, user_id)
                DO UPDATE SET 
                    role = EXCLUDED.role,
                    is_active = TRUE,
                    removed_at = NULL
                RETURNING *
            """, (request_id, user_id, role, request.user_id))
            
            team_member = cur.fetchone()
            conn.commit()
            
            return jsonify({
                'success': True,
                'team_member': dict(team_member)
            }), 201
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@collaboration_bp.route('/api/requests/<int:request_id>/team', methods=['GET'])
@token_required
def get_team_members(request_id):
    """Get all team members for a request"""
    try:
        conn = get_db_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("""
                SELECT * FROM team_requests_view
                WHERE request_id = %s
            """, (request_id,))
            
            team = cur.fetchall()
            
            return jsonify({
                'team': [dict(t) for t in team],
                'count': len(team)
            }), 200
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@collaboration_bp.route('/api/team/<int:team_id>', methods=['DELETE'])
@token_required
def remove_team_member(team_id):
    """Remove a team member from a request"""
    try:
        conn = get_db_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            # Check permissions
            cur.execute("""
                SELECT tr.*, get_user_request_permission(%s, tr.request_id) as permission
                FROM team_requests tr
                WHERE tr.id = %s
            """, (request.user_id, team_id))
            
            team_member = cur.fetchone()
            if not team_member:
                return jsonify({'error': 'Team member not found'}), 404
            
            if team_member['permission'] not in ['owner', 'admin'] and team_member['user_id'] != request.user_id:
                return jsonify({'error': 'Insufficient permissions'}), 403
            
            # Remove team member
            cur.execute("""
                UPDATE team_requests
                SET is_active = FALSE, removed_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (team_id,))
            
            conn.commit()
            
            return jsonify({'success': True}), 200
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============= INTERNAL NOTES (Operator/Admin only) =============

@collaboration_bp.route('/api/requests/<int:request_id>/internal-notes', methods=['GET'])
@admin_or_operator_required
def get_internal_notes(request_id):
    """Get internal notes for a request (operators/admins only)"""
    try:
        conn = get_db_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("""
                SELECT * FROM internal_notes_view
                WHERE request_id = %s
            """, (request_id,))
            
            notes = cur.fetchall()
            
            return jsonify({
                'notes': [dict(n) for n in notes],
                'count': len(notes)
            }), 200
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500
