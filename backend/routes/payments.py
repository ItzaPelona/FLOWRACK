"""
Payment Management Routes
Handles payment records, receipts, and debt payment processing
"""

from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from psycopg.rows import dict_row
from functools import wraps
import jwt
import os
from backend.database import get_db_connection

payments_bp = Blueprint('payments', __name__)

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

def admin_required(f):
    """Decorator to require admin role"""
    @wraps(f)
    @token_required
    def decorated(*args, **kwargs):
        if request.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated


@payments_bp.route('/api/payments', methods=['POST'])
@token_required
def create_payment():
    """Create a new payment record"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['debt_id', 'amount', 'payment_method']
        if not all(field in data for field in required_fields):
            return jsonify({'error': 'Missing required fields'}), 400
        
        debt_id = data['debt_id']
        amount = float(data['amount'])
        payment_method = data['payment_method']
        notes = data.get('notes', '')
        
        # Validate payment method
        valid_methods = ['cash', 'card', 'transfer', 'oxxo', 'bank_deposit']
        if payment_method not in valid_methods:
            return jsonify({'error': f'Invalid payment method. Must be one of: {", ".join(valid_methods)}'}), 400
        
        if amount <= 0:
            return jsonify({'error': 'Amount must be greater than 0'}), 400
        
        conn = get_db_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            # Check if debt exists and get details
            cur.execute("""
                SELECT id, user_id, total_amount, amount_paid, payment_status
                FROM debts WHERE id = %s
            """, (debt_id,))
            debt = cur.fetchone()
            
            if not debt:
                return jsonify({'error': 'Debt not found'}), 404
            
            remaining = debt['total_amount'] - debt['amount_paid']
            if amount > remaining:
                return jsonify({'error': f'Payment amount exceeds remaining balance of {remaining:.2f}'}), 400
            
            # Generate receipt number
            cur.execute("""
                SELECT generate_receipt_number('standard'::receipt_type) as receipt_number
            """)
            receipt_number = cur.fetchone()['receipt_number']
            
            # Create payment record
            payment_status = 'completed' if payment_method == 'cash' else 'pending'
            processed_date = datetime.now() if payment_method == 'cash' else None
            processed_by = request.user_id if payment_method == 'cash' else None
            
            cur.execute("""
                INSERT INTO payment_records 
                (debt_id, user_id, amount, payment_method, payment_status, 
                 receipt_number, notes, processed_by, processed_date)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, payment_date, created_at
            """, (debt_id, debt['user_id'], amount, payment_method, payment_status,
                  receipt_number, notes, processed_by, processed_date))
            
            payment = cur.fetchone()
            payment_id = payment['id']
            
            # Create receipt based on payment method
            if payment_method == 'oxxo':
                cur.execute("""
                    SELECT generate_oxxo_barcode() as barcode
                """)
                barcode = cur.fetchone()['barcode']
                
                cur.execute("""
                    SELECT generate_receipt_number('oxxo'::receipt_type) as receipt_number
                """)
                oxxo_receipt_number = cur.fetchone()['receipt_number']
                
                expiration = datetime.now() + timedelta(days=3)
                
                cur.execute("""
                    INSERT INTO payment_receipts 
                    (payment_id, receipt_type, receipt_number, barcode_data, 
                     amount, expiration_date, instructions)
                    VALUES (%s, 'oxxo', %s, %s, %s, %s, %s)
                    RETURNING id
                """, (payment_id, oxxo_receipt_number, barcode, amount, expiration,
                      'Present this barcode at any OXXO store to complete payment'))
                
            elif payment_method in ['transfer', 'bank_deposit']:
                cur.execute("""
                    SELECT generate_clabe() as clabe
                """)
                clabe = cur.fetchone()['clabe']
                
                cur.execute("""
                    SELECT generate_receipt_number('bank_transfer'::receipt_type) as receipt_number
                """)
                bank_receipt_number = cur.fetchone()['receipt_number']
                
                # Sample bank details
                bank_name = "Banco Ejemplo"
                account_number = "1234567890"
                reference = f"DEBT{debt_id:06d}"
                
                cur.execute("""
                    INSERT INTO payment_receipts 
                    (payment_id, receipt_type, receipt_number, reference_number,
                     bank_name, account_number, clabe, amount, instructions)
                    VALUES (%s, 'bank_transfer', %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (payment_id, bank_receipt_number, reference, bank_name, 
                      account_number, clabe, amount,
                      f'Transfer to {bank_name} using reference: {reference}'))
            
            conn.commit()
            
            # Get updated debt info
            cur.execute("""
                SELECT * FROM payment_summary WHERE debt_id = %s
            """, (debt_id,))
            debt_summary = cur.fetchone()
            
            return jsonify({
                'success': True,
                'payment': {
                    'id': payment_id,
                    'receipt_number': receipt_number,
                    'amount': amount,
                    'payment_method': payment_method,
                    'payment_status': payment_status,
                    'payment_date': payment['payment_date'].isoformat() if payment['payment_date'] else None
                },
                'debt_summary': dict(debt_summary) if debt_summary else None
            }), 201
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@payments_bp.route('/api/payments/<int:debt_id>', methods=['GET'])
@token_required
def get_debt_payments(debt_id):
    """Get all payments for a specific debt"""
    try:
        conn = get_db_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("""
                SELECT 
                    pr.*,
                    u.username as processed_by_name
                FROM payment_records pr
                LEFT JOIN users u ON pr.processed_by = u.id
                WHERE pr.debt_id = %s
                ORDER BY pr.payment_date DESC
            """, (debt_id,))
            
            payments = cur.fetchall()
            
            # Get payment summary
            cur.execute("""
                SELECT * FROM payment_summary WHERE debt_id = %s
            """, (debt_id,))
            summary = cur.fetchone()
            
            return jsonify({
                'payments': [dict(p) for p in payments],
                'summary': dict(summary) if summary else None
            }), 200
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@payments_bp.route('/api/payments/record/<int:payment_id>', methods=['GET'])
@token_required
def get_payment(payment_id):
    """Get a specific payment record"""
    try:
        conn = get_db_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("""
                SELECT 
                    pr.*,
                    u.username,
                    d.total_amount as debt_total,
                    p.name as product_name
                FROM payment_records pr
                JOIN users u ON pr.user_id = u.id
                JOIN debts d ON pr.debt_id = d.id
                LEFT JOIN products p ON d.product_id = p.id
                WHERE pr.id = %s
            """, (payment_id,))
            
            payment = cur.fetchone()
            if not payment:
                return jsonify({'error': 'Payment not found'}), 404
            
            return jsonify(dict(payment)), 200
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@payments_bp.route('/api/payments/record/<int:payment_id>', methods=['PUT'])
@admin_required
def update_payment_status(payment_id):
    """Update payment status (admin only)"""
    try:
        data = request.get_json()
        new_status = data.get('status')
        
        valid_statuses = ['pending', 'processing', 'completed', 'failed', 'cancelled']
        if new_status not in valid_statuses:
            return jsonify({'error': f'Invalid status. Must be one of: {", ".join(valid_statuses)}'}), 400
        
        conn = get_db_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            # Update payment status
            cur.execute("""
                UPDATE payment_records
                SET payment_status = %s,
                    processed_by = %s,
                    processed_date = CASE WHEN %s = 'completed' THEN CURRENT_TIMESTAMP ELSE processed_date END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                RETURNING *
            """, (new_status, request.user_id, new_status, payment_id))
            
            payment = cur.fetchone()
            if not payment:
                return jsonify({'error': 'Payment not found'}), 404
            
            conn.commit()
            
            return jsonify({
                'success': True,
                'payment': dict(payment)
            }), 200
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@payments_bp.route('/api/payments/<int:payment_id>/receipt', methods=['GET'])
@token_required
def get_payment_receipt(payment_id):
    """Get receipt information for a payment"""
    try:
        conn = get_db_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("""
                SELECT 
                    pr.*,
                    prec.*,
                    p.amount as payment_amount,
                    p.payment_method,
                    p.receipt_number as payment_receipt_number,
                    u.username,
                    u.email,
                    d.total_amount as debt_total
                FROM payment_records p
                LEFT JOIN payment_receipts prec ON p.id = prec.payment_id
                JOIN users u ON p.user_id = u.id
                JOIN debts d ON p.debt_id = d.id
                WHERE p.id = %s
            """, (payment_id,))
            
            receipt = cur.fetchone()
            if not receipt:
                return jsonify({'error': 'Receipt not found'}), 404
            
            return jsonify(dict(receipt)), 200
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@payments_bp.route('/api/debts/aging', methods=['GET'])
@token_required
def get_aging_report():
    """Get debt aging report"""
    try:
        conn = get_db_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            # Get aging report
            cur.execute("""
                SELECT * FROM debt_aging_report
                ORDER BY days_overdue DESC, total_amount DESC
            """)
            aging_data = cur.fetchall()
            
            # Get summary by aging category
            cur.execute("""
                SELECT 
                    aging_category,
                    COUNT(*) as debt_count,
                    SUM(balance) as total_balance,
                    AVG(days_overdue) as avg_days_overdue
                FROM debt_aging_report
                GROUP BY aging_category
                ORDER BY 
                    CASE aging_category
                        WHEN 'Current' THEN 1
                        WHEN '1-30 Days' THEN 2
                        WHEN '31-60 Days' THEN 3
                        WHEN '61-90 Days' THEN 4
                        WHEN '90+ Days' THEN 5
                        WHEN 'Paid' THEN 6
                        ELSE 7
                    END
            """)
            summary = cur.fetchall()
            
            # Get total overdue amount
            cur.execute("""
                SELECT 
                    COUNT(*) as total_overdue_count,
                    COALESCE(SUM(balance), 0) as total_overdue_amount
                FROM debt_aging_report
                WHERE aging_category NOT IN ('Current', 'Paid', 'No Due Date')
            """)
            totals = cur.fetchone()
            
            return jsonify({
                'aging_data': [dict(row) for row in aging_data],
                'summary': [dict(row) for row in summary],
                'totals': dict(totals)
            }), 200
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@payments_bp.route('/api/debts/overdue', methods=['GET'])
@token_required
def get_overdue_debts():
    """Get all overdue debts"""
    try:
        conn = get_db_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("""
                SELECT * FROM overdue_debts
            """)
            
            overdue = cur.fetchall()
            
            return jsonify({
                'overdue_debts': [dict(row) for row in overdue],
                'count': len(overdue)
            }), 200
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@payments_bp.route('/api/payments/methods', methods=['GET'])
def get_payment_methods():
    """Get available payment methods"""
    return jsonify({
        'payment_methods': [
            {
                'id': 'cash',
                'name': 'Cash',
                'description': 'Pay in cash at the warehouse',
                'requires_receipt': False,
                'processing_time': 'Immediate'
            },
            {
                'id': 'card',
                'name': 'Credit/Debit Card',
                'description': 'Pay with credit or debit card',
                'requires_receipt': False,
                'processing_time': 'Immediate'
            },
            {
                'id': 'transfer',
                'name': 'Bank Transfer',
                'description': 'Transfer to company bank account',
                'requires_receipt': True,
                'processing_time': '1-2 business days'
            },
            {
                'id': 'oxxo',
                'name': 'OXXO Pay',
                'description': 'Pay at any OXXO store',
                'requires_receipt': True,
                'processing_time': 'Up to 48 hours'
            },
            {
                'id': 'bank_deposit',
                'name': 'Bank Deposit',
                'description': 'Deposit directly to bank account',
                'requires_receipt': True,
                'processing_time': '1-2 business days'
            }
        ]
    }), 200


