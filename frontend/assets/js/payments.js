/**
 * Payment Management System
 * Handles payment creation, tracking, receipts, and aging reports
 */

let selectedDebt = null;
let selectedPaymentMethod = null;
let paymentMethods = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    loadPaymentMethods();
    loadDebts();
    
    // Set up form submission
    document.getElementById('paymentForm').addEventListener('submit', createPayment);
    
    // Set up debt selection
    document.getElementById('debtSelect').addEventListener('change', handleDebtSelection);
    
    // Load data for other tabs when they're shown
    document.getElementById('payment-history-tab').addEventListener('shown.bs.tab', loadAllPayments);
    document.getElementById('aging-report-tab').addEventListener('shown.bs.tab', loadAgingReport);
    document.getElementById('overdue-tab').addEventListener('shown.bs.tab', loadOverdueDebts);
});

// Load available payment methods
async function loadPaymentMethods() {
    try {
        const response = await fetch('/api/payments/methods');
        const data = await response.json();
        
        paymentMethods = data.payment_methods;
        displayPaymentMethods();
        displayPaymentMethodsInfo();
    } catch (error) {
        console.error('Error loading payment methods:', error);
    }
}

// Display payment method cards
function displayPaymentMethods() {
    const container = document.getElementById('paymentMethods');
    container.innerHTML = '';
    
    paymentMethods.forEach(method => {
        const icon = {
            'cash': 'cash-coin',
            'card': 'credit-card',
            'transfer': 'bank',
            'oxxo': 'shop',
            'bank_deposit': 'building'
        }[method.id] || 'cash';
        
        const card = document.createElement('div');
        card.className = 'col-6';
        card.innerHTML = `
            <div class="payment-method-card card text-center p-3" data-method="${method.id}">
                <i class="bi bi-${icon} fs-1 mb-2"></i>
                <h6>${method.name}</h6>
                <small class="text-muted">${method.processing_time}</small>
            </div>
        `;
        
        card.querySelector('.payment-method-card').addEventListener('click', () => selectPaymentMethod(method.id));
        container.appendChild(card);
    });
}

// Display payment methods info
function displayPaymentMethodsInfo() {
    const container = document.getElementById('paymentMethodsInfo');
    container.innerHTML = paymentMethods.map(method => `
        <div class="mb-3">
            <h6><i class="bi bi-${getMethodIcon(method.id)}"></i> ${method.name}</h6>
            <p class="text-muted small mb-1">${method.description}</p>
            <small><strong>Processing:</strong> ${method.processing_time}</small>
        </div>
        <hr>
    `).join('');
}

// Get icon for payment method
function getMethodIcon(methodId) {
    const icons = {
        'cash': 'cash-coin',
        'card': 'credit-card',
        'transfer': 'bank',
        'oxxo': 'shop',
        'bank_deposit': 'building'
    };
    return icons[methodId] || 'cash';
}

