/**
 * FlowRack Main Application JavaScript
 * Handles application initialization, routing, and main functionality
 */

// Application state
const App = {
    currentUser: null,
    currentView: 'login',
    socket: null,
    isOnline: navigator.onLine,
    
    // Initialize the application
    init() {
        console.log('FlowRack App initializing...');
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Initialize WebSocket connection
        this.initSocket();
        
        // Check for saved authentication
        this.checkAuth();
        
        // Handle URL parameters
        this.handleURLParams();
        
        // Hide loading screen
        setTimeout(() => {
            document.getElementById('loading-screen').style.display = 'none';
        }, 1500);
    },
    
    // Setup event listeners
    setupEventListeners() {
        // Login form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', this.handleLogin.bind(this));
        }
        
        // Online/offline status
        window.addEventListener('online', this.handleOnline.bind(this));
        window.addEventListener('offline', this.handleOffline.bind(this));
        
        // Navigation clicks
        document.addEventListener('click', (e) => {
            if (e.target.hasAttribute('data-view')) {
                e.preventDefault();
                this.showView(e.target.getAttribute('data-view'));
            }
        });
        
        // Form submissions
        document.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFormSubmit(e);
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyboard.bind(this));
    },
    
    // Initialize WebSocket connection
    initSocket() {
        if (typeof io !== 'undefined') {
            this.socket = io();
            
            this.socket.on('connect', () => {
                console.log('WebSocket connected');
                this.showNotification('Connected to real-time updates', 'success');
            });
            
            this.socket.on('disconnect', () => {
                console.log('WebSocket disconnected');
                this.showNotification('Disconnected from real-time updates', 'warning');
            });
            
            // Listen for real-time updates
            this.socket.on('request_created', (data) => {
                this.handleRequestUpdate(data);
            });
            
            this.socket.on('delivery_updated', (data) => {
                this.handleDeliveryUpdate(data);
            });
            
            this.socket.on('debt_created', (data) => {
                this.handleDebtUpdate(data);
            });
        }
    },
    
    // Check for existing authentication
    async checkAuth() {
        const token = localStorage.getItem('flowrack_token');
        
        if (token) {
            try {
                const response = await API.verifyToken();
                if (response.valid) {
                    this.currentUser = response.user;
                    this.showAuthenticatedView();
                } else {
                    this.logout();
                }
            } catch (error) {
                console.error('Auth check failed:', error);
                this.logout();
            }
        } else {
            this.showView('login');
        }
    },
    
    // Handle URL parameters
    handleURLParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const action = urlParams.get('action');
        
        if (action && this.currentUser) {
            this.showView(action);
        }
    },
    
    // Handle login form submission
    async handleLogin(e) {
        e.preventDefault();
        
        const registrationNumber = document.getElementById('registration-number').value;
        const password = document.getElementById('password').value;
        
        if (!registrationNumber || !password) {
            this.showNotification('Please enter both registration number and password', 'error');
            return;
        }
        
        try {
            // Show loading
            const submitBtn = e.target.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Logging in...';
            submitBtn.disabled = true;
            
            const response = await API.login(registrationNumber, password);
            
            if (response.access_token) {
                localStorage.setItem('flowrack_token', response.access_token);
                this.currentUser = response.user;
                this.showAuthenticatedView();
                this.showNotification('Login successful!', 'success');
            }
        } catch (error) {
            console.error('Login failed:', error);
            this.showNotification('Login failed. Please check your credentials.', 'error');
        } finally {
            // Reset button
            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.innerHTML = '<i class="bi bi-box-arrow-in-right"></i> Login';
            submitBtn.disabled = false;
        }
    },
    
    // Show authenticated view
    showAuthenticatedView() {
        if (!this.currentUser) return;
        
        // Update UI based on user role
        document.body.className = `role-${this.currentUser.role}`;
        
        // Show navigation
        document.getElementById('main-navbar').style.display = 'block';
        
        // Update user name in navigation
        document.getElementById('user-name').textContent = this.currentUser.first_name;
        
        // Show appropriate view
        this.showView('dashboard');
        
        // Load dashboard data
        this.loadDashboardData();
    },
    
    // Show specific view
    showView(viewName) {
        console.log('Showing view:', viewName);
        
        // Hide all views
        const views = document.querySelectorAll('.view-container, #login-view');
        views.forEach(view => view.style.display = 'none');
        
        // Show loading for dynamic views
        const dynamicContent = document.getElementById('dynamic-content');
        
        switch (viewName) {
            case 'login':
                document.getElementById('login-view').style.display = 'flex';
                document.getElementById('main-navbar').style.display = 'none';
                break;
                
            case 'dashboard':
                document.getElementById('dashboard-view').style.display = 'block';
                this.loadDashboardData();
                break;
                
            case 'requests':
                dynamicContent.style.display = 'block';
                this.loadRequestsView();
                break;
                
            case 'new-request':
                dynamicContent.style.display = 'block';
                this.loadNewRequestView();
                break;
                
            case 'inventory':
                dynamicContent.style.display = 'block';
                this.loadInventoryView();
                break;
                
            case 'debts':
                dynamicContent.style.display = 'block';
                this.loadDebtsView();
                break;
                
            case 'profile':
                dynamicContent.style.display = 'block';
                this.loadProfileView();
                break;
                
            case 'deliveries':
                dynamicContent.style.display = 'block';
                this.loadDeliveriesView();
                break;
        }
        
        this.currentView = viewName;
        
        // Update active navigation item
        this.updateActiveNavigation(viewName);
        
        // Update URL without page reload
        if (viewName !== 'login') {
            window.history.pushState({view: viewName}, '', `?action=${viewName}`);
        }
    },
    
    // Update active navigation item
    updateActiveNavigation(viewName) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        const activeLink = document.querySelector(`[onclick="showView('${viewName}')"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
    },
    
    // Load dashboard data
    async loadDashboardData() {
        try {
            if (this.currentUser.role === 'user') {
                await this.loadUserDashboard();
            } else {
                await this.loadOperatorDashboard();
            }
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            this.showNotification('Failed to load dashboard data', 'error');
        }
    },
    
    // Load user dashboard
    async loadUserDashboard() {
        try {
            const profile = await API.getProfile();
            
            if (profile.statistics) {
                const stats = profile.statistics;
                
                document.getElementById('user-total-requests').textContent = stats.requests.total_requests || 0;
                document.getElementById('user-pending-requests').textContent = stats.requests.pending_requests || 0;
                document.getElementById('user-active-requests').textContent = stats.requests.active_requests || 0;
                document.getElementById('user-total-debts').textContent = `$${(stats.debts.total_amount || 0).toFixed(2)}`;
            }
            
            // Load recent activity
            await this.loadRecentActivity();
            
        } catch (error) {
            console.error('Failed to load user dashboard:', error);
        }
    },
    
    // Load operator dashboard
    async loadOperatorDashboard() {
        try {
            const dashboardData = await API.getDashboard();
            
            document.getElementById('today-deliveries').textContent = dashboardData.today_deliveries || 0;
            document.getElementById('low-stock-products').textContent = dashboardData.low_stock_products || 0;
            document.getElementById('active-users').textContent = dashboardData.active_users || 0;
            document.getElementById('total-debts').textContent = `$${(dashboardData.total_debts || 0).toFixed(2)}`;
            
            // Load recent activity
            await this.loadRecentActivity();
            
        } catch (error) {
            console.error('Failed to load operator dashboard:', error);
        }
    },
    
    // Load recent activity
    async loadRecentActivity() {
        try {
            const activities = await API.getRecentActivity();
            const container = document.getElementById('recent-activity');
            
            if (activities && activities.length > 0) {
                container.innerHTML = activities.map(activity => `
                    <div class="activity-item">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <h6 class="mb-1">${activity.title}</h6>
                                <p class="mb-1 text-muted">${activity.description}</p>
                                <small class="text-muted">${Utils.formatDateTime(activity.created_at)}</small>
                            </div>
                            <span class="badge bg-${activity.type}">${activity.status}</span>
                        </div>
                    </div>
                `).join('');
            } else {
                container.innerHTML = `
                    <div class="text-center text-muted">
                        <i class="bi bi-clock-history display-6"></i>
                        <p>No recent activity</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Failed to load recent activity:', error);
        }
    },
    
    // Handle form submissions
    async handleFormSubmit(e) {
        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);
        
        // Handle different form types
        const formType = form.getAttribute('data-form-type');
        
        switch (formType) {
            case 'new-request':
                await this.handleNewRequestSubmit(data);
                break;
                
            case 'update-stock':
                await this.handleStockUpdate(data);
                break;
                
            case 'create-product':
                await this.handleProductCreate(data);
                break;
        }
    },
    
    // Handle keyboard shortcuts
    handleKeyboard(e) {
        // Ctrl/Cmd + K for search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            // Implement global search
        }
        
        // Escape to close modals
        if (e.key === 'Escape') {
            const modals = document.querySelectorAll('.modal.show');
            modals.forEach(modal => {
                const bsModal = bootstrap.Modal.getInstance(modal);
                if (bsModal) bsModal.hide();
            });
        }
    },
    
    // Handle online status
    handleOnline() {
        this.isOnline = true;
        document.getElementById('offline-indicator').style.display = 'none';
        this.showNotification('Connection restored', 'success');
        
        // Sync any pending offline data
        this.syncOfflineData();
    },
    
    // Handle offline status
    handleOffline() {
        this.isOnline = false;
        document.getElementById('offline-indicator').style.display = 'block';
        this.showNotification('You are now offline', 'warning');
    },
    
    // Sync offline data
    syncOfflineData() {
        // Implementation for syncing offline changes
        console.log('Syncing offline data...');
    },
    
    // Handle WebSocket updates
    handleRequestUpdate(data) {
        console.log('Request update:', data);
        if (this.currentView === 'requests' || this.currentView === 'dashboard') {
            // Refresh relevant data
            this.loadDashboardData();
        }
    },
    
    handleDeliveryUpdate(data) {
        console.log('Delivery update:', data);
        if (this.currentView === 'deliveries' || this.currentView === 'dashboard') {
            // Refresh relevant data
            this.loadDashboardData();
        }
    },
    
    handleDebtUpdate(data) {
        console.log('Debt update:', data);
        if (this.currentView === 'debts' || this.currentView === 'dashboard') {
            // Refresh relevant data
            this.loadDashboardData();
        }
    },
    
    // Show notification
    showNotification(message, type = 'info') {
        const toast = document.getElementById('notification-toast');
        const toastBody = document.getElementById('toast-message');
        
        // Set message and type
        toastBody.textContent = message;
        toast.className = `toast ${type === 'error' ? 'text-bg-danger' : type === 'success' ? 'text-bg-success' : type === 'warning' ? 'text-bg-warning' : 'text-bg-info'}`;
        
        // Show toast
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
    },
    
    // Logout user
    logout() {
        // Clear authentication
        localStorage.removeItem('flowrack_token');
        this.currentUser = null;
        
        // Reset UI
        document.body.className = '';
        
        // Show login view
        this.showView('login');
        
        // Disconnect WebSocket
        if (this.socket) {
            this.socket.disconnect();
        }
        
        this.showNotification('Logged out successfully', 'info');
    }
};

// Global functions for HTML onclick handlers
function showView(viewName) {
    App.showView(viewName);
}

function logout() {
    App.logout();
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Export for use in other modules
window.App = App;