@payments_bp.route('/api/payments/stats', methods=['GET'])
@admin_required
def get_payment_stats():
    """Get payment statistics (admin only)"""
    try:
        conn = get_db_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            # Total payments by method
            cur.execute("""
                SELECT 
                    payment_method,
                    COUNT(*) as count,
                    SUM(amount) as total_amount,
                    AVG(amount) as avg_amount
                FROM payment_records
                WHERE payment_status = 'completed'
                GROUP BY payment_method
                ORDER BY total_amount DESC
            """)
            by_method = cur.fetchall()
            
            # Payments by status
            cur.execute("""
                SELECT 
                    payment_status,
                    COUNT(*) as count,
                    SUM(amount) as total_amount
                FROM payment_records
                GROUP BY payment_status
            """)
            by_status = cur.fetchall()
            
            # Recent payments
            cur.execute("""
                SELECT 
                    pr.*,
                    u.username,
                    d.total_amount as debt_total
                FROM payment_records pr
                JOIN users u ON pr.user_id = u.id
                JOIN debts d ON pr.debt_id = d.id
                ORDER BY pr.payment_date DESC
                LIMIT 10
            """)
            recent = cur.fetchall()
            
            # Monthly totals
            cur.execute("""
                SELECT 
                    TO_CHAR(payment_date, 'YYYY-MM') as month,
                    COUNT(*) as payment_count,
                    SUM(amount) as total_amount
                FROM payment_records
                WHERE payment_status = 'completed'
                    AND payment_date >= CURRENT_DATE - INTERVAL '12 months'
                GROUP BY TO_CHAR(payment_date, 'YYYY-MM')
                ORDER BY month DESC
            """)
            monthly = cur.fetchall()
            
            return jsonify({
                'by_method': [dict(row) for row in by_method],
                'by_status': [dict(row) for row in by_status],
                'recent_payments': [dict(row) for row in recent],
                'monthly_totals': [dict(row) for row in monthly]
            }), 200
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500