// Select payment method
function selectPaymentMethod(methodId) {
    selectedPaymentMethod = methodId;
    
    // Update UI
    document.querySelectorAll('.payment-method-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    document.querySelector(`[data-method="${methodId}"]`)?.classList.add('selected');
}

// Load pending debts
async function loadDebts() {
    try {
        const response = await apiRequest('/api/debts');
        const debts = response.debts || [];
        
        // Filter for debts that aren't fully paid
        const pendingDebts = debts.filter(debt => 
            debt.payment_status !== 'paid' && 
            (debt.total_amount - (debt.amount_paid || 0)) > 0
        );
        
        const select = document.getElementById('debtSelect');
        select.innerHTML = '<option value="">Select a debt...</option>';
        
        pendingDebts.forEach(debt => {
            const remaining = debt.total_amount - (debt.amount_paid || 0);
            const option = document.createElement('option');
            option.value = debt.id;
            option.textContent = `Debt #${debt.id} - ${debt.username} - $${remaining.toFixed(2)} remaining`;
            option.dataset.debt = JSON.stringify(debt);
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading debts:', error);
        showAlert('Error loading debts', 'danger');
    }
}

// Handle debt selection
function handleDebtSelection(e) {
    const select = e.target;
    const option = select.options[select.selectedIndex];
    
    if (!option.dataset.debt) {
        selectedDebt = null;
        document.getElementById('debtDetails').classList.add('d-none');
        document.getElementById('remainingBalance').textContent = '';
        return;
    }
    
    selectedDebt = JSON.parse(option.dataset.debt);
    const remaining = selectedDebt.total_amount - (selectedDebt.amount_paid || 0);
    
    // Show debt details
    const detailsDiv = document.getElementById('debtDetails');
    detailsDiv.innerHTML = `
        <strong>Debt Details:</strong><br>
        User: ${selectedDebt.username}<br>
        Product: ${selectedDebt.product_name || 'N/A'}<br>
        Total Amount: $${selectedDebt.total_amount.toFixed(2)}<br>
        Paid: $${(selectedDebt.amount_paid || 0).toFixed(2)}<br>
        <strong>Remaining: $${remaining.toFixed(2)}</strong>
    `;
    detailsDiv.classList.remove('d-none');
    
    // Set max payment amount
    document.getElementById('paymentAmount').max = remaining;
    document.getElementById('paymentAmount').value = remaining.toFixed(2);
    document.getElementById('remainingBalance').textContent = `Remaining balance: $${remaining.toFixed(2)}`;
}

// Create payment
async function createPayment(e) {
    e.preventDefault();
    
    if (!selectedDebt) {
        showAlert('Please select a debt', 'warning');
        return;
    }
    
    if (!selectedPaymentMethod) {
        showAlert('Please select a payment method', 'warning');
        return;
    }
    
    const amount = parseFloat(document.getElementById('paymentAmount').value);
    const notes = document.getElementById('paymentNotes').value;
    
    try {
        const response = await apiRequest('/api/payments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                debt_id: selectedDebt.id,
                amount: amount,
                payment_method: selectedPaymentMethod,
                notes: notes
            })
        });
        
        showAlert('Payment created successfully!', 'success');
        
        // Show receipt if applicable
        if (['oxxo', 'transfer', 'bank_deposit'].includes(selectedPaymentMethod)) {
            showReceipt(response.payment.id);
        }
        
        // Reset form
        document.getElementById('paymentForm').reset();
        selectedDebt = null;
        selectedPaymentMethod = null;
        document.querySelectorAll('.payment-method-card').forEach(card => {
            card.classList.remove('selected');
        });
        document.getElementById('debtDetails').classList.add('d-none');
        
        // Reload debts
        loadDebts();
        
    } catch (error) {
        console.error('Error creating payment:', error);
        showAlert(error.message || 'Error creating payment', 'danger');
    }
}

// Show receipt
async function showReceipt(paymentId) {
    try {
        const response = await apiRequest(`/api/payments/${paymentId}/receipt`);
        
        const modal = new bootstrap.Modal(document.getElementById('receiptModal'));
        const content = document.getElementById('receiptContent');
        
        if (response.receipt_type === 'oxxo') {
            content.innerHTML = generateOxxoReceipt(response);
        } else if (response.receipt_type === 'bank_transfer') {
            content.innerHTML = generateBankReceipt(response);
        } else {
            content.innerHTML = generateStandardReceipt(response);
        }
        
        modal.show();
    } catch (error) {
        console.error('Error loading receipt:', error);
    }
}

// Generate OXXO receipt
function generateOxxoReceipt(data) {
    return `
        <div class="receipt-container text-center">
            <h3><i class="bi bi-shop"></i> OXXO Pay</h3>
            <hr>
            <p><strong>Receipt Number:</strong> ${data.receipt_number}</p>
            <p><strong>Amount to Pay:</strong> <span class="fs-4 text-primary">$${data.amount.toFixed(2)}</span></p>
            <p><strong>Reference:</strong> ${data.reference_number}</p>
            
            <div class="my-4">
                <p class="text-muted">Present this barcode at any OXXO store</p>
                <div class="barcode mx-auto" style="max-width: 400px;">
                    ${data.barcode_data}
                </div>
            </div>
            
            <div class="alert alert-warning">
                <i class="bi bi-clock"></i> <strong>Valid until:</strong> ${formatDate(data.expiration_date)}
            </div>
            
            <p class="text-muted small">${data.instructions}</p>
        </div>
    `;
}

// Generate bank transfer receipt
function generateBankReceipt(data) {
    return `
        <div class="receipt-container">
            <h3><i class="bi bi-bank"></i> Bank Transfer Details</h3>
            <hr>
            <div class="row">
                <div class="col-md-6">
                    <p><strong>Receipt Number:</strong><br>${data.receipt_number}</p>
                    <p><strong>Amount to Transfer:</strong><br><span class="fs-4 text-primary">$${data.amount.toFixed(2)}</span></p>
                </div>
                <div class="col-md-6">
                    <p><strong>Bank:</strong><br>${data.bank_name}</p>
                    <p><strong>Account Number:</strong><br>${data.account_number}</p>
                </div>
            </div>
            
            <div class="alert alert-info">
                <p class="mb-2"><strong>CLABE (Interbank Key):</strong></p>
                <p class="clabe-input fs-5 text-center mb-0">${data.clabe}</p>
            </div>
            
            <div class="alert alert-warning">
                <strong><i class="bi bi-info-circle"></i> Reference Number:</strong> ${data.reference_number}
                <p class="mb-0 mt-2 small">Include this reference in your transfer to ensure proper credit</p>
            </div>
            
            <p class="text-muted small">${data.instructions}</p>
        </div>
    `;
}

// Generate standard receipt
function generateStandardReceipt(data) {
    return `
        <div class="receipt-container">
            <h3><i class="bi bi-receipt"></i> Payment Receipt</h3>
            <hr>
            <p><strong>Receipt Number:</strong> ${data.payment_receipt_number}</p>
            <p><strong>Payment Method:</strong> ${data.payment_method.toUpperCase()}</p>
            <p><strong>Amount:</strong> $${data.payment_amount.toFixed(2)}</p>
            <p><strong>User:</strong> ${data.username}</p>
            <p><strong>Email:</strong> ${data.email}</p>
            <hr>
            <p class="text-center text-success"><i class="bi bi-check-circle"></i> Payment Completed</p>
        </div>
    `;
}

// Load all payments
async function loadAllPayments() {
    try {
        // This would need a backend endpoint to get all payments
        // For now, show a placeholder
        const tbody = document.querySelector('#paymentsTable tbody');
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">Payment history coming soon...</td></tr>';
    } catch (error) {
        console.error('Error loading payments:', error);
    }
}

// Load aging report
async function loadAgingReport() {
    try {
        const response = await apiRequest('/api/debts/aging');
        
        displayAgingSummary(response.summary, response.totals);
        displayAgingTable(response.aging_data);
    } catch (error) {
        console.error('Error loading aging report:', error);
        showAlert('Error loading aging report', 'danger');
    }
}

// Display aging summary cards
function displayAgingSummary(summary, totals) {
    const container = document.getElementById('agingSummaryCards');
    container.innerHTML = '';
    
    summary.forEach(category => {
        const card = document.createElement('div');
        card.className = 'col-12 mb-3';
        card.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <h6 class="card-title">${category.aging_category}</h6>
                    <p class="mb-1"><strong>${category.debt_count}</strong> debts</p>
                    <p class="mb-0 text-success"><strong>$${parseFloat(category.total_balance || 0).toFixed(2)}</strong></p>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
    
    // Add totals card
    const totalsCard = document.createElement('div');
    totalsCard.className = 'col-12 mb-3';
    totalsCard.innerHTML = `
        <div class="card bg-danger text-white">
            <div class="card-body">
                <h6 class="card-title">Total Overdue</h6>
                <p class="mb-1"><strong>${totals.total_overdue_count}</strong> debts</p>
                <p class="mb-0"><strong>$${parseFloat(totals.total_overdue_amount || 0).toFixed(2)}</strong></p>
            </div>
        </div>
    `;
    container.appendChild(totalsCard);
}

// Display aging table
function displayAgingTable(data) {
    const tbody = document.querySelector('#agingTable tbody');
    tbody.innerHTML = '';
    
    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.id}</td>
            <td>${row.username}</td>
            <td>${row.product_name || 'N/A'}</td>
            <td>$${parseFloat(row.total_amount).toFixed(2)}</td>
            <td>$${parseFloat(row.balance).toFixed(2)}</td>
            <td>${row.payment_due_date ? formatDate(row.payment_due_date) : 'N/A'}</td>
            <td>${row.days_overdue}</td>
            <td><span class="badge aging-badge ${getAgingClass(row.aging_category)}">${row.aging_category}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

// Get aging class for styling
function getAgingClass(category) {
    const classes = {
        'Current': 'aging-current',
        '1-30 Days': 'aging-1-30',
        '31-60 Days': 'aging-31-60',
        '61-90 Days': 'aging-61-90',
        '90+ Days': 'aging-90-plus'
    };
    return classes[category] || '';
}

// Load overdue debts
async function loadOverdueDebts() {
    try {
        const response = await apiRequest('/api/debts/overdue');
        
        const tbody = document.querySelector('#overdueTable tbody');
        tbody.innerHTML = '';
        
        response.overdue_debts.forEach(debt => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${debt.id}</td>
                <td>${debt.username}</td>
                <td>${debt.email}</td>
                <td>${debt.product_name || 'N/A'}</td>
                <td class="text-danger">$${parseFloat(debt.balance).toFixed(2)}</td>
                <td>${formatDate(debt.payment_due_date)}</td>
                <td><span class="badge bg-danger">${debt.days_overdue} days</span></td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="createPaymentForDebt(${debt.id})">
                        <i class="bi bi-cash"></i> Pay
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        
        if (response.overdue_debts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-success">No overdue debts! 🎉</td></tr>';
        }
    } catch (error) {
        console.error('Error loading overdue debts:', error);
        showAlert('Error loading overdue debts', 'danger');
    }
}

// Create payment for specific debt
function createPaymentForDebt(debtId) {
    // Switch to new payment tab
    const tab = new bootstrap.Tab(document.getElementById('new-payment-tab'));
    tab.show();
    
    // Select the debt
    document.getElementById('debtSelect').value = debtId;
    document.getElementById('debtSelect').dispatchEvent(new Event('change'));
}

// Print receipt
function printReceipt() {
    const content = document.getElementById('receiptContent').innerHTML;
    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write('<html><head><title>Receipt</title>');
    printWindow.document.write('<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">');
    printWindow.document.write('<style>.receipt-container { margin: 20px; } .barcode { font-family: monospace; font-size: 24px; }</style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write(content);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.print();
}

// Format date
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

// Show alert
function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
    alertDiv.style.zIndex = '9999';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alertDiv);
    
    setTimeout(() => alertDiv.remove(), 5000);
}

// API request helper (should match your existing auth.js)
async function apiRequest(url, options = {}) {
    const token = localStorage.getItem('flowrack_token');
    if (!token) {
        window.location.href = 'index.html';
        throw new Error('Not authenticated');
    }
    
    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };
    
    const response = await fetch(url, { ...defaultOptions, ...options });
    
    if (response.status === 401) {
        localStorage.removeItem('flowrack_token');
        window.location.href = 'index.html';
        throw new Error('Session expired');
    }
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Request failed');
    }
    
    return response.json();
}

// Check authentication
function checkAuth() {
    const token = localStorage.getItem('flowrack_token');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }
    
    // Display user info
    const user = JSON.parse(localStorage.getItem('flowrack_user') || '{}');
    document.getElementById('userDisplay').textContent = user.username || 'User';
}
