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
        console.log('Quick Scan available:', typeof this.showQuickScanModal);
        console.log('Deliveries View available:', typeof this.loadDeliveriesView);
        
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
        
        // Register form
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', this.handleRegister.bind(this));
        }
        
        // Show register view link
        const showRegisterLink = document.getElementById('show-register-link');
        if (showRegisterLink) {
            showRegisterLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showRegisterView();
            });
        }
        
        // Show login view link
        const showLoginLink = document.getElementById('show-login-link');
        if (showLoginLink) {
            showLoginLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showLoginView();
            });
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
        const savedUser = localStorage.getItem('flowrack_user');
        
        if (token) {
            // Load user from localStorage first for faster UI display
            if (savedUser) {
                try {
                    this.currentUser = JSON.parse(savedUser);
                } catch (e) {
                    console.error('Failed to parse saved user data:', e);
                }
            }
            
            try {
                const response = await API.verifyToken();
                if (response.valid) {
                    this.currentUser = response.user;
                    // Update localStorage with fresh user data
                    localStorage.setItem('flowrack_user', JSON.stringify(response.user));
                    this.showAuthenticatedView();
                } else {
                    this.logout();
                }
            } catch (error) {
                console.error('Auth check failed:', error);
                // If token verification fails but we have saved user data, show login
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
                localStorage.setItem('flowrack_user', JSON.stringify(response.user));
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
    
    // Handle registration form submission
    async handleRegister(e) {
        e.preventDefault();
        
        const firstName = document.getElementById('reg-first-name').value.trim();
        const lastName = document.getElementById('reg-last-name').value.trim();
        const registrationNumber = document.getElementById('reg-registration-number').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const phone = document.getElementById('reg-phone').value.trim();
        const department = document.getElementById('reg-department').value.trim();
        const password = document.getElementById('reg-password').value;
        const confirmPassword = document.getElementById('reg-confirm-password').value;
        
        // Validate passwords match
        if (password !== confirmPassword) {
            this.showNotification('Passwords do not match', 'error');
            return;
        }
        
        if (password.length < 6) {
            this.showNotification('Password must be at least 6 characters', 'error');
            return;
        }
        
        try {
            // Show loading
            const submitBtn = e.target.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Registering...';
            submitBtn.disabled = true;
            
            const response = await fetch('/api/users/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    first_name: firstName,
                    last_name: lastName,
                    registration_number: registrationNumber,
                    email: email,
                    phone: phone,
                    department: department,
                    password: password
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.showNotification(data.message || 'Registration submitted! Please wait for admin approval.', 'success');
                // Reset form and show login view
                e.target.reset();
                setTimeout(() => {
                    this.showLoginView();
                }, 2000);
            } else {
                this.showNotification(data.error || 'Registration failed. Please try again.', 'error');
            }
        } catch (error) {
            console.error('Registration failed:', error);
            this.showNotification('Registration failed. Please try again.', 'error');
        } finally {
            // Reset button
            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.innerHTML = '<i class="bi bi-person-plus"></i> Register';
            submitBtn.disabled = false;
        }
    },
    
    // Show registration view
    showRegisterView() {
        document.getElementById('login-view').style.display = 'none';
        document.getElementById('register-view').style.display = 'flex';
    },
    
    // Show login view
    showLoginView() {
        document.getElementById('register-view').style.display = 'none';
        document.getElementById('login-view').style.display = 'flex';
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
        
        // Update avatar in navigation
        const avatarImg = document.getElementById('user-avatar');
        const avatarIcon = document.getElementById('user-avatar-icon');
        if (this.currentUser.avatar_url) {
            avatarImg.src = this.currentUser.avatar_url;
            avatarImg.style.display = 'inline-block';
            avatarIcon.style.display = 'none';
        } else {
            avatarImg.style.display = 'none';
            avatarIcon.style.display = 'inline';
        }
        
        // Show appropriate view
        this.showView('dashboard');
        
        // Initialize drag and drop after a short delay
        setTimeout(() => {
            if (window.DragDropCards) {
                DragDropCards.init();
            }
        }, 1000);
        
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
                
            case 'qr-scanner':
                dynamicContent.style.display = 'block';
                this.loadQRScannerView();
                break;
                
            case 'admin-strikes':
                dynamicContent.style.display = 'block';
                this.loadAdminStrikesView();
                break;
                
            case 'pending-users':
                dynamicContent.style.display = 'block';
                this.loadPendingUsersView();
                break;
                
            case 'pending-deliveries':
                dynamicContent.style.display = 'block';
                this.loadPendingDeliveriesView();
                break;
                
            case 'todays-schedule':
                dynamicContent.style.display = 'block';
                this.loadTodaysScheduleView();
                break;
                
            case 'delivery-history':
                dynamicContent.style.display = 'block';
                this.loadDeliveryHistoryView();
                break;
                
            case 'usage-statistics':
                dynamicContent.style.display = 'block';
                this.loadUsageStatisticsView();
                break;
                
            case 'stock-forecast':
                dynamicContent.style.display = 'block';
                this.loadStockForecastView();
                break;
                
            case 'late-returns':
                dynamicContent.style.display = 'block';
                this.loadLateReturnAnalyticsView();
                break;
                
            case 'debt-collection':
                dynamicContent.style.display = 'block';
                this.loadDebtCollectionView();
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
    
    // Load inventory view
    async loadInventoryView() {
        try {
            const products = await API.getProducts();
            const dynamicContent = document.getElementById('dynamic-content');
            
            // Store products for sorting and filtering
            this.allProducts = products.products || [];
            this.filteredProducts = [...this.allProducts];
            this.sortState = { column: null, ascending: true };
            
            dynamicContent.innerHTML = `
                <div class="container-fluid">
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <h2><i class="bi bi-box-seam"></i> Inventory Management</h2>
                        ${this.currentUser.role !== 'user' ? `
                            <button class="btn btn-primary" onclick="App.showAddProductModal()">
                                <i class="bi bi-plus-circle"></i> Add Product
                            </button>
                        ` : ''}
                    </div>
                    
                    <div class="row mb-3">
                        <div class="col-md-6">
                            <input type="text" class="form-control" id="product-search" 
                                   placeholder="Search products..." onkeyup="App.filterProducts()">
                        </div>
                        <div class="col-md-3">
                            <select class="form-select" id="category-filter" onchange="App.filterProducts()">
                                <option value="">All Categories</option>
                            </select>
                        </div>
                        <div class="col-md-3">
                            <select class="form-select" id="stock-filter" onchange="App.filterProducts()">
                                <option value="">All Stock Levels</option>
                                <option value="low">Low Stock</option>
                                <option value="normal">Normal Stock</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="table-responsive">
                        <table class="table table-hover">
                            <thead>
                                <tr>
                                    <th class="sortable" onclick="App.sortProducts('name')">
                                        Name <i class="bi bi-chevron-expand"></i>
                                    </th>
                                    <th class="sortable" onclick="App.sortProducts('category')">
                                        Category <i class="bi bi-chevron-expand"></i>
                                    </th>
                                    <th class="sortable" onclick="App.sortProducts('stock_quantity')">
                                        Stock <i class="bi bi-chevron-expand"></i>
                                    </th>
                                    <th>Unit</th>
                                    <th class="sortable" onclick="App.sortProducts('unit_price')">
                                        Price <i class="bi bi-chevron-expand"></i>
                                    </th>
                                    <th>Location</th>
                                    <th class="sortable" onclick="App.sortProducts('is_active')">
                                        Status <i class="bi bi-chevron-expand"></i>
                                    </th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="products-table-body">
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            
            this.displayProducts(this.filteredProducts);
            this.populateCategoryFilter(this.allProducts);
            
        } catch (error) {
            console.error('Failed to load inventory:', error);
            this.showNotification('Failed to load inventory', 'error');
        }
    },
    
    // Display products in table
    displayProducts(products) {
        const tbody = document.getElementById('products-table-body');
        
        if (!products || products.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-muted">
                        <i class="bi bi-inbox display-4"></i>
                        <p>No products found</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = products.map(product => {
            const isLowStock = product.stock_quantity <= product.minimum_stock;
            const stockClass = isLowStock ? 'text-danger' : 'text-success';
            
            return `
                <tr>
                    <td><strong>${product.name}</strong><br><small class="text-muted">${product.description || ''}</small></td>
                    <td><span class="badge bg-secondary">${product.category}</span></td>
                    <td class="${stockClass}">
                        <strong>${product.stock_quantity}</strong>
                        ${isLowStock ? '<br><small class="text-danger"><i class="bi bi-exclamation-triangle"></i> Low</small>' : ''}
                    </td>
                    <td>${product.unit_of_measure}</td>
                    <td>$${product.unit_price ? product.unit_price.toFixed(2) : '0.00'}</td>
                    <td><i class="bi bi-geo-alt"></i> ${product.location || 'N/A'}</td>
                    <td>
                        <span class="badge bg-${product.is_active ? 'success' : 'secondary'}">
                            ${product.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-info" onclick="App.viewProductDetails(${product.id})" title="View Details">
                            <i class="bi bi-eye"></i>
                        </button>
                        ${this.currentUser.role !== 'user' ? `
                            <button class="btn btn-sm btn-warning" onclick="App.editProduct(${product.id})" title="Edit">
                                <i class="bi bi-pencil"></i>
                            </button>
                        ` : ''}
                    </td>
                </tr>
            `;
        }).join('');
    },
    
    // Populate category filter
    populateCategoryFilter(products) {
        const categories = [...new Set(products.map(p => p.category))];
        const select = document.getElementById('category-filter');
        
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            select.appendChild(option);
        });
    },
    
    // Sort products by column
    sortProducts(column) {
        if (!this.filteredProducts) return;
        
        // Toggle sort direction if same column, otherwise default to ascending
        if (this.sortState.column === column) {
            this.sortState.ascending = !this.sortState.ascending;
        } else {
            this.sortState.column = column;
            this.sortState.ascending = true;
        }
        
        // Sort the filtered products
        this.filteredProducts.sort((a, b) => {
            let aVal = a[column];
            let bVal = b[column];
            
            // Handle null/undefined values
            if (aVal == null) aVal = '';
            if (bVal == null) bVal = '';
            
            // String comparison
            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }
            
            let comparison = 0;
            if (aVal < bVal) comparison = -1;
            if (aVal > bVal) comparison = 1;
            
            return this.sortState.ascending ? comparison : -comparison;
        });
        
        // Update the table headers to show sort direction
        document.querySelectorAll('th.sortable i').forEach(icon => {
            icon.className = 'bi bi-chevron-expand';
        });
        
        const currentHeader = document.querySelector(`th.sortable[onclick*="${column}"] i`);
        if (currentHeader) {
            currentHeader.className = this.sortState.ascending 
                ? 'bi bi-chevron-up' 
                : 'bi bi-chevron-down';
        }
        
        // Redisplay products
        this.displayProducts(this.filteredProducts);
    },
    
    // Filter products
    filterProducts() {
        if (!this.allProducts) return;
        
        const searchTerm = document.getElementById('product-search')?.value.toLowerCase() || '';
        const categoryFilter = document.getElementById('category-filter')?.value || '';
        const stockFilter = document.getElementById('stock-filter')?.value || '';
        
        this.filteredProducts = this.allProducts.filter(product => {
            // Search filter
            const matchesSearch = !searchTerm || 
                product.name.toLowerCase().includes(searchTerm) ||
                (product.description && product.description.toLowerCase().includes(searchTerm)) ||
                (product.category && product.category.toLowerCase().includes(searchTerm));
            
            // Category filter
            const matchesCategory = !categoryFilter || product.category === categoryFilter;
            
            // Stock filter
            let matchesStock = true;
            if (stockFilter === 'low') {
                matchesStock = product.stock_quantity <= product.minimum_stock;
            } else if (stockFilter === 'normal') {
                matchesStock = product.stock_quantity > product.minimum_stock;
            }
            
            return matchesSearch && matchesCategory && matchesStock;
        });
        
        // Reapply current sort if any
        if (this.sortState.column) {
            this.sortProducts(this.sortState.column);
        } else {
            this.displayProducts(this.filteredProducts);
        }
    },
    
    // View product details
    async viewProductDetails(productId) {
        try {
            const response = await API.getProduct(productId);
            const product = response;
            
            // Create modal HTML
            const modalHtml = `
                <div class="modal fade" id="productDetailsModal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">
                                    <i class="bi bi-box-seam"></i> Product Details
                                </h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="row mb-3">
                                    <div class="col-md-6">
                                        <h6><strong>${product.name}</strong></h6>
                                        <p class="text-muted">${product.description || 'No description'}</p>
                                    </div>
                                    <div class="col-md-6 text-end">
                                        <span class="badge bg-${product.is_active ? 'success' : 'secondary'} fs-6">
                                            ${product.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                </div>
                                
                                <div class="row mb-4">
                                    <div class="col-md-3">
                                        <div class="card text-center">
                                            <div class="card-body">
                                                <h6 class="text-muted small">Current Stock</h6>
                                                <h3 class="${product.stock_quantity <= product.minimum_stock ? 'text-danger' : 'text-success'}">
                                                    ${product.stock_quantity}
                                                </h3>
                                                <small>${product.unit_of_measure}</small>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-md-3">
                                        <div class="card text-center">
                                            <div class="card-body">
                                                <h6 class="text-muted small">Min. Stock</h6>
                                                <h3>${product.minimum_stock}</h3>
                                                <small>${product.unit_of_measure}</small>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-md-3">
                                        <div class="card text-center">
                                            <div class="card-body">
                                                <h6 class="text-muted small">Unit Price</h6>
                                                <h3>$${product.unit_price ? product.unit_price.toFixed(2) : '0.00'}</h3>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-md-3">
                                        <div class="card text-center">
                                            <div class="card-body">
                                                <h6 class="text-muted small">Category</h6>
                                                <span class="badge bg-secondary fs-6">${product.category}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="row mb-3">
                                    <div class="col-md-6">
                                        <p><i class="bi bi-geo-alt"></i> <strong>Location:</strong> ${product.location || 'Not specified'}</p>
                                    </div>
                                    <div class="col-md-6">
                                        <p><i class="bi bi-calendar"></i> <strong>Created:</strong> ${new Date(product.created_at).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                
                                ${product.pending_requests && product.pending_requests.length > 0 ? `
                                    <hr>
                                    <h6><i class="bi bi-clock-history"></i> Pending Requests (${product.pending_requests.length})</h6>
                                    <div class="table-responsive">
                                        <table class="table table-sm">
                                            <thead>
                                                <tr>
                                                    <th>User</th>
                                                    <th>Quantity</th>
                                                    <th>Date</th>
                                                    <th>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${product.pending_requests.map(req => `
                                                    <tr>
                                                        <td>${req.user_name || 'N/A'}</td>
                                                        <td>${req.quantity_requested}</td>
                                                        <td>${new Date(req.request_date).toLocaleDateString()}</td>
                                                        <td><span class="badge bg-warning">${req.status}</span></td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                ` : ''}
                                
                                ${product.transaction_history && product.transaction_history.length > 0 ? `
                                    <hr>
                                    <h6><i class="bi bi-list-ul"></i> Recent Transactions</h6>
                                    <div class="table-responsive">
                                        <table class="table table-sm">
                                            <thead>
                                                <tr>
                                                    <th>Date</th>
                                                    <th>Type</th>
                                                    <th>Quantity</th>
                                                    <th>Notes</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${product.transaction_history.map(tx => `
                                                    <tr>
                                                        <td>${new Date(tx.transaction_date).toLocaleString()}</td>
                                                        <td>
                                                            <span class="badge bg-${tx.transaction_type === 'in' ? 'success' : 'danger'}">
                                                                ${tx.transaction_type}
                                                            </span>
                                                        </td>
                                                        <td class="${tx.quantity_change > 0 ? 'text-success' : 'text-danger'}">
                                                            ${tx.quantity_change > 0 ? '+' : ''}${tx.quantity_change}
                                                        </td>
                                                        <td>${tx.notes || '-'}</td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                ` : ''}
                            </div>
                            <div class="modal-footer">
                                ${this.currentUser.role !== 'user' ? `
                                    <button type="button" class="btn btn-warning" onclick="App.editProduct(${productId}); bootstrap.Modal.getInstance(document.getElementById('productDetailsModal')).hide();">
                                        <i class="bi bi-pencil"></i> Edit Product
                                    </button>
                                ` : ''}
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Remove existing modal if any
            const existingModal = document.getElementById('productDetailsModal');
            if (existingModal) {
                existingModal.remove();
            }
            
            // Add modal to DOM
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('productDetailsModal'));
            modal.show();
            
            // Clean up modal when hidden
            document.getElementById('productDetailsModal').addEventListener('hidden.bs.modal', function() {
                this.remove();
            });
            
        } catch (error) {
            console.error('Failed to load product details:', error);
            this.showNotification('Failed to load product details', 'error');
        }
    },
    
    // Edit product
    async editProduct(productId) {
        try {
            const response = await API.getProduct(productId);
            const product = response;
            
            // Create modal HTML
            const modalHtml = `
                <div class="modal fade" id="editProductModal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">
                                    <i class="bi bi-pencil"></i> Edit Product
                                </h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <form id="edit-product-form">
                                <div class="modal-body">
                                    <div class="row">
                                        <div class="col-md-6 mb-3">
                                            <label class="form-label">Product Name *</label>
                                            <input type="text" class="form-control" name="name" value="${product.name}" required>
                                        </div>
                                        <div class="col-md-6 mb-3">
                                            <label class="form-label">Category *</label>
                                            <input type="text" class="form-control" name="category" value="${product.category || ''}" required>
                                        </div>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label class="form-label">Description</label>
                                        <textarea class="form-control" name="description" rows="2">${product.description || ''}</textarea>
                                    </div>
                                    
                                    <div class="row">
                                        <div class="col-md-4 mb-3">
                                            <label class="form-label">Unit of Measure *</label>
                                            <input type="text" class="form-control" name="unit_of_measure" value="${product.unit_of_measure}" required>
                                        </div>
                                        <div class="col-md-4 mb-3">
                                            <label class="form-label">Unit Price</label>
                                            <div class="input-group">
                                                <span class="input-group-text">$</span>
                                                <input type="number" class="form-control" name="unit_price" step="0.01" value="${product.unit_price || ''}">
                                            </div>
                                        </div>
                                        <div class="col-md-4 mb-3">
                                            <label class="form-label">Location</label>
                                            <input type="text" class="form-control" name="location" value="${product.location || ''}">
                                        </div>
                                    </div>
                                    
                                    <div class="row">
                                        <div class="col-md-6 mb-3">
                                            <label class="form-label">Current Stock</label>
                                            <input type="number" class="form-control" name="stock_quantity" step="0.01" value="${product.stock_quantity}" readonly>
                                            <small class="text-muted">Use stock adjustment below to modify</small>
                                        </div>
                                        <div class="col-md-6 mb-3">
                                            <label class="form-label">Minimum Stock *</label>
                                            <input type="number" class="form-control" name="minimum_stock" step="0.01" value="${product.minimum_stock}" required>
                                        </div>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <div class="form-check">
                                            <input type="checkbox" class="form-check-input" name="is_active" id="edit-is-active" ${product.is_active ? 'checked' : ''}>
                                            <label class="form-check-label" for="edit-is-active">
                                                Product is Active
                                            </label>
                                        </div>
                                    </div>
                                    
                                    <hr>
                                    <h6><i class="bi bi-box-arrow-in-down"></i> Stock Adjustment (Optional)</h6>
                                    <div class="row">
                                        <div class="col-md-4 mb-3">
                                            <label class="form-label">Transaction Type</label>
                                            <select class="form-select" id="stock-transaction-type">
                                                <option value="">No adjustment</option>
                                                <option value="in">Stock In (+)</option>
                                                <option value="out">Stock Out (-)</option>
                                                <option value="adjustment">Adjustment</option>
                                            </select>
                                        </div>
                                        <div class="col-md-4 mb-3">
                                            <label class="form-label">Quantity Change</label>
                                            <input type="number" class="form-control" id="stock-quantity-change" step="0.01" placeholder="0">
                                        </div>
                                        <div class="col-md-4 mb-3">
                                            <label class="form-label">Notes</label>
                                            <input type="text" class="form-control" id="stock-notes" placeholder="Optional notes">
                                        </div>
                                    </div>
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                    <button type="submit" class="btn btn-primary">
                                        <i class="bi bi-save"></i> Save Changes
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            `;
            
            // Remove existing modal if any
            const existingModal = document.getElementById('editProductModal');
            if (existingModal) {
                existingModal.remove();
            }
            
            // Add modal to DOM
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('editProductModal'));
            modal.show();
            
            // Handle form submission
            document.getElementById('edit-product-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = new FormData(e.target);
                const productData = {
                    name: formData.get('name'),
                    description: formData.get('description'),
                    category: formData.get('category'),
                    unit_of_measure: formData.get('unit_of_measure'),
                    unit_price: formData.get('unit_price') ? parseFloat(formData.get('unit_price')) : null,
                    minimum_stock: parseFloat(formData.get('minimum_stock')),
                    location: formData.get('location'),
                    is_active: formData.get('is_active') === 'on'
                };
                
                try {
                    // Update product details
                    await API.updateProduct(productId, productData);
                    
                    // Handle stock adjustment if provided
                    const transactionType = document.getElementById('stock-transaction-type').value;
                    const quantityChange = document.getElementById('stock-quantity-change').value;
                    const notes = document.getElementById('stock-notes').value;
                    
                    if (transactionType && quantityChange) {
                        await API.updateStock(productId, {
                            transaction_type: transactionType,
                            quantity_change: parseFloat(quantityChange),
                            notes: notes || undefined
                        });
                    }
                    
                    this.showNotification('Product updated successfully', 'success');
                    modal.hide();
                    
                    // Reload inventory view
                    this.loadInventoryView();
                    
                } catch (error) {
                    console.error('Failed to update product:', error);
                    this.showNotification(error.message || 'Failed to update product', 'error');
                }
            });
            
            // Clean up modal when hidden
            document.getElementById('editProductModal').addEventListener('hidden.bs.modal', function() {
                this.remove();
            });
            
        } catch (error) {
            console.error('Failed to load product for editing:', error);
            this.showNotification('Failed to load product', 'error');
        }
    },
    
    // Show add product modal
    showAddProductModal() {
        // Create modal HTML
        const modalHtml = `
            <div class="modal fade" id="addProductModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="bi bi-plus-circle"></i> Add New Product
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <form id="add-product-form">
                            <div class="modal-body">
                                <div class="row">
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label">Product Name *</label>
                                        <input type="text" class="form-control" name="name" required placeholder="Enter product name">
                                    </div>
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label">Category *</label>
                                        <input type="text" class="form-control" name="category" required placeholder="e.g., Electronics, Tools, Materials">
                                        <small class="text-muted">Existing categories will appear as suggestions</small>
                                    </div>
                                </div>
                                
                                <div class="mb-3">
                                    <label class="form-label">Description</label>
                                    <textarea class="form-control" name="description" rows="2" placeholder="Optional product description"></textarea>
                                </div>
                                
                                <div class="row">
                                    <div class="col-md-4 mb-3">
                                        <label class="form-label">Unit of Measure *</label>
                                        <select class="form-select" name="unit_of_measure" required>
                                            <option value="">Select unit...</option>
                                            <option value="pcs">Pieces (pcs)</option>
                                            <option value="kg">Kilograms (kg)</option>
                                            <option value="g">Grams (g)</option>
                                            <option value="L">Liters (L)</option>
                                            <option value="mL">Milliliters (mL)</option>
                                            <option value="m">Meters (m)</option>
                                            <option value="cm">Centimeters (cm)</option>
                                            <option value="boxes">Boxes</option>
                                            <option value="units">Units</option>
                                            <option value="sets">Sets</option>
                                        </select>
                                    </div>
                                    <div class="col-md-4 mb-3">
                                        <label class="form-label">Unit Price</label>
                                        <div class="input-group">
                                            <span class="input-group-text">$</span>
                                            <input type="number" class="form-control" name="unit_price" step="0.01" min="0" placeholder="0.00">
                                        </div>
                                    </div>
                                    <div class="col-md-4 mb-3">
                                        <label class="form-label">Location</label>
                                        <input type="text" class="form-control" name="location" placeholder="e.g., A-12, Shelf 3">
                                    </div>
                                </div>
                                
                                <div class="row">
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label">Initial Stock Quantity *</label>
                                        <input type="number" class="form-control" name="stock_quantity" step="0.01" min="0" value="0" required>
                                        <small class="text-muted">Starting stock quantity</small>
                                    </div>
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label">Minimum Stock Level *</label>
                                        <input type="number" class="form-control" name="minimum_stock" step="0.01" min="0" value="10" required>
                                        <small class="text-muted">Alert threshold for low stock</small>
                                    </div>
                                </div>
                                
                                <div class="mb-3">
                                    <div class="form-check">
                                        <input type="checkbox" class="form-check-input" name="is_active" id="add-is-active" checked>
                                        <label class="form-check-label" for="add-is-active">
                                            Product is Active (available for requests)
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                <button type="submit" class="btn btn-primary">
                                    <i class="bi bi-save"></i> Add Product
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal if any
        const existingModal = document.getElementById('addProductModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Add modal to DOM
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('addProductModal'));
        modal.show();
        
        // Handle form submission
        document.getElementById('add-product-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const productData = {
                name: formData.get('name'),
                description: formData.get('description') || null,
                category: formData.get('category'),
                unit_of_measure: formData.get('unit_of_measure'),
                unit_price: formData.get('unit_price') ? parseFloat(formData.get('unit_price')) : null,
                stock_quantity: parseFloat(formData.get('stock_quantity')),
                minimum_stock: parseFloat(formData.get('minimum_stock')),
                location: formData.get('location') || null,
                is_active: formData.get('is_active') === 'on'
            };
            
            try {
                const result = await API.createProduct(productData);
                
                this.showNotification('Product added successfully!', 'success');
                modal.hide();
                
                // Reload inventory view
                this.loadInventoryView();
                
            } catch (error) {
                console.error('Failed to add product:', error);
                this.showNotification(error.message || 'Failed to add product', 'error');
            }
        });
        
        // Clean up modal when hidden
        document.getElementById('addProductModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    },
    
    // Load debts view
    // Load requests view
    async loadRequestsView() {
        try {
            const requests = await API.getRequests();
            const dynamicContent = document.getElementById('dynamic-content');
            
            // Filter requests by status for tabs
            const allRequests = requests.requests || [];
            const pendingRequests = allRequests.filter(r => r.status === 'pending');
            const approvedRequests = allRequests.filter(r => r.status === 'approved');
            const deliveredRequests = allRequests.filter(r => r.status === 'delivered');
            const returnedRequests = allRequests.filter(r => r.status === 'returned');
            
            dynamicContent.innerHTML = `
                <div class="container-fluid">
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <h2><i class="bi bi-inbox"></i> My Requests</h2>
                        <button class="btn btn-primary" onclick="App.showView('new-request')">
                            <i class="bi bi-plus-circle"></i> New Request
                        </button>
                    </div>
                    
                    <ul class="nav nav-tabs mb-3" id="requestTabs" role="tablist">
                        <li class="nav-item" role="presentation">
                            <button class="nav-link active" id="all-tab" data-bs-toggle="tab" data-bs-target="#all" type="button">
                                All (${allRequests.length})
                            </button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link" id="pending-tab" data-bs-toggle="tab" data-bs-target="#pending" type="button">
                                Pending (${pendingRequests.length})
                            </button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link" id="approved-tab" data-bs-toggle="tab" data-bs-target="#approved" type="button">
                                Approved (${approvedRequests.length})
                            </button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link" id="delivered-tab" data-bs-toggle="tab" data-bs-target="#delivered" type="button">
                                Delivered (${deliveredRequests.length})
                            </button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link" id="returned-tab" data-bs-toggle="tab" data-bs-target="#returned" type="button">
                                Returned (${returnedRequests.length})
                            </button>
                        </li>
                    </ul>
                    
                    <div class="tab-content" id="requestTabContent">
                        <div class="tab-pane fade show active" id="all" role="tabpanel">
                            ${this.renderRequestsTable(allRequests)}
                        </div>
                        <div class="tab-pane fade" id="pending" role="tabpanel">
                            ${this.renderRequestsTable(pendingRequests)}
                        </div>
                        <div class="tab-pane fade" id="approved" role="tabpanel">
                            ${this.renderRequestsTable(approvedRequests)}
                        </div>
                        <div class="tab-pane fade" id="delivered" role="tabpanel">
                            ${this.renderRequestsTable(deliveredRequests)}
                        </div>
                        <div class="tab-pane fade" id="returned" role="tabpanel">
                            ${this.renderRequestsTable(returnedRequests)}
                        </div>
                    </div>
                </div>
            `;
            
        } catch (error) {
            console.error('Failed to load requests:', error);
            this.showNotification('Failed to load requests', 'error');
        }
    },
    
    // Render requests table
    renderRequestsTable(requests) {
        if (!requests || requests.length === 0) {
            return `
                <div class="text-center text-muted py-5">
                    <i class="bi bi-inbox display-1"></i>
                    <p class="mt-3">No requests found</p>
                </div>
            `;
        }
        
        return `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>Request #</th>
                            <th>Date</th>
                            <th>Return Due</th>
                            <th>Status</th>
                            <th>Items</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${requests.map(req => {
                            const statusColors = {
                                'pending': 'warning',
                                'approved': 'info',
                                'collecting': 'primary',
                                'delivered': 'success',
                                'returned': 'secondary',
                                'cancelled': 'danger'
                            };
                            
                            const statusColor = statusColors[req.status] || 'secondary';
                            const itemCount = req.items ? req.items.length : 0;
                            const isLate = req.is_late ? '<span class="badge bg-danger ms-2">LATE</span>' : '';
                            
                            return `
                                <tr>
                                    <td>
                                        <strong>${req.request_number}</strong>
                                        ${isLate}
                                    </td>
                                    <td>${new Date(req.requested_date).toLocaleDateString()}</td>
                                    <td>
                                        ${req.expected_return_datetime 
                                            ? new Date(req.expected_return_datetime).toLocaleString() 
                                            : 'N/A'}
                                    </td>
                                    <td>
                                        <span class="badge bg-${statusColor}">
                                            ${req.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td>${itemCount} item${itemCount !== 1 ? 's' : ''}</td>
                                    <td>
                                        <button class="btn btn-sm btn-info" onclick="App.viewRequestDetails(${req.id})" title="View Details">
                                            <i class="bi bi-eye"></i>
                                        </button>
                                        ${req.status === 'pending' ? `
                                            <button class="btn btn-sm btn-danger" onclick="App.cancelRequest(${req.id})" title="Cancel">
                                                <i class="bi bi-x-circle"></i>
                                            </button>
                                        ` : ''}
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },
    
    // View request details with QR code
    async viewRequestDetails(requestId) {
        try {
            const request = await API.getRequest(requestId);
            
            const statusColors = {
                'pending': 'warning',
                'approved': 'info',
                'collecting': 'primary',
                'delivered': 'success',
                'returned': 'secondary',
                'cancelled': 'danger'
            };
            
            const statusColor = statusColors[request.status] || 'secondary';
            
            const modalHtml = `
                <div class="modal fade" id="requestDetailsModal" tabindex="-1">
                    <div class="modal-dialog modal-xl">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">
                                    <i class="bi bi-file-earmark-text"></i> Request Details - ${request.request_number}
                                </h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="row">
                                    <div class="col-md-8">
                                        <div class="mb-4">
                                            <h6>Status</h6>
                                            <span class="badge bg-${statusColor} fs-6">${request.status.toUpperCase()}</span>
                                            ${request.is_late ? '<span class="badge bg-danger fs-6 ms-2">LATE RETURN</span>' : ''}
                                            ${request.is_damaged ? '<span class="badge bg-warning fs-6 ms-2">DAMAGED</span>' : ''}
                                        </div>
                                        
                                        <div class="row mb-4">
                                            <div class="col-md-6">
                                                <h6>Collection</h6>
                                                <p><strong>Date:</strong> ${new Date(request.requested_date).toLocaleDateString()}</p>
                                                <p><strong>Time:</strong> ${request.requested_time}</p>
                                            </div>
                                            <div class="col-md-6">
                                                <h6>Expected Return</h6>
                                                <p>${request.expected_return_datetime 
                                                    ? new Date(request.expected_return_datetime).toLocaleString()
                                                    : 'Not specified'}</p>
                                            </div>
                                        </div>
                                        
                                        <div class="mb-4">
                                            <h6>Purpose</h6>
                                            <p>${request.purpose || 'Not specified'}</p>
                                        </div>
                                        
                                        ${request.supervising_instructor ? `
                                            <div class="mb-4">
                                                <h6>Supervising Instructor</h6>
                                                <p>${request.supervising_instructor}</p>
                                            </div>
                                        ` : ''}
                                        
                                        <div class="mb-4">
                                            <h6>Requested Items</h6>
                                            <table class="table table-sm">
                                                <thead>
                                                    <tr>
                                                        <th>Product</th>
                                                        <th>Quantity</th>
                                                        <th>Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    ${request.items && request.items.length > 0 
                                                        ? request.items.map(item => `
                                                            <tr>
                                                                <td>${item.product_name || 'Product #' + item.product_id}</td>
                                                                <td>${item.requested_quantity}</td>
                                                                <td>
                                                                    ${item.approved_quantity ? `Approved: ${item.approved_quantity}` : 'Pending'}
                                                                </td>
                                                            </tr>
                                                        `).join('')
                                                        : '<tr><td colspan="3">No items</td></tr>'}
                                                </tbody>
                                            </table>
                                        </div>
                                        
                                        ${request.notes ? `
                                            <div class="mb-4">
                                                <h6>Notes</h6>
                                                <p class="small">${request.notes.replace(/\n/g, '<br>')}</p>
                                            </div>
                                        ` : ''}
                                    </div>
                                    
                                    <div class="col-md-4">
                                        ${request.qr_code_image ? `
                                            <div class="card bg-light">
                                                <div class="card-body text-center">
                                                    <h6><i class="bi bi-qr-code"></i> QR Code for Pickup</h6>
                                                    <img src="${request.qr_code_image}" alt="QR Code" class="img-fluid mb-3" style="max-width: 250px;">
                                                    <p class="small text-muted">Show this QR code to the warehouse operator for pickup</p>
                                                    <button class="btn btn-sm btn-primary" onclick="App.downloadQRCode('${request.qr_code_image}', '${request.request_number}')">
                                                        <i class="bi bi-download"></i> Download QR
                                                    </button>
                                                </div>
                                            </div>
                                        ` : '<p class="text-muted">QR code not available</p>'}
                                        
                                        <div class="card mt-3">
                                            <div class="card-body">
                                                <h6>Timeline</h6>
                                                <small class="text-muted">Created: ${new Date(request.created_at).toLocaleString()}</small><br>
                                                ${request.delivery_date ? `<small>Delivered: ${new Date(request.delivery_date).toLocaleString()}</small><br>` : ''}
                                                ${request.actual_return_datetime ? `<small>Returned: ${new Date(request.actual_return_datetime).toLocaleString()}</small>` : ''}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                ${request.status === 'pending' && this.currentUser.role === 'user' ? `
                                    <button type="button" class="btn btn-danger" onclick="App.cancelRequest(${request.id}); bootstrap.Modal.getInstance(document.getElementById('requestDetailsModal')).hide();">
                                        <i class="bi bi-x-circle"></i> Cancel Request
                                    </button>
                                ` : ''}
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Remove existing modal
            const existingModal = document.getElementById('requestDetailsModal');
            if (existingModal) existingModal.remove();
            
            // Add and show modal
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            const modal = new bootstrap.Modal(document.getElementById('requestDetailsModal'));
            modal.show();
            
            // Cleanup
            document.getElementById('requestDetailsModal').addEventListener('hidden.bs.modal', function() {
                this.remove();
            });
            
        } catch (error) {
            console.error('Failed to load request details:', error);
            this.showNotification('Failed to load request details', 'error');
        }
    },
    
    // Download QR code
    downloadQRCode(imageData, requestNumber) {
        const link = document.createElement('a');
        link.href = imageData;
        link.download = `QR-${requestNumber}.png`;
        link.click();
    },
    
    // Cancel request
    async cancelRequest(requestId) {
        if (!confirm('Are you sure you want to cancel this request?')) {
            return;
        }
        
        try {
            await API.updateRequestStatus(requestId, 'cancelled');
            this.showNotification('Request cancelled successfully', 'success');
            this.loadRequestsView();
        } catch (error) {
            console.error('Failed to cancel request:', error);
            this.showNotification('Failed to cancel request', 'error');
        }
    },
    
    async loadDebtsView() {
        const dynamicContent = document.getElementById('dynamic-content');
        dynamicContent.innerHTML = `
            <div class="container-fluid">
                <h2><i class="bi bi-cash-stack"></i> Debt Management</h2>
                <p class="text-muted">Debt management features coming soon...</p>
            </div>
        `;
    },
    
    async loadDeliveriesView() {
        try {
            const data = await API.getRequests({ status: 'approved,picked_up' });
            const dynamicContent = document.getElementById('dynamic-content');
            
            const approvedRequests = data.requests.filter(r => r.status === 'approved' && !r.delivery_date);
            const pickedUpRequests = data.requests.filter(r => r.status === 'delivered' || (r.delivery_date && !r.return_date));
            
            dynamicContent.innerHTML = `
                <div class="container-fluid">
                    <h2><i class="bi bi-truck"></i> Deliveries</h2>
                    
                    <div class="row mb-4">
                        <div class="col-md-6">
                            <div class="card">
                                <div class="card-header bg-warning bg-opacity-25">
                                    <h5 class="mb-0">
                                        <i class="bi bi-hourglass-split"></i> Ready for Pickup (${approvedRequests.length})
                                    </h5>
                                </div>
                                <div class="card-body">
                                    ${approvedRequests.length === 0 ? `
                                        <p class="text-muted">No requests ready for pickup</p>
                                    ` : `
                                        <div class="list-group">
                                            ${approvedRequests.map(req => `
                                                <a href="#" class="list-group-item list-group-item-action" onclick="App.showRequestDetails(${req.id}); return false;">
                                                    <div class="d-flex w-100 justify-content-between">
                                                        <h6 class="mb-1">${req.request_number}</h6>
                                                        <small>${new Date(req.created_at).toLocaleString()}</small>
                                                    </div>
                                                    <p class="mb-1">${req.user_name || 'Unknown User'}</p>
                                                    <small>${req.purpose || 'No purpose specified'}</small>
                                                </a>
                                            `).join('')}
                                        </div>
                                    `}
                                </div>
                            </div>
                        </div>
                        
                        <div class="col-md-6">
                            <div class="card">
                                <div class="card-header bg-primary bg-opacity-25">
                                    <h5 class="mb-0">
                                        <i class="bi bi-box-arrow-in-down"></i> Out for Return (${pickedUpRequests.length})
                                    </h5>
                                </div>
                                <div class="card-body">
                                    ${pickedUpRequests.length === 0 ? `
                                        <p class="text-muted">No requests awaiting return</p>
                                    ` : `
                                        <div class="list-group">
                                            ${pickedUpRequests.map(req => `
                                                <a href="#" class="list-group-item list-group-item-action" onclick="App.showRequestDetails(${req.id}); return false;">
                                                    <div class="d-flex w-100 justify-content-between">
                                                        <h6 class="mb-1">${req.request_number}</h6>
                                                        <small>Due: ${req.expected_return_datetime ? new Date(req.expected_return_datetime).toLocaleString() : 'N/A'}</small>
                                                    </div>
                                                    <p class="mb-1">${req.user_name || 'Unknown User'}</p>
                                                    <small>Picked up: ${req.delivery_date ? new Date(req.delivery_date).toLocaleString() : 'N/A'}</small>
                                                </a>
                                            `).join('')}
                                        </div>
                                    `}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Failed to load deliveries:', error);
            this.showNotification('Failed to load deliveries', 'error');
        }
    },
    
    // Load profile view
    async loadProfileView() {
        try {
            const profile = await API.getProfile();
            const dynamicContent = document.getElementById('dynamic-content');
            
            dynamicContent.innerHTML = `
                <div class="container-fluid">
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <h2><i class="bi bi-person-circle"></i> My Profile</h2>
                        <div>
                            <button class="btn btn-primary me-2" onclick="App.showEditProfileModal()">
                                <i class="bi bi-pencil"></i> Edit Profile
                            </button>
                            <button class="btn btn-warning" onclick="App.showChangePasswordModal()">
                                <i class="bi bi-key"></i> Change Password
                            </button>
                        </div>
                    </div>
                    
                    <!-- Avatar Section -->
                    <div class="row mb-4">
                        <div class="col-12">
                            <div class="card">
                                <div class="card-body text-center">
                                    <div class="mb-3">
                                        ${profile.avatar_url ? `
                                            <img src="${profile.avatar_url}" alt="Avatar" class="rounded-circle" style="width: 150px; height: 150px; object-fit: cover; border: 3px solid #dee2e6;">
                                        ` : `
                                            <div class="rounded-circle bg-secondary d-inline-flex align-items-center justify-content-center" style="width: 150px; height: 150px;">
                                                <i class="bi bi-person-fill text-white" style="font-size: 4rem;"></i>
                                            </div>
                                        `}
                                    </div>
                                    <input type="file" id="avatar-upload-input" accept="image/*" style="display: none;" onchange="App.handleAvatarUpload(event)">
                                    <button class="btn btn-sm btn-outline-primary me-2" onclick="document.getElementById('avatar-upload-input').click()">
                                        <i class="bi bi-upload"></i> Upload Avatar
                                    </button>
                                    ${profile.avatar_url ? `
                                        <button class="btn btn-sm btn-outline-danger" onclick="App.removeAvatar()">
                                            <i class="bi bi-trash"></i> Remove
                                        </button>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="row">
                        <div class="col-md-6 mb-4">
                            <div class="card">
                                <div class="card-header">
                                    <h5 class="mb-0"><i class="bi bi-person"></i> Personal Information</h5>
                                </div>
                                <div class="card-body">
                                    <div class="mb-3">
                                        <label class="text-muted small">Full Name</label>
                                        <h5>${profile.full_name}</h5>
                                    </div>
                                    <div class="mb-3">
                                        <label class="text-muted small">Registration Number</label>
                                        <p class="mb-0"><strong>${profile.registration_number}</strong></p>
                                    </div>
                                    <div class="mb-3">
                                        <label class="text-muted small">Email</label>
                                        <p class="mb-0">${profile.email}</p>
                                    </div>
                                    <div class="mb-3">
                                        <label class="text-muted small">Phone</label>
                                        <p class="mb-0">${profile.phone || 'Not specified'}</p>
                                    </div>
                                    <div class="mb-3">
                                        <label class="text-muted small">Department</label>
                                        <p class="mb-0">${profile.department || 'Not specified'}</p>
                                    </div>
                                    <div class="mb-3">
                                        <label class="text-muted small">Role</label>
                                        <p class="mb-0">
                                            <span class="badge bg-${profile.role === 'admin' ? 'danger' : profile.role === 'operator' ? 'warning' : 'primary'} fs-6">
                                                ${profile.role.toUpperCase()}
                                            </span>
                                        </p>
                                    </div>
                                    <div class="mb-3">
                                        <label class="text-muted small">Account Status</label>
                                        <p class="mb-0">
                                            <span class="badge bg-${profile.is_active ? 'success' : 'secondary'}">
                                                ${profile.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </p>
                                    </div>
                                    <div class="mb-0">
                                        <label class="text-muted small">Member Since</label>
                                        <p class="mb-0">${new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="col-md-6 mb-4">
                            <div class="card">
                                <div class="card-header">
                                    <h5 class="mb-0"><i class="bi bi-graph-up"></i> Activity Statistics</h5>
                                </div>
                                <div class="card-body">
                                    ${profile.statistics && profile.statistics.requests ? `
                                        <h6 class="mb-3">Requests Summary</h6>
                                        <div class="row mb-3">
                                            <div class="col-6">
                                                <div class="text-center p-3 bg-light rounded">
                                                    <h4 class="mb-0 text-primary">${profile.statistics.requests.total || 0}</h4>
                                                    <small class="text-muted">Total Requests</small>
                                                </div>
                                            </div>
                                            <div class="col-6">
                                                <div class="text-center p-3 bg-light rounded">
                                                    <h4 class="mb-0 text-warning">${profile.statistics.requests.pending || 0}</h4>
                                                    <small class="text-muted">Pending</small>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="row mb-3">
                                            <div class="col-6">
                                                <div class="text-center p-3 bg-light rounded">
                                                    <h4 class="mb-0 text-success">${profile.statistics.requests.approved || 0}</h4>
                                                    <small class="text-muted">Approved</small>
                                                </div>
                                            </div>
                                            <div class="col-6">
                                                <div class="text-center p-3 bg-light rounded">
                                                    <h4 class="mb-0 text-info">${profile.statistics.requests.delivered || 0}</h4>
                                                    <small class="text-muted">Delivered</small>
                                                </div>
                                            </div>
                                        </div>
                                    ` : '<p class="text-muted">No request statistics available</p>'}
                                    
                                    <!-- Strikes Warning -->
                                    <div class="alert ${(profile.strikes || 0) > 0 ? 'alert-danger' : 'alert-success'} mb-3">
                                        <h6 class="mb-2">
                                            <i class="bi ${(profile.strikes || 0) > 0 ? 'bi-exclamation-triangle' : 'bi-check-circle'}"></i> 
                                            Penalty Strikes
                                        </h6>
                                        <div class="d-flex justify-content-between align-items-center">
                                            <span><strong>${profile.strikes || 0}</strong> Active Strike${(profile.strikes || 0) !== 1 ? 's' : ''}</span>
                                            ${(profile.strikes || 0) > 0 ? `
                                                <button class="btn btn-sm btn-outline-danger" onclick="App.viewStrikeHistory()">
                                                    View History
                                                </button>
                                            ` : ''}
                                        </div>
                                        ${(profile.strikes || 0) > 0 ? `
                                            <small class="text-muted d-block mt-2">
                                                <i class="bi bi-info-circle"></i> Strikes are given for late returns and violations
                                            </small>
                                        ` : ''}
                                    </div>
                                    
                                    ${profile.statistics && profile.statistics.debts ? `
                                        <hr>
                                        <h6 class="mb-3">Debt Summary</h6>
                                        <div class="row mb-3">
                                            <div class="col-6">
                                                <div class="text-center p-3 bg-light rounded">
                                                    <h4 class="mb-0 text-danger">${profile.statistics.debts.total_debts || 0}</h4>
                                                    <small class="text-muted">Outstanding Debts</small>
                                                </div>
                                            </div>
                                            <div class="col-6">
                                                <div class="text-center p-3 bg-light rounded">
                                                    <h4 class="mb-0 text-danger">$${parseFloat(profile.statistics.debts.total_amount || 0).toFixed(2)}</h4>
                                                    <small class="text-muted">Total Amount</small>
                                                </div>
                                            </div>
                                        </div>
                                        ${(profile.statistics.debts.total_debts || 0) > 0 ? `
                                            <button class="btn btn-sm btn-outline-primary w-100" onclick="App.showView('debts')">
                                                <i class="bi bi-list-ul"></i> View Debt Details
                                            </button>
                                        ` : ''}
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Failed to load profile:', error);
            this.showNotification('Failed to load profile', 'error');
        }
    },
    
    // Show change password modal
    showChangePasswordModal() {
        const modalHtml = `
            <div class="modal fade" id="changePasswordModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="bi bi-key"></i> Change Password
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <form id="change-password-form">
                            <div class="modal-body">
                                <div class="mb-3">
                                    <label class="form-label">Current Password *</label>
                                    <input type="password" class="form-control" name="old_password" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">New Password *</label>
                                    <input type="password" class="form-control" name="new_password" required minlength="6">
                                    <small class="text-muted">Minimum 6 characters</small>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Confirm New Password *</label>
                                    <input type="password" class="form-control" name="confirm_password" required>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                <button type="submit" class="btn btn-primary">
                                    <i class="bi bi-check-circle"></i> Change Password
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal if any
        const existingModal = document.getElementById('changePasswordModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Add modal to DOM
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('changePasswordModal'));
        modal.show();
        
        // Handle form submission
        document.getElementById('change-password-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const oldPassword = formData.get('old_password');
            const newPassword = formData.get('new_password');
            const confirmPassword = formData.get('confirm_password');
            
            // Validate passwords match
            if (newPassword !== confirmPassword) {
                this.showNotification('New passwords do not match', 'error');
                return;
            }
            
            // Validate password length
            if (newPassword.length < 6) {
                this.showNotification('Password must be at least 6 characters', 'error');
                return;
            }
            
            try {
                await API.changePassword(oldPassword, newPassword);
                this.showNotification('Password changed successfully', 'success');
                modal.hide();
            } catch (error) {
                console.error('Failed to change password:', error);
                this.showNotification(error.message || 'Failed to change password', 'error');
            }
        });
        
        // Clean up modal when hidden
        document.getElementById('changePasswordModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    },
    
    // View strike history
    async viewStrikeHistory() {
        try {
            const response = await fetch('/api/users/strikes', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('flowrack_token')}`
                }
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to load strike history');
            }
            
            const strikes = data.strikes || [];
            
            const modalHtml = `
                <div class="modal fade" id="strikeHistoryModal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header bg-danger text-white">
                                <h5 class="modal-title">
                                    <i class="bi bi-exclamation-triangle"></i> Strike History
                                </h5>
                                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                ${strikes.length > 0 ? `
                                    <div class="alert alert-warning">
                                        <strong>Total Strikes:</strong> ${strikes.length}
                                    </div>
                                    <div class="table-responsive">
                                        <table class="table table-hover">
                                            <thead>
                                                <tr>
                                                    <th>Date</th>
                                                    <th>Reason</th>
                                                    <th>Request</th>
                                                    <th>Applied By</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${strikes.map(strike => `
                                                    <tr>
                                                        <td>${new Date(strike.created_at).toLocaleDateString()}</td>
                                                        <td>${strike.reason}</td>
                                                        <td>${strike.request_number || 'N/A'}</td>
                                                        <td>${strike.applied_by_name || 'System'}</td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                ` : `
                                    <div class="text-center text-success py-4">
                                        <i class="bi bi-check-circle" style="font-size: 3rem;"></i>
                                        <h5 class="mt-3">No Strikes</h5>
                                        <p class="text-muted">You have a clean record! Keep up the good work.</p>
                                    </div>
                                `}
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Remove existing modal if any
            const existingModal = document.getElementById('strikeHistoryModal');
            if (existingModal) existingModal.remove();
            
            // Add modal to DOM
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('strikeHistoryModal'));
            modal.show();
            
            // Clean up modal when hidden
            document.getElementById('strikeHistoryModal').addEventListener('hidden.bs.modal', function() {
                this.remove();
            });
            
        } catch (error) {
            console.error('Failed to load strike history:', error);
            this.showNotification('Failed to load strike history', 'error');
        }
    },
    
    // Show change password modal
    showChangePasswordModal() {
        const modalHtml = `
            <div class="modal fade" id="changePasswordModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="bi bi-key"></i> Change Password
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <form id="changePasswordForm">
                            <div class="modal-body">
                                <div class="mb-3">
                                    <label for="currentPassword" class="form-label">Current Password</label>
                                    <input type="password" class="form-control" id="currentPassword" required minlength="6">
                                </div>
                                <div class="mb-3">
                                    <label for="newPassword" class="form-label">New Password</label>
                                    <input type="password" class="form-control" id="newPassword" required minlength="6">
                                    <div class="form-text">Password must be at least 6 characters</div>
                                </div>
                                <div class="mb-3">
                                    <label for="confirmPassword" class="form-label">Confirm New Password</label>
                                    <input type="password" class="form-control" id="confirmPassword" required minlength="6">
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                <button type="submit" class="btn btn-warning">
                                    <i class="bi bi-key"></i> Change Password
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
        
        // Remove existing modal if any
        const existingModal = document.getElementById('changePasswordModal');
        if (existingModal) existingModal.remove();
        
        // Add modal to DOM
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Setup form submission
        document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.changePassword();
        });
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('changePasswordModal'));
        modal.show();
        
        // Clean up modal when hidden
        document.getElementById('changePasswordModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    },
    
    // Change password
    async changePassword() {
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (newPassword !== confirmPassword) {
            this.showNotification('New passwords do not match', 'error');
            return;
        }
        
        if (newPassword.length < 6) {
            this.showNotification('Password must be at least 6 characters', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/users/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('flowrack_token')}`
                },
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.showNotification('Password changed successfully!', 'success');
                bootstrap.Modal.getInstance(document.getElementById('changePasswordModal')).hide();
            } else {
                this.showNotification(data.error || 'Failed to change password', 'error');
            }
        } catch (error) {
            console.error('Change password error:', error);
            this.showNotification('Failed to change password. Please try again.', 'error');
        }
    },
    
    // Show edit profile modal
    async showEditProfileModal() {
        try {
            const profile = await API.getProfile();
            
            const modalHtml = `
                <div class="modal fade" id="editProfileModal" tabindex="-1">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">
                                    <i class="bi bi-pencil"></i> Edit Profile
                                </h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <form id="editProfileForm">
                                <div class="modal-body">
                                    <div class="mb-3">
                                        <label for="editFirstName" class="form-label">First Name</label>
                                        <input type="text" class="form-control" id="editFirstName" value="${profile.first_name}" required>
                                    </div>
                                    <div class="mb-3">
                                        <label for="editLastName" class="form-label">Last Name</label>
                                        <input type="text" class="form-control" id="editLastName" value="${profile.last_name}" required>
                                    </div>
                                    <div class="mb-3">
                                        <label for="editEmail" class="form-label">Email</label>
                                        <input type="email" class="form-control" id="editEmail" value="${profile.email}" required>
                                    </div>
                                    <div class="mb-3">
                                        <label for="editPhone" class="form-label">Phone</label>
                                        <input type="tel" class="form-control" id="editPhone" value="${profile.phone || ''}">
                                    </div>
                                    <div class="mb-3">
                                        <label for="editDepartment" class="form-label">Department</label>
                                        <input type="text" class="form-control" id="editDepartment" value="${profile.department || ''}">
                                    </div>
                                    <div class="alert alert-info">
                                        <small><i class="bi bi-info-circle"></i> Registration number and role cannot be changed</small>
                                    </div>
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                    <button type="submit" class="btn btn-primary">
                                        <i class="bi bi-save"></i> Save Changes
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            `;
            
            // Remove existing modal if any
            const existingModal = document.getElementById('editProfileModal');
            if (existingModal) existingModal.remove();
            
            // Add modal to DOM
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
            // Setup form submission
            document.getElementById('editProfileForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.updateProfile();
            });
            
            // Show modal
            const modal = new bootstrap.Modal(document.getElementById('editProfileModal'));
            modal.show();
            
            // Clean up modal when hidden
            document.getElementById('editProfileModal').addEventListener('hidden.bs.modal', function() {
                this.remove();
            });
            
        } catch (error) {
            console.error('Failed to load profile for editing:', error);
            this.showNotification('Failed to load profile', 'error');
        }
    },
    
    // Update profile
    async updateProfile() {
        const profileData = {
            first_name: document.getElementById('editFirstName').value.trim(),
            last_name: document.getElementById('editLastName').value.trim(),
            email: document.getElementById('editEmail').value.trim(),
            phone: document.getElementById('editPhone').value.trim(),
            department: document.getElementById('editDepartment').value.trim()
        };
        
        try {
            const response = await fetch('/api/users/update-profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('flowrack_token')}`
                },
                body: JSON.stringify(profileData)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.showNotification('Profile updated successfully!', 'success');
                bootstrap.Modal.getInstance(document.getElementById('editProfileModal')).hide();
                // Reload profile view to show updated data
                this.loadProfileView();
            } else {
                this.showNotification(data.error || 'Failed to update profile', 'error');
            }
        } catch (error) {
            console.error('Update profile error:', error);
            this.showNotification('Failed to update profile. Please try again.', 'error');
        }
    },
    
    // Handle avatar upload
    async handleAvatarUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
            this.showNotification('Please select an image file', 'error');
            return;
        }
        
        // Validate file size (2MB limit)
        if (file.size > 2 * 1024 * 1024) {
            this.showNotification('Image too large. Maximum size is 2MB', 'error');
            return;
        }
        
        try {
            // Convert to base64
            const reader = new FileReader();
            reader.onload = async (e) => {
                const avatarData = e.target.result;
                
                const response = await fetch('/api/users/upload-avatar', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('flowrack_token')}`
                    },
                    body: JSON.stringify({ avatar_data: avatarData })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    this.showNotification('Avatar uploaded successfully!', 'success');
                    // Update current user with new avatar
                    this.currentUser = await API.getProfile();
                    // Update navbar avatar
                    const avatarImg = document.getElementById('user-avatar');
                    const avatarIcon = document.getElementById('user-avatar-icon');
                    if (this.currentUser.avatar_url) {
                        avatarImg.src = this.currentUser.avatar_url;
                        avatarImg.style.display = 'inline-block';
                        avatarIcon.style.display = 'none';
                    }
                    // Reload profile view to show new avatar
                    this.loadProfileView();
                } else {
                    this.showNotification(data.error || 'Failed to upload avatar', 'error');
                }
            };
            
            reader.onerror = () => {
                this.showNotification('Failed to read image file', 'error');
            };
            
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Avatar upload error:', error);
            this.showNotification('Failed to upload avatar. Please try again.', 'error');
        }
    },
    
    // Remove avatar
    async removeAvatar() {
        if (!confirm('Are you sure you want to remove your avatar?')) {
            return;
        }
        
        try {
            const response = await fetch('/api/users/remove-avatar', {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('flowrack_token')}`
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.showNotification('Avatar removed successfully!', 'success');
                // Update current user to remove avatar
                this.currentUser = await API.getProfile();
                // Update navbar to show icon instead of avatar
                const avatarImg = document.getElementById('user-avatar');
                const avatarIcon = document.getElementById('user-avatar-icon');
                avatarImg.style.display = 'none';
                avatarIcon.style.display = 'inline';
                // Reload profile view
                this.loadProfileView();
            } else {
                this.showNotification(data.error || 'Failed to remove avatar', 'error');
            }
        } catch (error) {
            console.error('Remove avatar error:', error);
            this.showNotification('Failed to remove avatar. Please try again.', 'error');
        }
    },
    
    // Load new request view
    async loadNewRequestView() {
        try {
            // Get products for selection
            const productsData = await API.getProducts();
            const products = productsData.products || [];
            
            const dynamicContent = document.getElementById('dynamic-content');
            
            // Calculate minimum request date (tomorrow)
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const minDate = tomorrow.toISOString().split('T')[0];
            
            dynamicContent.innerHTML = `
                <div class="container-fluid">
                    <h2><i class="bi bi-file-earmark-plus"></i> New Material Request</h2>
                    <p class="text-muted">Request materials at least 1 day in advance. All requests must be approved before collection.</p>
                    
                    <form id="new-request-form">
                        <div class="row">
                            <div class="col-md-8">
                                <div class="card mb-4">
                                    <div class="card-header">
                                        <h5 class="mb-0"><i class="bi bi-box"></i> Request Items</h5>
                                    </div>
                                    <div class="card-body">
                                        <div id="request-items-container">
                                            <div class="request-item mb-3 p-3 bg-light rounded" data-item-index="0">
                                                <div class="row">
                                                    <div class="col-md-6 mb-3">
                                                        <label class="form-label">Product *</label>
                                                        <select class="form-select product-select" name="items[0][product_id]" required>
                                                            <option value="">Select a product...</option>
                                                            ${products.filter(p => p.is_active).map(p => `
                                                                <option value="${p.id}" data-stock="${p.stock_quantity}" data-unit="${p.unit_of_measure}">
                                                                    ${p.name} (Stock: ${p.stock_quantity} ${p.unit_of_measure})
                                                                </option>
                                                            `).join('')}
                                                        </select>
                                                    </div>
                                                    <div class="col-md-4 mb-3">
                                                        <label class="form-label">Quantity *</label>
                                                        <input type="number" class="form-control quantity-input" 
                                                               name="items[0][quantity]" step="0.01" min="0.01" required>
                                                        <small class="text-muted unit-display">Unit: -</small>
                                                    </div>
                                                    <div class="col-md-2 mb-3">
                                                        <label class="form-label">&nbsp;</label>
                                                        <button type="button" class="btn btn-danger btn-sm w-100 remove-item-btn" 
                                                                onclick="App.removeRequestItem(0)" disabled>
                                                            <i class="bi bi-trash"></i>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <button type="button" class="btn btn-outline-primary btn-sm" onclick="App.addRequestItem()">
                                            <i class="bi bi-plus-circle"></i> Add Another Item
                                        </button>
                                    </div>
                                </div>
                                
                                <div class="card mb-4">
                                    <div class="card-header">
                                        <h5 class="mb-0"><i class="bi bi-calendar-event"></i> Schedule & Details</h5>
                                    </div>
                                    <div class="card-body">
                                        <div class="row">
                                            <div class="col-md-6 mb-3">
                                                <label class="form-label">Collection Date *</label>
                                                <input type="date" class="form-control" name="collection_date" 
                                                       min="${minDate}" required>
                                                <small class="text-muted">Minimum 1 day in advance</small>
                                            </div>
                                            <div class="col-md-6 mb-3">
                                                <label class="form-label">Collection Time *</label>
                                                <input type="time" class="form-control" name="collection_time" required>
                                            </div>
                                        </div>
                                        
                                        <div class="row">
                                            <div class="col-md-6 mb-3">
                                                <label class="form-label">Expected Return Date *</label>
                                                <input type="date" class="form-control" name="return_date" 
                                                       min="${minDate}" required>
                                            </div>
                                            <div class="col-md-6 mb-3">
                                                <label class="form-label">Expected Return Time *</label>
                                                <input type="time" class="form-control" name="return_time" required>
                                                <small class="text-muted text-danger">⚠️ Late returns result in strikes</small>
                                            </div>
                                        </div>
                                        
                                        <div class="mb-3">
                                            <label class="form-label">Supervising Instructor</label>
                                            <input type="text" class="form-control" name="supervising_instructor" 
                                                   placeholder="Name of instructor/supervisor">
                                        </div>
                                        
                                        <div class="mb-3">
                                            <label class="form-label">Purpose/Reason for Request *</label>
                                            <textarea class="form-control" name="purpose" rows="3" 
                                                      placeholder="Explain why you need these materials..." required></textarea>
                                        </div>
                                        
                                        <div class="mb-3">
                                            <label class="form-label">Additional Notes</label>
                                            <textarea class="form-control" name="notes" rows="2" 
                                                      placeholder="Any special instructions or notes..."></textarea>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="col-md-4">
                                <div class="card bg-info text-white mb-3">
                                    <div class="card-body">
                                        <h6><i class="bi bi-info-circle"></i> Important Information</h6>
                                        <ul class="small mb-0">
                                            <li>Requests must be made at least <strong>1 day in advance</strong></li>
                                            <li>Return materials <strong>on time</strong> to avoid strikes</li>
                                            <li>Late returns = <strong>1 strike</strong> per incident</li>
                                            <li>Damaged items = <strong>debt charge</strong></li>
                                            <li>A <strong>QR code</strong> will be generated for pickup</li>
                                            <li>Show QR code to warehouse operator</li>
                                        </ul>
                                    </div>
                                </div>
                                
                                <div class="card bg-warning text-dark mb-3">
                                    <div class="card-body">
                                        <h6><i class="bi bi-exclamation-triangle"></i> Strike Policy</h6>
                                        <p class="small mb-2">Strikes are issued for:</p>
                                        <ul class="small mb-0">
                                            <li>Returning materials late</li>
                                            <li>Not showing up for pickup</li>
                                            <li>Policy violations</li>
                                        </ul>
                                        <hr>
                                        <p class="small mb-0"><strong>Your current strikes: ${this.currentUser.strikes || 0}</strong></p>
                                    </div>
                                </div>
                                
                                <div class="card">
                                    <div class="card-body">
                                        <button type="submit" class="btn btn-primary w-100 mb-2">
                                            <i class="bi bi-send"></i> Submit Request
                                        </button>
                                        <button type="button" class="btn btn-secondary w-100" onclick="App.showView('dashboard')">
                                            <i class="bi bi-x-circle"></i> Cancel
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
            `;
            
            // Setup form handlers
            this.setupRequestFormHandlers();
            
        } catch (error) {
            console.error('Failed to load new request view:', error);
            this.showNotification('Failed to load request form', 'error');
        }
    },
    
    // Setup handlers for request form
    setupRequestFormHandlers() {
        // Product selection change handler
        document.querySelectorAll('.product-select').forEach(select => {
            select.addEventListener('change', function() {
                const selectedOption = this.options[this.selectedIndex];
                const unitDisplay = this.closest('.request-item').querySelector('.unit-display');
                
                if (selectedOption.value) {
                    const unit = selectedOption.dataset.unit;
                    unitDisplay.textContent = `Unit: ${unit}`;
                } else {
                    unitDisplay.textContent = 'Unit: -';
                }
            });
        });
        
        // Form submission
        document.getElementById('new-request-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.submitNewRequest(e.target);
        });
        
        // Validate return date is after collection date
        const collectionDate = document.querySelector('input[name="collection_date"]');
        const returnDate = document.querySelector('input[name="return_date"]');
        
        collectionDate.addEventListener('change', () => {
            returnDate.min = collectionDate.value;
            if (returnDate.value && returnDate.value < collectionDate.value) {
                returnDate.value = collectionDate.value;
            }
        });
    },
    
    // Add request item
    addRequestItem() {
        const container = document.getElementById('request-items-container');
        const itemCount = container.children.length;
        
        // Get products for the new item
        const firstSelect = container.querySelector('.product-select');
        const productOptions = firstSelect.innerHTML;
        
        const newItem = document.createElement('div');
        newItem.className = 'request-item mb-3 p-3 bg-light rounded';
        newItem.dataset.itemIndex = itemCount;
        newItem.innerHTML = `
            <div class="row">
                <div class="col-md-6 mb-3">
                    <label class="form-label">Product *</label>
                    <select class="form-select product-select" name="items[${itemCount}][product_id]" required>
                        ${productOptions}
                    </select>
                </div>
                <div class="col-md-4 mb-3">
                    <label class="form-label">Quantity *</label>
                    <input type="number" class="form-control quantity-input" 
                           name="items[${itemCount}][quantity]" step="0.01" min="0.01" required>
                    <small class="text-muted unit-display">Unit: -</small>
                </div>
                <div class="col-md-2 mb-3">
                    <label class="form-label">&nbsp;</label>
                    <button type="button" class="btn btn-danger btn-sm w-100 remove-item-btn" 
                            onclick="App.removeRequestItem(${itemCount})">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
        `;
        
        container.appendChild(newItem);
        
        // Setup product select handler for new item
        const newSelect = newItem.querySelector('.product-select');
        newSelect.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            const unitDisplay = newItem.querySelector('.unit-display');
            
            if (selectedOption.value) {
                const unit = selectedOption.dataset.unit;
                unitDisplay.textContent = `Unit: ${unit}`;
            } else {
                unitDisplay.textContent = 'Unit: -';
            }
        });
        
        // Enable remove button on first item if there are now multiple items
        if (itemCount > 0) {
            document.querySelector('.remove-item-btn').disabled = false;
        }
    },
    
    // Remove request item
    removeRequestItem(index) {
        const container = document.getElementById('request-items-container');
        const item = container.querySelector(`[data-item-index="${index}"]`);
        
        if (container.children.length > 1) {
            item.remove();
            
            // Disable remove button on first item if only one remains
            if (container.children.length === 1) {
                container.querySelector('.remove-item-btn').disabled = true;
            }
        }
    },
    
    // Submit new request
    async submitNewRequest(form) {
        try {
            const formData = new FormData(form);
            
            // Parse items
            const items = [];
            let itemIndex = 0;
            
            while (formData.has(`items[${itemIndex}][product_id]`)) {
                const productId = parseInt(formData.get(`items[${itemIndex}][product_id]`));
                const quantity = parseFloat(formData.get(`items[${itemIndex}][quantity]`));
                
                if (productId && quantity) {
                    items.push({
                        product_id: productId,
                        requested_quantity: quantity
                    });
                }
                itemIndex++;
            }
            
            if (items.length === 0) {
                this.showNotification('Please add at least one item to the request', 'error');
                return;
            }
            
            // Combine date and time for collection and return
            const collectionDate = formData.get('collection_date');
            const collectionTime = formData.get('collection_time');
            const returnDate = formData.get('return_date');
            const returnTime = formData.get('return_time');
            
            const requestData = {
                items: items,
                requested_date: collectionDate,
                requested_time: collectionTime,
                expected_return_datetime: `${returnDate} ${returnTime}`,
                purpose: formData.get('purpose'),
                supervising_instructor: formData.get('supervising_instructor') || null,
                notes: formData.get('notes') || null
            };
            
            // Show loading
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Submitting...';
            
            const result = await API.createRequest(requestData);
            
            this.showNotification('Request submitted successfully! Check your requests for the QR code.', 'success');
            
            // Redirect to requests view
            setTimeout(() => {
                this.showView('requests');
            }, 1500);
            
        } catch (error) {
            console.error('Failed to submit request:', error);
            this.showNotification(error.message || 'Failed to submit request', 'error');
            
            // Re-enable submit button
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="bi bi-send"></i> Submit Request';
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
        
        // Ctrl/Cmd + Q for Quick Scan Mode (operators/admins only)
        if ((e.ctrlKey || e.metaKey) && e.key === 'q') {
            e.preventDefault();
            if (this.currentUser && (this.currentUser.role === 'operator' || this.currentUser.role === 'admin')) {
                this.showQuickScanModal();
            }
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
    
    // Load Admin Strikes Management View
    async loadAdminStrikesView() {
        try {
            const response = await fetch('/api/users/all-strikes', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('flowrack_token')}`
                }
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to load strikes data');
            }
            
            const usersWithStrikes = data.users || [];
            
            const dynamicContent = document.getElementById('dynamic-content');
            
            dynamicContent.innerHTML = `
                <div class="container-fluid py-4">
                    <div class="row mb-4">
                        <div class="col">
                            <h2><i class="bi bi-shield-exclamation"></i> Strike Management</h2>
                            <p class="text-muted">View and manage user strikes across the system</p>
                        </div>
                    </div>
                    
                    <div class="row mb-4">
                        <div class="col-md-4">
                            <div class="card text-center">
                                <div class="card-body">
                                    <h3 class="text-danger">${usersWithStrikes.reduce((sum, u) => sum + (u.strikes || 0), 0)}</h3>
                                    <p class="text-muted mb-0">Total Strikes</p>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="card text-center">
                                <div class="card-body">
                                    <h3 class="text-warning">${usersWithStrikes.filter(u => (u.strikes || 0) > 0).length}</h3>
                                    <p class="text-muted mb-0">Users with Strikes</p>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="card text-center">
                                <div class="card-body">
                                    <h3 class="text-info">${usersWithStrikes.filter(u => (u.strikes || 0) >= 3).length}</h3>
                                    <p class="text-muted mb-0">Users with 3+ Strikes</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card">
                        <div class="card-header">
                            <h5 class="mb-0"><i class="bi bi-people"></i> Users with Strikes</h5>
                        </div>
                        <div class="card-body">
                            ${usersWithStrikes.filter(u => (u.strikes || 0) > 0).length > 0 ? `
                                <div class="table-responsive">
                                    <table class="table table-hover">
                                        <thead>
                                            <tr>
                                                <th>User</th>
                                                <th>Registration</th>
                                                <th>Department</th>
                                                <th class="text-center">Strikes</th>
                                                <th class="text-center">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${usersWithStrikes.filter(u => (u.strikes || 0) > 0).map(user => `
                                                <tr>
                                                    <td>${user.first_name} ${user.last_name}</td>
                                                    <td><strong>${user.registration_number}</strong></td>
                                                    <td>${user.department || 'N/A'}</td>
                                                    <td class="text-center">
                                                        <span class="badge bg-danger fs-6">${user.strikes}</span>
                                                    </td>
                                                    <td class="text-center">
                                                        <button class="btn btn-sm btn-outline-primary" 
                                                                onclick="App.viewUserStrikeDetails(${user.id}, '${user.first_name} ${user.last_name}')">
                                                            <i class="bi bi-eye"></i> View
                                                        </button>
                                                        <button class="btn btn-sm btn-outline-danger" 
                                                                onclick="App.clearUserStrikes(${user.id}, '${user.first_name} ${user.last_name}')">
                                                            <i class="bi bi-x-circle"></i> Clear
                                                        </button>
                                                    </td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            ` : `
                                <div class="text-center text-success py-5">
                                    <i class="bi bi-check-circle" style="font-size: 3rem;"></i>
                                    <h5 class="mt-3">No Active Strikes</h5>
                                    <p class="text-muted">All users have clean records!</p>
                                </div>
                            `}
                        </div>
                    </div>
                </div>
            `;
            
        } catch (error) {
            console.error('Failed to load admin strikes view:', error);
            this.showNotification('Failed to load strikes data', 'error');
        }
    },
    
    // View user strike details (admin only)
    async viewUserStrikeDetails(userId, userName) {
        try {
            const response = await fetch(`/api/users/${userId}/strikes`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('flowrack_token')}`
                }
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to load strike details');
            }
            
            const strikes = data.strikes || [];
            
            const modalHtml = `
                <div class="modal fade" id="userStrikeDetailsModal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header bg-primary text-white">
                                <h5 class="modal-title">
                                    <i class="bi bi-person"></i> Strike Details - ${userName}
                                </h5>
                                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="alert alert-info">
                                    <strong>Total Strikes:</strong> ${strikes.length}
                                </div>
                                ${strikes.length > 0 ? `
                                    <div class="table-responsive">
                                        <table class="table table-sm">
                                            <thead>
                                                <tr>
                                                    <th>Date</th>
                                                    <th>Reason</th>
                                                    <th>Request</th>
                                                    <th>Applied By</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${strikes.map(strike => `
                                                    <tr>
                                                        <td>${new Date(strike.created_at).toLocaleDateString()}</td>
                                                        <td>${strike.reason}</td>
                                                        <td>${strike.request_number || 'N/A'}</td>
                                                        <td>${strike.applied_by_name || 'System'}</td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                ` : `
                                    <p class="text-muted text-center">No strikes found</p>
                                `}
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Remove existing modal
            const existingModal = document.getElementById('userStrikeDetailsModal');
            if (existingModal) existingModal.remove();
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            const modal = new bootstrap.Modal(document.getElementById('userStrikeDetailsModal'));
            modal.show();
            
            document.getElementById('userStrikeDetailsModal').addEventListener('hidden.bs.modal', function() {
                this.remove();
            });
            
        } catch (error) {
            console.error('Failed to load user strike details:', error);
            this.showNotification('Failed to load strike details', 'error');
        }
    },
    
    // Clear user strikes (admin only)
    async clearUserStrikes(userId, userName) {
        if (!confirm(`Are you sure you want to clear all strikes for ${userName}? This action cannot be undone.`)) {
            return;
        }
        
        try {
            const response = await fetch(`/api/users/${userId}/strikes`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('flowrack_token')}`
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.showNotification(`Strikes cleared for ${userName}`, 'success');
                this.loadAdminStrikesView(); // Reload view
            } else {
                throw new Error(data.error || 'Failed to clear strikes');
            }
        } catch (error) {
            console.error('Failed to clear strikes:', error);
            this.showNotification(error.message || 'Failed to clear strikes', 'error');
        }
    },
    
    // Load pending users view (admin only)
    async loadPendingUsersView() {
        try {
            const response = await fetch('/api/users/pending', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('flowrack_token')}`
                }
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to load pending users');
            }
            
            const users = data.users || [];
            const dynamicContent = document.getElementById('dynamic-content');
            
            dynamicContent.innerHTML = `
                <div class="container-fluid">
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <h2><i class="bi bi-person-check"></i> Pending User Registrations</h2>
                        <span class="badge bg-warning fs-6">${users.length} Pending</span>
                    </div>
                    
                    ${users.length === 0 ? `
                        <div class="alert alert-info">
                            <i class="bi bi-info-circle"></i> No pending user registrations
                        </div>
                    ` : `
                        <div class="row">
                            ${users.map(user => `
                                <div class="col-md-6 col-lg-4 mb-3">
                                    <div class="card h-100">
                                        <div class="card-header bg-warning text-dark">
                                            <h5 class="mb-0">
                                                <i class="bi bi-person"></i> ${user.first_name} ${user.last_name}
                                            </h5>
                                        </div>
                                        <div class="card-body">
                                            <dl class="row mb-0">
                                                <dt class="col-sm-5">Registration Number:</dt>
                                                <dd class="col-sm-7"><strong>${user.registration_number}</strong></dd>
                                                
                                                <dt class="col-sm-5">Email:</dt>
                                                <dd class="col-sm-7">${user.email}</dd>
                                                
                                                ${user.phone ? `
                                                    <dt class="col-sm-5">Phone:</dt>
                                                    <dd class="col-sm-7">${user.phone}</dd>
                                                ` : ''}
                                                
                                                ${user.department ? `
                                                    <dt class="col-sm-5">Department:</dt>
                                                    <dd class="col-sm-7">${user.department}</dd>
                                                ` : ''}
                                                
                                                <dt class="col-sm-5">Registered:</dt>
                                                <dd class="col-sm-7">${new Date(user.created_at).toLocaleDateString()}</dd>
                                            </dl>
                                        </div>
                                        <div class="card-footer">
                                            <div class="d-grid gap-2">
                                                <button class="btn btn-success" onclick="App.approveUser(${user.id}, '${user.first_name} ${user.last_name}')">
                                                    <i class="bi bi-check-circle"></i> Approve
                                                </button>
                                                <button class="btn btn-danger" onclick="App.rejectUser(${user.id}, '${user.registration_number}')">
                                                    <i class="bi bi-x-circle"></i> Reject
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
            `;
        } catch (error) {
            console.error('Failed to load pending users:', error);
            this.showNotification('Failed to load pending users', 'error');
        }
    },
    
    // Approve user (admin only)
    async approveUser(userId, userName) {
        if (!confirm(`Approve registration for ${userName}?`)) {
            return;
        }
        
        try {
            const response = await fetch(`/api/users/${userId}/approve`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('flowrack_token')}`
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.showNotification(`${userName} approved successfully!`, 'success');
                this.loadPendingUsersView(); // Reload view
            } else {
                throw new Error(data.error || 'Failed to approve user');
            }
        } catch (error) {
            console.error('Failed to approve user:', error);
            this.showNotification(error.message || 'Failed to approve user', 'error');
        }
    },
    
    // Reject user (admin only)
    async rejectUser(userId, registrationNumber) {
        if (!confirm(`Reject and delete registration for ${registrationNumber}? This cannot be undone.`)) {
            return;
        }
        
        try {
            const response = await fetch(`/api/users/${userId}/reject`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('flowrack_token')}`
                }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.showNotification(`Registration for ${registrationNumber} rejected`, 'success');
                this.loadPendingUsersView(); // Reload view
            } else {
                throw new Error(data.error || 'Failed to reject user');
            }
        } catch (error) {
            console.error('Failed to reject user:', error);
            this.showNotification(error.message || 'Failed to reject user', 'error');
        }
    },
    
    // Load QR Scanner View for operators
    async loadQRScannerView() {
        const dynamicContent = document.getElementById('dynamic-content');
        
        dynamicContent.innerHTML = `
            <div class="container-fluid py-4">
                <div class="row mb-4">
                    <div class="col">
                        <h2><i class="bi bi-qr-code-scan"></i> QR Scanner</h2>
                        <p class="text-muted">Scan QR codes to deliver or return materials</p>
                    </div>
                </div>
                
                <div class="row">
                    <!-- Scanner Card -->
                    <div class="col-lg-5 mb-4">
                        <div class="card shadow-sm">
                            <div class="card-header bg-primary text-white">
                                <h5 class="mb-0"><i class="bi bi-camera"></i> Scanner</h5>
                            </div>
                            <div class="card-body">
                                <!-- Camera Scanner -->
                                <div id="camera-scanner-section" class="mb-3">
                                    <div id="camera-view" style="display: none;">
                                        <div class="position-relative">
                                            <video id="qr-video" class="w-100 rounded" style="max-height: 400px; background: #000;"></video>
                                            <canvas id="qr-canvas" class="position-absolute top-0 start-0 w-100" style="max-height: 400px;"></canvas>
                                        </div>
                                        <div class="d-grid gap-2 mt-3">
                                            <button class="btn btn-danger" onclick="App.stopCamera()">
                                                <i class="bi bi-camera-video-off"></i> Stop Camera
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div id="camera-start" class="text-center">
                                        <i class="bi bi-camera-video" style="font-size: 3rem; color: #0d6efd;"></i>
                                        <p class="mt-3">Use your camera to scan QR codes</p>
                                        <button class="btn btn-primary" onclick="App.startCamera()">
                                            <i class="bi bi-camera-video"></i> Start Camera
                                        </button>
                                        <p class="text-muted small mt-2">
                                            <i class="bi bi-info-circle"></i> You may be asked for camera permission
                                        </p>
                                    </div>
                                </div>
                                
                                <hr>
                                
                                <!-- Manual QR Code Input -->
                                <div class="mb-3">
                                    <label for="qr-code-input" class="form-label">Or Enter QR Code Manually</label>
                                    <div class="input-group">
                                        <input type="text" class="form-control" id="qr-code-input" placeholder="Paste or type QR code here">
                                        <button class="btn btn-primary" onclick="App.scanQRCode()">
                                            <i class="bi bi-search"></i> Scan
                                        </button>
                                    </div>
                                    <small class="text-muted">You can also press Enter to scan</small>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Results Card -->
                    <div class="col-lg-7">
                        <div id="scan-results" class="d-none">
                            <div class="card shadow-sm">
                                <div class="card-header bg-success text-white">
                                    <h5 class="mb-0"><i class="bi bi-check-circle"></i> Request Found</h5>
                                </div>
                                <div class="card-body" id="scan-results-content">
                                    <!-- Results will be loaded here -->
                                </div>
                            </div>
                        </div>
                        
                        <div id="scan-error" class="d-none">
                            <div class="alert alert-danger">
                                <i class="bi bi-exclamation-triangle"></i>
                                <span id="scan-error-message"></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add enter key handler
        document.getElementById('qr-code-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.scanQRCode();
            }
        });
        
        // Focus input
        document.getElementById('qr-code-input').focus();
        
        // Initialize camera scanner variable
        this.cameraScanner = null;
    },
    
    // Start camera for QR scanning
    async startCamera() {
        // Check if camera is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.showNotification('Camera not supported in this browser', 'error');
            return;
        }
        
        try {
            const videoElement = document.getElementById('qr-video');
            const canvasElement = document.getElementById('qr-canvas');
            
            // Show camera view, hide start button
            document.getElementById('camera-start').style.display = 'none';
            document.getElementById('camera-view').style.display = 'block';
            
            // Initialize QR scanner
            if (window.QRScanner) {
                this.cameraScanner = new QRScanner(videoElement, canvasElement, (qrCode) => {
                    // QR code detected
                    this.showNotification('QR code detected!', 'success');
                    this.stopCamera();
                    document.getElementById('qr-code-input').value = qrCode;
                    this.scanQRCode();
                });
                
                await this.cameraScanner.start();
                this.showNotification('Camera started. Point at QR code.', 'info');
            } else {
                // Fallback if QR scanner library not loaded
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: 'environment' } 
                });
                videoElement.srcObject = stream;
                videoElement.play();
                
                this.showNotification('Camera started. jsQR library not loaded - manual input required.', 'warning');
            }
            
        } catch (error) {
            console.error('Camera error:', error);
            this.showNotification('Failed to access camera: ' + error.message, 'error');
            this.stopCamera();
        }
    },
    
    // Stop camera
    stopCamera() {
        if (this.cameraScanner) {
            this.cameraScanner.stop();
            this.cameraScanner = null;
        }
        
        // Hide camera view, show start button
        document.getElementById('camera-view').style.display = 'none';
        document.getElementById('camera-start').style.display = 'block';
    },
    
    // Scan QR Code
    async scanQRCode() {
        const input = document.getElementById('qr-code-input');
        const qrCode = input.value.trim();
        
        if (!qrCode) {
            this.showNotification('Please enter a QR code', 'warning');
            return;
        }
        
        try {
            const response = await fetch('/api/requests/scan-qr', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('flowrack_token')}`
                },
                body: JSON.stringify({ qr_code: qrCode })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.showRequestScanResult(data.request);
                this.showNotification('QR code scanned successfully!', 'success');
            } else {
                this.showScanError(data.error || 'Invalid QR code');
            }
        } catch (error) {
            console.error('Scan QR error:', error);
            this.showScanError('Failed to scan QR code. Please try again.');
        }
    },
    
    // Show scan result
    showRequestScanResult(request) {
        document.getElementById('scan-error').classList.add('d-none');
        document.getElementById('scan-results').classList.remove('d-none');
        
        const resultsContent = document.getElementById('scan-results-content');
        
        // Get user info
        const userName = request.user ? `${request.user.first_name} ${request.user.last_name}` : 'Unknown';
        const userReg = request.user ? request.user.registration_number : '';
        
        // Calculate status badge
        const statusBadge = this.getStatusBadge(request.status);
        
        // Format dates
        const requestedDate = request.requested_date ? new Date(request.requested_date).toLocaleDateString() : 'N/A';
        const requestedTime = request.requested_time || 'N/A';
        const expectedReturn = request.expected_return_datetime ? 
            new Date(request.expected_return_datetime).toLocaleString() : 'Not set';
        
        // Build items list
        const itemsHTML = request.items.map(item => `
            <tr>
                <td>${item.product_name}</td>
                <td class="text-center">${item.requested_quantity} ${item.unit_of_measure}</td>
            </tr>
        `).join('');
        
        resultsContent.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <h6>Request Information</h6>
                    <dl class="row">
                        <dt class="col-sm-5">Request #:</dt>
                        <dd class="col-sm-7"><strong>${request.request_number}</strong></dd>
                        
                        <dt class="col-sm-5">Status:</dt>
                        <dd class="col-sm-7">${statusBadge}</dd>
                        
                        <dt class="col-sm-5">User:</dt>
                        <dd class="col-sm-7">${userName} <small class="text-muted">(${userReg})</small></dd>
                        
                        <dt class="col-sm-5">Requested For:</dt>
                        <dd class="col-sm-7">${requestedDate} ${requestedTime}</dd>
                        
                        <dt class="col-sm-5">Expected Return:</dt>
                        <dd class="col-sm-7">${expectedReturn}</dd>
                    </dl>
                </div>
                
                <div class="col-md-6">
                    <h6>Items Requested</h6>
                    <table class="table table-sm">
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th class="text-center">Quantity</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHTML}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <hr>
            
            <div class="row">
                <div class="col-12">
                    <h6>Actions</h6>
                    <div class="btn-group w-100" role="group">
                        ${request.status === 'pending' || request.status === 'approved' ? `
                            <button class="btn btn-success" onclick="App.deliverMaterial(${request.id})">
                                <i class="bi bi-box-arrow-right"></i> Deliver Material
                            </button>
                        ` : ''}
                        
                        ${request.status === 'delivered' ? `
                            <button class="btn btn-primary" onclick="App.showReturnForm(${request.id})">
                                <i class="bi bi-box-arrow-in-left"></i> Process Return
                            </button>
                        ` : ''}
                        
                        ${request.status === 'delivered' ? `
                            <button class="btn btn-warning" onclick="App.showExtendReturnForm(${request.id})">
                                <i class="bi bi-clock"></i> Extend Return Time
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    },
    
    // Show scan error
    showScanError(message) {
        document.getElementById('scan-results').classList.add('d-none');
        document.getElementById('scan-error').classList.remove('d-none');
        document.getElementById('scan-error-message').textContent = message;
    },
    
    // Deliver material
    async deliverMaterial(requestId) {
        if (!confirm('Confirm material delivery? This will mark the request as IN USE.')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/requests/${requestId}/deliver`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('flowrack_token')}`
                },
                body: JSON.stringify({
                    notes: 'Material delivered via QR scanner'
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.showNotification('Material delivered successfully!', 'success');
                // Refresh the scan result
                this.showRequestScanResult(data.request);
            } else {
                this.showNotification(data.error || 'Failed to deliver material', 'error');
            }
        } catch (error) {
            console.error('Deliver material error:', error);
            this.showNotification('Failed to deliver material', 'error');
        }
    },
    
    // Show return form
    showReturnForm(requestId) {
        const resultsContent = document.getElementById('scan-results-content');
        
        resultsContent.innerHTML = `
            <h5 class="mb-3">Process Material Return</h5>
            <form id="return-form" onsubmit="return false;">
                <input type="hidden" id="return-request-id" value="${requestId}">
                
                <div class="mb-3">
                    <label for="material-condition" class="form-label"><strong>Material Condition *</strong></label>
                    <select class="form-select" id="material-condition" required>
                        <option value="">Select condition...</option>
                        <option value="good">✓ Good - No damage, full return</option>
                        <option value="damaged">⚠ Damaged - Partial damage, usable with repairs</option>
                        <option value="broken">✗ Broken - Complete loss, not usable</option>
                    </select>
                    <small class="text-muted">This will affect penalties and stock return</small>
                </div>
                
                <div class="mb-3" id="damage-details-section" style="display: none;">
                    <label for="damage-description" class="form-label">Damage Description *</label>
                    <textarea class="form-control" id="damage-description" rows="3" 
                        placeholder="Describe the damage in detail..."></textarea>
                </div>
                
                <div class="mb-3">
                    <label for="return-notes" class="form-label">Additional Notes</label>
                    <textarea class="form-control" id="return-notes" rows="2" 
                        placeholder="Any additional observations..."></textarea>
                </div>
                
                <div class="alert alert-info">
                    <strong>Penalty Information:</strong>
                    <ul class="mb-0 mt-2">
                        <li><strong>Late Return:</strong> +1 strike to user</li>
                        <li><strong>Damaged Material:</strong> Debt = 50% of material cost</li>
                        <li><strong>Broken Material:</strong> Debt = 100% of material cost</li>
                    </ul>
                </div>
                
                <div class="d-grid gap-2">
                    <button type="button" class="btn btn-primary btn-lg" onclick="App.submitReturn()">
                        <i class="bi bi-check-circle"></i> Complete Return
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="App.loadQRScannerView()">
                        Cancel
                    </button>
                </div>
            </form>
        `;
        
        // Add condition change handler
        document.getElementById('material-condition').addEventListener('change', (e) => {
            const damageSection = document.getElementById('damage-details-section');
            const damageDesc = document.getElementById('damage-description');
            
            if (e.target.value === 'damaged' || e.target.value === 'broken') {
                damageSection.style.display = 'block';
                damageDesc.required = true;
            } else {
                damageSection.style.display = 'none';
                damageDesc.required = false;
            }
        });
    },
    
    // Submit return
    async submitReturn() {
        const requestId = document.getElementById('return-request-id').value;
        const condition = document.getElementById('material-condition').value;
        const damageDescription = document.getElementById('damage-description').value;
        const notes = document.getElementById('return-notes').value;
        
        if (!condition) {
            this.showNotification('Please select material condition', 'warning');
            return;
        }
        
        if ((condition === 'damaged' || condition === 'broken') && !damageDescription) {
            this.showNotification('Please describe the damage', 'warning');
            return;
        }
        
        if (!confirm(`Confirm return with condition: ${condition.toUpperCase()}?`)) {
            return;
        }
        
        try {
            const response = await fetch(`/api/requests/${requestId}/return`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('flowrack_token')}`
                },
                body: JSON.stringify({
                    condition: condition,
                    damage_description: damageDescription,
                    notes: notes
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                let message = 'Material return processed successfully!';
                if (data.penalties && data.penalties.length > 0) {
                    message += '\n\nPenalties applied:\n' + data.penalties.join('\n');
                }
                
                alert(message);
                this.showNotification('Return processed successfully', 'success');
                
                // Refresh scanner view
                this.loadQRScannerView();
            } else {
                this.showNotification(data.error || 'Failed to process return', 'error');
            }
        } catch (error) {
            console.error('Submit return error:', error);
            this.showNotification('Failed to process return', 'error');
        }
    },
    
    // Show extend return time form
    showExtendReturnForm(requestId) {
        const resultsContent = document.getElementById('scan-results-content');
        
        // Calculate minimum datetime (current time)
        const now = new Date();
        const minDatetime = now.toISOString().slice(0, 16);
        
        resultsContent.innerHTML = `
            <h5 class="mb-3">Extend Return Time</h5>
            <form id="extend-form" onsubmit="return false;">
                <input type="hidden" id="extend-request-id" value="${requestId}">
                
                <div class="mb-3">
                    <label for="new-return-datetime" class="form-label"><strong>New Return Date & Time *</strong></label>
                    <input type="datetime-local" class="form-control" id="new-return-datetime" 
                        min="${minDatetime}" required>
                    <small class="text-muted">Select the new expected return date and time</small>
                </div>
                
                <div class="d-grid gap-2">
                    <button type="button" class="btn btn-warning btn-lg" onclick="App.submitExtendReturn()">
                        <i class="bi bi-clock"></i> Extend Return Time
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="App.loadQRScannerView()">
                        Cancel
                    </button>
                </div>
            </form>
        `;
    },
    
    // Submit extend return time
    async submitExtendReturn() {
        const requestId = document.getElementById('extend-request-id').value;
        const newDatetime = document.getElementById('new-return-datetime').value;
        
        if (!newDatetime) {
            this.showNotification('Please select a new return datetime', 'warning');
            return;
        }
        
        try {
            const response = await fetch(`/api/requests/${requestId}/extend-return`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('flowrack_token')}`
                },
                body: JSON.stringify({
                    new_return_datetime: newDatetime.replace('T', ' ')
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.showNotification('Return time extended successfully!', 'success');
                // Refresh scanner view
                this.loadQRScannerView();
            } else {
                this.showNotification(data.error || 'Failed to extend return time', 'error');
            }
        } catch (error) {
            console.error('Extend return error:', error);
            this.showNotification('Failed to extend return time', 'error');
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
        localStorage.removeItem('flowrack_user');
        localStorage.removeItem('flowrack_preferences');
        this.currentUser = null;
        
        // Clear all cached data
        this.clearAllData();
        
        // Reset UI
        document.body.className = '';
        
        // Show login view
        this.showView('login');
        
        // Disconnect WebSocket
        if (this.socket) {
            this.socket.disconnect();
        }
        
        this.showNotification('Logged out successfully', 'info');
    },
    
    // Clear all cached data from DOM
    clearAllData() {
        // Clear recent activity
        const recentActivity = document.getElementById('recent-activity');
        if (recentActivity) {
            recentActivity.innerHTML = '';
        }
        
        // Clear dashboard stats
        const dashboardStats = document.querySelectorAll('.stat-value, .stat-card h3, .stat-card p');
        dashboardStats.forEach(stat => {
            if (stat.classList.contains('stat-value') || stat.tagName === 'H3') {
                stat.textContent = '0';
            }
        });
        
        // Clear all table bodies
        const tableBodies = document.querySelectorAll('tbody');
        tableBodies.forEach(tbody => {
            tbody.innerHTML = '';
        });
        
        // Clear all lists
        const lists = document.querySelectorAll('.list-group, .activity-list, .request-list');
        lists.forEach(list => {
            list.innerHTML = '';
        });
        
        // Clear any charts if they exist
        if (window.charts) {
            Object.values(window.charts).forEach(chart => {
                if (chart && chart.destroy) {
                    chart.destroy();
                }
            });
            window.charts = {};
        }
        
        // Clear user-specific elements
        const userElements = document.querySelectorAll('[data-user-content]');
        userElements.forEach(el => {
            el.innerHTML = '';
        });
    },
    
    // Operator Dashboard Views
    
    async loadPendingDeliveriesView() {
        try {
            const data = await API.getPendingDeliveries();
            const dynamicContent = document.getElementById('dynamic-content');
            
            dynamicContent.innerHTML = `
                <div class="container-fluid">
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <h2><i class="bi bi-hourglass-split"></i> Pending Deliveries</h2>
                        <span class="badge bg-primary fs-5">${data.count} pending</span>
                    </div>
                    
                    ${data.pending_deliveries.length === 0 ? `
                        <div class="alert alert-info">
                            <i class="bi bi-info-circle"></i> No pending deliveries at this time. All approved requests have been picked up!
                        </div>
                    ` : `
                        <div class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4">
                            ${data.pending_deliveries.map(delivery => `
                                <div class="col">
                                    <div class="card h-100 ${delivery.priority === 'high' ? 'border-danger' : delivery.priority === 'urgent' ? 'border-warning' : ''}">
                                        <div class="card-header d-flex justify-content-between align-items-center">
                                            <span class="fw-bold">${delivery.request_number}</span>
                                            ${delivery.priority !== 'normal' ? `<span class="badge bg-${delivery.priority === 'urgent' ? 'warning' : 'danger'}">${delivery.priority.toUpperCase()}</span>` : ''}
                                        </div>
                                        <div class="card-body">
                                            <h6 class="card-title"><i class="bi bi-person"></i> ${delivery.user_name}</h6>
                                            <p class="card-text text-muted small mb-2">
                                                <i class="bi bi-building"></i> ${delivery.department || 'N/A'}<br>
                                                <i class="bi bi-telephone"></i> ${delivery.phone || 'N/A'}
                                            </p>
                                            <p class="card-text">${delivery.purpose || 'No purpose specified'}</p>
                                            <div class="small text-muted mb-2">
                                                <i class="bi bi-box"></i> ${delivery.item_count} item${delivery.item_count !== 1 ? 's' : ''}
                                            </div>
                                            ${delivery.expected_return ? `
                                                <div class="small mb-2">
                                                    <i class="bi bi-calendar-event"></i> Return: ${new Date(delivery.expected_return).toLocaleString()}
                                                </div>
                                            ` : ''}
                                            <div class="small text-muted">
                                                <i class="bi bi-clock"></i> Requested: ${new Date(delivery.created_at).toLocaleString()}
                                            </div>
                                            ${delivery.notes ? `
                                                <div class="alert alert-warning small mt-2 mb-0">
                                                    <i class="bi bi-sticky"></i> ${delivery.notes}
                                                </div>
                                            ` : ''}
                                        </div>
                                        <div class="card-footer">
                                            <button class="btn btn-primary btn-sm w-100" onclick="App.showRequestDetails(${delivery.id})">
                                                <i class="bi bi-eye"></i> View Details
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
            `;
        } catch (error) {
            console.error('Failed to load pending deliveries:', error);
            this.showNotification('Failed to load pending deliveries', 'error');
        }
    },
    
    async loadTodaysScheduleView() {
        try {
            const data = await API.getTodaysSchedule();
            const dynamicContent = document.getElementById('dynamic-content');
            
            dynamicContent.innerHTML = `
                <div class="container-fluid">
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <h2><i class="bi bi-calendar-day"></i> Today's Schedule</h2>
                        <span class="text-muted">${new Date(data.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>
                    
                    <!-- Summary Cards -->
                    <div class="row g-3 mb-4">
                        <div class="col-md-4">
                            <div class="card text-center bg-warning bg-opacity-10">
                                <div class="card-body">
                                    <h1 class="display-4">${data.summary.pending_pickups_count}</h1>
                                    <p class="mb-0">Pending Pickups</p>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="card text-center bg-primary bg-opacity-10">
                                <div class="card-body">
                                    <h1 class="display-4">${data.summary.expected_returns_count}</h1>
                                    <p class="mb-0">Expected Returns</p>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="card text-center bg-success bg-opacity-10">
                                <div class="card-body">
                                    <h1 class="display-4">${data.summary.completed_returns_count}</h1>
                                    <p class="mb-0">Completed Returns</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Pending Pickups -->
                    <div class="card mb-4">
                        <div class="card-header bg-warning bg-opacity-25">
                            <h5 class="mb-0"><i class="bi bi-hourglass-split"></i> Pending Pickups (${data.summary.pending_pickups_count})</h5>
                        </div>
                        <div class="card-body">
                            ${data.pending_pickups.length === 0 ? `
                                <p class="text-muted mb-0">No pending pickups</p>
                            ` : `
                                <div class="table-responsive">
                                    <table class="table table-hover">
                                        <thead>
                                            <tr>
                                                <th>Request #</th>
                                                <th>User</th>
                                                <th>Department</th>
                                                <th>Items</th>
                                                <th>Purpose</th>
                                                <th>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${data.pending_pickups.map(item => `
                                                <tr>
                                                    <td><strong>${item.request_number}</strong></td>
                                                    <td>${item.user_name}</td>
                                                    <td>${item.department || 'N/A'}</td>
                                                    <td><span class="badge bg-secondary">${item.item_count}</span></td>
                                                    <td>${item.purpose}</td>
                                                    <td>
                                                        <button class="btn btn-sm btn-primary" onclick="App.showRequestDetails(${item.id})">
                                                            <i class="bi bi-eye"></i>
                                                        </button>
                                                    </td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            `}
                        </div>
                    </div>
                    
                    <!-- Expected Returns -->
                    <div class="card mb-4">
                        <div class="card-header bg-primary bg-opacity-25">
                            <h5 class="mb-0"><i class="bi bi-arrow-return-left"></i> Expected Returns (${data.summary.expected_returns_count})</h5>
                        </div>
                        <div class="card-body">
                            ${data.expected_returns.length === 0 ? `
                                <p class="text-muted mb-0">No returns expected today</p>
                            ` : `
                                <div class="table-responsive">
                                    <table class="table table-hover">
                                        <thead>
                                            <tr>
                                                <th>Request #</th>
                                                <th>User</th>
                                                <th>Department</th>
                                                <th>Items</th>
                                                <th>Expected Time</th>
                                                <th>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${data.expected_returns.map(item => `
                                                <tr>
                                                    <td><strong>${item.request_number}</strong></td>
                                                    <td>${item.user_name}</td>
                                                    <td>${item.department || 'N/A'}</td>
                                                    <td><span class="badge bg-secondary">${item.item_count}</span></td>
                                                    <td>${new Date(item.scheduled_time).toLocaleTimeString()}</td>
                                                    <td>
                                                        <button class="btn btn-sm btn-primary" onclick="App.showRequestDetails(${item.id})">
                                                            <i class="bi bi-eye"></i>
                                                        </button>
                                                    </td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            `}
                        </div>
                    </div>
                    
                    <!-- Completed Returns -->
                    <div class="card">
                        <div class="card-header bg-success bg-opacity-25">
                            <h5 class="mb-0"><i class="bi bi-check-circle"></i> Completed Returns Today (${data.summary.completed_returns_count})</h5>
                        </div>
                        <div class="card-body">
                            ${data.completed_returns.length === 0 ? `
                                <p class="text-muted mb-0">No returns completed yet today</p>
                            ` : `
                                <div class="table-responsive">
                                    <table class="table table-hover">
                                        <thead>
                                            <tr>
                                                <th>Request #</th>
                                                <th>User</th>
                                                <th>Department</th>
                                                <th>Items</th>
                                                <th>Returned At</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${data.completed_returns.map(item => `
                                                <tr>
                                                    <td><strong>${item.request_number}</strong></td>
                                                    <td>${item.user_name}</td>
                                                    <td>${item.department || 'N/A'}</td>
                                                    <td><span class="badge bg-secondary">${item.item_count}</span></td>
                                                    <td>${new Date(item.actual_time).toLocaleTimeString()}</td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            `}
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Failed to load today\'s schedule:', error);
            this.showNotification('Failed to load schedule', 'error');
        }
    },
    
    async loadDeliveryHistoryView() {
        try {
            const data = await API.getDeliveryHistory({ days: 30 });
            const dynamicContent = document.getElementById('dynamic-content');
            
            const stats = data.statistics;
            
            dynamicContent.innerHTML = `
                <div class="container-fluid">
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <h2><i class="bi bi-clock-history"></i> Delivery History</h2>
                        <span class="text-muted">Last ${data.period_days} days</span>
                    </div>
                    
                    <!-- Statistics Cards -->
                    <div class="row g-3 mb-4">
                        <div class="col-md-3">
                            <div class="card text-center">
                                <div class="card-body">
                                    <h3 class="display-6">${stats.total_deliveries}</h3>
                                    <p class="mb-0 text-muted">Total Deliveries</p>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card text-center bg-primary bg-opacity-10">
                                <div class="card-body">
                                    <h3 class="display-6">${stats.total_pickups}</h3>
                                    <p class="mb-0 text-muted">Pickups</p>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card text-center bg-success bg-opacity-10">
                                <div class="card-body">
                                    <h3 class="display-6">${stats.total_returns}</h3>
                                    <p class="mb-0 text-muted">Returns</p>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card text-center ${stats.on_time_percentage >= 80 ? 'bg-success' : stats.on_time_percentage >= 60 ? 'bg-warning' : 'bg-danger'} bg-opacity-10">
                                <div class="card-body">
                                    <h3 class="display-6">${stats.on_time_percentage}%</h3>
                                    <p class="mb-0 text-muted">On-Time Returns</p>
                                    <small class="text-muted">${stats.on_time_returns}/${stats.total_returns}</small>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- History Table -->
                    <div class="card">
                        <div class="card-header">
                            <h5 class="mb-0">Recent Deliveries</h5>
                        </div>
                        <div class="card-body">
                            ${data.history.length === 0 ? `
                                <p class="text-muted mb-0">No delivery history found</p>
                            ` : `
                                <div class="table-responsive">
                                    <table class="table table-hover">
                                        <thead>
                                            <tr>
                                                <th>Request #</th>
                                                <th>User</th>
                                                <th>Department</th>
                                                <th>Items</th>
                                                <th>Status</th>
                                                <th>Pickup</th>
                                                <th>Return</th>
                                                <th>On Time</th>
                                                <th>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${data.history.map(item => `
                                                <tr>
                                                    <td><strong>${item.request_number}</strong></td>
                                                    <td>${item.user_name}</td>
                                                    <td>${item.department || 'N/A'}</td>
                                                    <td><span class="badge bg-secondary">${item.item_count}</span></td>
                                                    <td>
                                                        <span class="badge bg-${item.status === 'returned' ? 'success' : 'primary'}">
                                                            ${item.status.replace('_', ' ').toUpperCase()}
                                                        </span>
                                                    </td>
                                                    <td>${item.pickup_time ? new Date(item.pickup_time).toLocaleString() : '-'}</td>
                                                    <td>${item.return_time ? new Date(item.return_time).toLocaleString() : '-'}</td>
                                                    <td>
                                                        ${item.was_on_time === null ? '-' : item.was_on_time ? 
                                                            '<span class="badge bg-success"><i class="bi bi-check"></i></span>' : 
                                                            '<span class="badge bg-danger"><i class="bi bi-x"></i></span>'}
                                                    </td>
                                                    <td>
                                                        <button class="btn btn-sm btn-outline-primary" onclick="App.showRequestDetails(${item.id})">
                                                            <i class="bi bi-eye"></i>
                                                        </button>
                                                    </td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            `}
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Failed to load delivery history:', error);
            this.showNotification('Failed to load delivery history', 'error');
        }
    },
    
    // Quick Scan Mode
    showQuickScanModal() {
        // Remove existing modal if present
        const existingModal = document.getElementById('quickScanModal');
        if (existingModal) existingModal.remove();
        
        const modalHtml = `
            <div class="modal fade" id="quickScanModal" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog modal-lg modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header bg-primary text-white">
                            <h5 class="modal-title">
                                <i class="bi bi-qr-code-scan"></i> Quick Scan Mode
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="text-center mb-4">
                                <p class="lead mb-3">Scan a QR code or enter request number</p>
                                <div class="input-group input-group-lg mb-3">
                                    <span class="input-group-text"><i class="bi bi-upc-scan"></i></span>
                                    <input type="text" class="form-control" id="quick-scan-input" 
                                           placeholder="Scan QR code or type request number" autofocus>
                                    <button class="btn btn-primary" onclick="App.processQuickScan()">
                                        <i class="bi bi-search"></i> Process
                                    </button>
                                </div>
                                <small class="text-muted">
                                    <i class="bi bi-info-circle"></i> Press Enter after scanning or typing
                                </small>
                            </div>
                            
                            <div id="quick-scan-result" class="mt-4"></div>
                            
                            <div class="alert alert-info">
                                <h6><i class="bi bi-keyboard"></i> Keyboard Shortcuts:</h6>
                                <ul class="mb-0">
                                    <li><kbd>Ctrl</kbd> + <kbd>Q</kbd> - Open Quick Scan</li>
                                    <li><kbd>Enter</kbd> - Process scan</li>
                                    <li><kbd>Esc</kbd> - Close modal</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('quickScanModal'));
        modal.show();
        
        // Setup enter key handler
        document.getElementById('quick-scan-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.processQuickScan();
            }
        });
        
        // Focus input when modal is shown
        document.getElementById('quickScanModal').addEventListener('shown.bs.modal', () => {
            document.getElementById('quick-scan-input').focus();
        });
        
        // Cleanup on close
        document.getElementById('quickScanModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    },
    
    async processQuickScan() {
        const input = document.getElementById('quick-scan-input');
        const resultDiv = document.getElementById('quick-scan-result');
        const scanValue = input.value.trim();
        
        if (!scanValue) {
            resultDiv.innerHTML = `
                <div class="alert alert-warning">
                    <i class="bi bi-exclamation-triangle"></i> Please enter a request number or scan a QR code
                </div>
            `;
            return;
        }
        
        resultDiv.innerHTML = `
            <div class="text-center">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2">Processing scan...</p>
            </div>
        `;
        
        try {
            // Try to find the request by number
            const requests = await API.getRequests({ limit: 1000 });
            const request = requests.requests.find(r => r.request_number === scanValue);
            
            if (!request) {
                resultDiv.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="bi bi-x-circle"></i> Request not found: ${scanValue}
                    </div>
                `;
                input.value = '';
                input.focus();
                return;
            }
            
            // Display request info and action buttons
            resultDiv.innerHTML = `
                <div class="card">
                    <div class="card-header bg-success text-white">
                        <h5 class="mb-0"><i class="bi bi-check-circle"></i> Request Found</h5>
                    </div>
                    <div class="card-body">
                        <h4>${request.request_number}</h4>
                        <p><strong>User:</strong> ${request.user_name || 'N/A'}</p>
                        <p><strong>Purpose:</strong> ${request.purpose || 'N/A'}</p>
                        <p><strong>Status:</strong> <span class="badge bg-${this.getStatusColor(request.status)}">${request.status.toUpperCase()}</span></p>
                        <p><strong>Items:</strong> ${request.items ? request.items.length : 0}</p>
                        
                        <div class="d-grid gap-2 mt-3">
                            ${request.status === 'approved' && !request.delivery_date ? `
                                <button class="btn btn-success btn-lg" onclick="App.quickProcessPickup(${request.id})">
                                    <i class="bi bi-box-arrow-up"></i> Process Pickup
                                </button>
                            ` : ''}
                            
                            ${request.status === 'delivered' || (request.delivery_date && !request.return_date) ? `
                                <button class="btn btn-primary btn-lg" onclick="App.quickProcessReturn(${request.id})">
                                    <i class="bi bi-box-arrow-down"></i> Process Return
                                </button>
                            ` : ''}
                            
                            <button class="btn btn-outline-secondary" onclick="App.showRequestDetails(${request.id}); bootstrap.Modal.getInstance(document.getElementById('quickScanModal')).hide();">
                                <i class="bi bi-eye"></i> View Full Details
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            // Clear input and refocus
            input.value = '';
            input.focus();
            
        } catch (error) {
            console.error('Quick scan error:', error);
            resultDiv.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-x-circle"></i> Error processing scan: ${error.message}
                </div>
            `;
            input.value = '';
            input.focus();
        }
    },
    
    async quickProcessPickup(requestId) {
        if (!confirm('Process pickup for this request?')) return;
        
        try {
            await API.processPickup(requestId);
            this.showNotification('Pickup processed successfully!', 'success');
            
            // Clear result and refocus
            document.getElementById('quick-scan-result').innerHTML = `
                <div class="alert alert-success">
                    <i class="bi bi-check-circle"></i> Pickup processed! Ready for next scan.
                </div>
            `;
            document.getElementById('quick-scan-input').focus();
        } catch (error) {
            this.showNotification('Failed to process pickup', 'error');
        }
    },
    
    async quickProcessReturn(requestId) {
        if (!confirm('Process return for this request?')) return;
        
        try {
            await API.processReturn(requestId);
            this.showNotification('Return processed successfully!', 'success');
            
            // Clear result and refocus
            document.getElementById('quick-scan-result').innerHTML = `
                <div class="alert alert-success">
                    <i class="bi bi-check-circle"></i> Return processed! Ready for next scan.
                </div>
            `;
            document.getElementById('quick-scan-input').focus();
        } catch (error) {
            this.showNotification('Failed to process return', 'error');
        }
    },
    
    getStatusColor(status) {
        const colors = {
            'pending': 'warning',
            'approved': 'info',
            'picked_up': 'primary',
            'returned': 'success',
            'cancelled': 'secondary',
            'rejected': 'danger'
        };
        return colors[status] || 'secondary';
    },
    
    // ==================== Analytics Views ====================
    
    async loadUsageStatisticsView() {
        const content = document.getElementById('dynamic-content');
        content.innerHTML = `
            <div class="container-fluid py-4">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h2><i class="bi bi-graph-up"></i> Usage Statistics</h2>
                    <div>
                        <select class="form-select" id="stats-period" onchange="App.loadUsageStatisticsView()">
                            <option value="7">Last 7 Days</option>
                            <option value="30" selected>Last 30 Days</option>
                            <option value="90">Last 90 Days</option>
                            <option value="365">Last Year</option>
                        </select>
                    </div>
                </div>
                <div id="stats-loading" class="text-center py-5">
                    <div class="spinner-border text-primary" role="status"></div>
                    <p class="mt-3">Loading analytics...</p>
                </div>
                <div id="stats-content" style="display: none;"></div>
            </div>
        `;
        
        try {
            const days = document.getElementById('stats-period')?.value || 30;
            const data = await API.getUsageStatistics({ days });
            
            document.getElementById('stats-loading').style.display = 'none';
            document.getElementById('stats-content').style.display = 'block';
            document.getElementById('stats-content').innerHTML = `
                <!-- Overall Stats Cards -->
                <div class="row g-4 mb-4">
                    <div class="col-md-3">
                        <div class="card">
                            <div class="card-body text-center">
                                <i class="bi bi-clipboard-check text-primary fs-1"></i>
                                <h3 class="mt-2">${data.overall_stats.total_requests}</h3>
                                <p class="text-muted mb-0">Total Requests</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card">
                            <div class="card-body text-center">
                                <i class="bi bi-people text-success fs-1"></i>
                                <h3 class="mt-2">${data.overall_stats.active_users}</h3>
                                <p class="text-muted mb-0">Active Users</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card">
                            <div class="card-body text-center">
                                <i class="bi bi-box-seam text-info fs-1"></i>
                                <h3 class="mt-2">${data.overall_stats.products_used}</h3>
                                <p class="text-muted mb-0">Products Used</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card">
                            <div class="card-body text-center">
                                <i class="bi bi-calendar-range text-warning fs-1"></i>
                                <h3 class="mt-2">${data.overall_stats.avg_loan_duration_days}</h3>
                                <p class="text-muted mb-0">Avg Loan Days</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Charts Row -->
                <div class="row g-4 mb-4">
                    <!-- Most Requested Items -->
                    <div class="col-lg-6">
                        <div class="card">
                            <div class="card-header">
                                <h5 class="mb-0"><i class="bi bi-trophy"></i> Top 10 Most Requested Items</h5>
                            </div>
                            <div class="card-body">
                                <div class="table-responsive">
                                    <table class="table table-sm">
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Product</th>
                                                <th>Category</th>
                                                <th>Requests</th>
                                                <th>Total Qty</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${data.most_requested_items.length === 0 ? `
                                                <tr><td colspan="5" class="text-center text-muted">No data available</td></tr>
                                            ` : data.most_requested_items.map((item, idx) => `
                                                <tr>
                                                    <td><strong>${idx + 1}</strong></td>
                                                    <td>${item.name}</td>
                                                    <td><span class="badge bg-secondary">${item.category}</span></td>
                                                    <td><span class="badge bg-primary">${item.request_count}</span></td>
                                                    <td>${item.total_quantity.toFixed(1)}</td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Category Breakdown -->
                    <div class="col-lg-6">
                        <div class="card">
                            <div class="card-header">
                                <h5 class="mb-0"><i class="bi bi-pie-chart"></i> Category Breakdown</h5>
                            </div>
                            <div class="card-body">
                                <div class="table-responsive">
                                    <table class="table table-sm">
                                        <thead>
                                            <tr>
                                                <th>Category</th>
                                                <th>Requests</th>
                                                <th>Total Qty</th>
                                                <th>%</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${data.category_breakdown.length === 0 ? `
                                                <tr><td colspan="4" class="text-center text-muted">No data available</td></tr>
                                            ` : data.category_breakdown.map(cat => {
                                                const percentage = data.overall_stats.total_requests > 0 
                                                    ? (cat.request_count / data.overall_stats.total_requests * 100).toFixed(1)
                                                    : '0.0';
                                                return `
                                                    <tr>
                                                        <td>${cat.category}</td>
                                                        <td>${cat.request_count}</td>
                                                        <td>${cat.total_quantity.toFixed(1)}</td>
                                                        <td>
                                                            <div class="progress" style="height: 20px;">
                                                                <div class="progress-bar" role="progressbar" style="width: ${percentage}%">
                                                                    ${percentage}%
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                `;
                                            }).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Time Distribution Row -->
                <div class="row g-4 mb-4">
                    <!-- Popular Departments -->
                    <div class="col-lg-6">
                        <div class="card">
                            <div class="card-header">
                                <h5 class="mb-0"><i class="bi bi-building"></i> Most Active Departments</h5>
                            </div>
                            <div class="card-body">
                                <div class="table-responsive">
                                    <table class="table table-sm">
                                        <thead>
                                            <tr>
                                                <th>Department</th>
                                                <th>Requests</th>
                                                <th>Active Users</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${data.popular_departments.length === 0 ? `
                                                <tr><td colspan="3" class="text-center text-muted">No data available</td></tr>
                                            ` : data.popular_departments.map(dept => `
                                                <tr>
                                                    <td>${dept.department}</td>
                                                    <td><span class="badge bg-primary">${dept.request_count}</span></td>
                                                    <td><span class="badge bg-success">${dept.active_users}</span></td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Busiest Times -->
                    <div class="col-lg-6">
                        <div class="card">
                            <div class="card-header">
                                <h5 class="mb-0"><i class="bi bi-clock"></i> Request Distribution by Hour</h5>
                            </div>
                            <div class="card-body">
                                <div class="table-responsive">
                                    <table class="table table-sm">
                                        <thead>
                                            <tr>
                                                <th>Hour</th>
                                                <th>Requests</th>
                                                <th>Activity</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${data.hourly_distribution.length === 0 ? `
                                                <tr><td colspan="3" class="text-center text-muted">No data available</td></tr>
                                            ` : data.hourly_distribution.sort((a, b) => b.count - a.count).slice(0, 10).map(hour => {
                                                const maxCount = Math.max(...data.hourly_distribution.map(h => h.count), 1);
                                                const percentage = maxCount > 0 ? (hour.count / maxCount * 100).toFixed(0) : '0';
                                                return `
                                                    <tr>
                                                        <td><strong>${hour.hour}:00</strong></td>
                                                        <td>${hour.count}</td>
                                                        <td>
                                                            <div class="progress" style="height: 20px;">
                                                                <div class="progress-bar bg-info" style="width: ${percentage}%">
                                                                    ${percentage}%
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                `;
                                            }).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Day of Week Distribution -->
                <div class="card">
                    <div class="card-header">
                        <h5 class="mb-0"><i class="bi bi-calendar-week"></i> Requests by Day of Week</h5>
                    </div>
                    <div class="card-body">
                        ${data.daily_distribution.length === 0 ? `
                            <p class="text-center text-muted">No data available</p>
                        ` : `
                        <div class="row text-center">
                            ${data.daily_distribution.map(day => {
                                const maxCount = Math.max(...data.daily_distribution.map(d => d.count), 1);
                                const height = maxCount > 0 ? (day.count / maxCount * 200).toFixed(0) : '0';
                                return `
                                    <div class="col">
                                        <div class="mb-2">
                                            <div class="bg-primary rounded" style="height: ${height}px; width: 40px; margin: 0 auto;"></div>
                                        </div>
                                        <strong>${day.count}</strong>
                                        <div class="text-muted small">${day.day_name}</div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                        `}
                    </div>
                </div>
            `;
        } catch (error) {
            document.getElementById('stats-loading').innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle"></i> Failed to load statistics: ${error.message}
                </div>
            `;
        }
    },
    
    async loadStockForecastView() {
        const content = document.getElementById('dynamic-content');
        content.innerHTML = `
            <div class="container-fluid py-4">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h2><i class="bi bi-graph-up-arrow"></i> Stock Forecast</h2>
                    <div>
                        <select class="form-select" id="forecast-period" onchange="App.loadStockForecastView()">
                            <option value="7">Last 7 Days</option>
                            <option value="30" selected>Last 30 Days</option>
                            <option value="90">Last 90 Days</option>
                        </select>
                    </div>
                </div>
                <div id="forecast-loading" class="text-center py-5">
                    <div class="spinner-border text-primary" role="status"></div>
                    <p class="mt-3">Analyzing stock levels...</p>
                </div>
                <div id="forecast-content" style="display: none;"></div>
            </div>
        `;
        
        try {
            const days = document.getElementById('forecast-period')?.value || 30;
            const data = await API.getStockForecast({ days });
            
            document.getElementById('forecast-loading').style.display = 'none';
            document.getElementById('forecast-content').style.display = 'block';
            document.getElementById('forecast-content').innerHTML = `
                <!-- Summary Cards -->
                <div class="row g-4 mb-4">
                    <div class="col-md-3">
                        <div class="card border-danger">
                            <div class="card-body text-center">
                                <i class="bi bi-exclamation-triangle text-danger fs-1"></i>
                                <h3 class="mt-2">${data.summary.critical}</h3>
                                <p class="text-danger mb-0"><strong>Critical</strong></p>
                                <small class="text-muted">At or below minimum</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card border-warning">
                            <div class="card-body text-center">
                                <i class="bi bi-exclamation-circle text-warning fs-1"></i>
                                <h3 class="mt-2">${data.summary.warning}</h3>
                                <p class="text-warning mb-0"><strong>Warning</strong></p>
                                <small class="text-muted">≤ 7 days to minimum</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card border-info">
                            <div class="card-body text-center">
                                <i class="bi bi-info-circle text-info fs-1"></i>
                                <h3 class="mt-2">${data.summary.attention}</h3>
                                <p class="text-info mb-0"><strong>Attention</strong></p>
                                <small class="text-muted">8-14 days to minimum</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card border-success">
                            <div class="card-body text-center">
                                <i class="bi bi-check-circle text-success fs-1"></i>
                                <h3 class="mt-2">${data.summary.healthy}</h3>
                                <p class="text-success mb-0"><strong>Healthy</strong></p>
                                <small class="text-muted">> 14 days to minimum</small>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Forecast Table -->
                <div class="card">
                    <div class="card-header">
                        <h5 class="mb-0"><i class="bi bi-clipboard-data"></i> Stock Forecast Details</h5>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table table-hover">
                                <thead>
                                    <tr>
                                        <th>Status</th>
                                        <th>Product</th>
                                        <th>Category</th>
                                        <th>Location</th>
                                        <th>Current Stock</th>
                                        <th>Min Stock</th>
                                        <th>Daily Usage</th>
                                        <th>Days to Min</th>
                                        <th>Days to Empty</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${data.forecasts.map(item => {
                                        const statusConfig = {
                                            'critical': { icon: 'exclamation-triangle', color: 'danger' },
                                            'warning': { icon: 'exclamation-circle', color: 'warning' },
                                            'attention': { icon: 'info-circle', color: 'info' },
                                            'healthy': { icon: 'check-circle', color: 'success' }
                                        };
                                        const config = statusConfig[item.status];
                                        return `
                                            <tr>
                                                <td>
                                                    <i class="bi bi-${config.icon} text-${config.color} fs-5"></i>
                                                </td>
                                                <td><strong>${item.name}</strong></td>
                                                <td><span class="badge bg-secondary">${item.category || 'N/A'}</span></td>
                                                <td>${item.location || 'N/A'}</td>
                                                <td>
                                                    <span class="badge bg-${item.current_stock <= item.minimum_stock ? 'danger' : 'primary'}">
                                                        ${item.current_stock.toFixed(1)}
                                                    </span>
                                                </td>
                                                <td>${item.minimum_stock.toFixed(1)}</td>
                                                <td>${item.daily_usage_rate.toFixed(2)}/day</td>
                                                <td>
                                                    ${item.days_until_minimum !== null ? 
                                                        `<strong class="text-${config.color}">${item.days_until_minimum.toFixed(1)} days</strong>` : 
                                                        '<span class="text-muted">-</span>'}
                                                </td>
                                                <td>
                                                    ${item.days_until_empty !== null ? 
                                                        `${item.days_until_empty.toFixed(1)} days` : 
                                                        '<span class="text-muted">-</span>'}
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            document.getElementById('forecast-loading').innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle"></i> Failed to load forecast: ${error.message}
                </div>
            `;
        }
    },
    
    async loadLateReturnAnalyticsView() {
        const content = document.getElementById('dynamic-content');
        content.innerHTML = `
            <div class="container-fluid py-4">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h2><i class="bi bi-clock-history"></i> Late Return Analytics</h2>
                    <div>
                        <select class="form-select" id="late-period" onchange="App.loadLateReturnAnalyticsView()">
                            <option value="30">Last 30 Days</option>
                            <option value="90" selected>Last 90 Days</option>
                            <option value="180">Last 6 Months</option>
                            <option value="365">Last Year</option>
                        </select>
                    </div>
                </div>
                <div id="late-loading" class="text-center py-5">
                    <div class="spinner-border text-primary" role="status"></div>
                    <p class="mt-3">Analyzing late returns...</p>
                </div>
                <div id="late-content" style="display: none;"></div>
            </div>
        `;
        
        try {
            const days = document.getElementById('late-period')?.value || 90;
            const data = await API.getLateReturnAnalytics({ days });
            
            document.getElementById('late-loading').style.display = 'none';
            document.getElementById('late-content').style.display = 'block';
            document.getElementById('late-content').innerHTML = `
                <!-- Summary Cards -->
                <div class="row g-4 mb-4">
                    <div class="col-md-3">
                        <div class="card">
                            <div class="card-body text-center">
                                <i class="bi bi-x-circle text-danger fs-1"></i>
                                <h3 class="mt-2">${data.overall_stats.total_late_returns}</h3>
                                <p class="text-muted mb-0">Total Late Returns</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card">
                            <div class="card-body text-center">
                                <i class="bi bi-people text-warning fs-1"></i>
                                <h3 class="mt-2">${data.overall_stats.users_with_late_returns}</h3>
                                <p class="text-muted mb-0">Users with Late Returns</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card">
                            <div class="card-body text-center">
                                <i class="bi bi-calendar-x text-info fs-1"></i>
                                <h3 class="mt-2">${data.overall_stats.avg_days_late}</h3>
                                <p class="text-muted mb-0">Avg Days Late</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card">
                            <div class="card-body text-center">
                                <i class="bi bi-arrow-up-circle text-danger fs-1"></i>
                                <h3 class="mt-2">${data.overall_stats.max_days_late}</h3>
                                <p class="text-muted mb-0">Max Days Late</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="row g-4">
                    <!-- Top Late Users -->
                    <div class="col-lg-6">
                        <div class="card">
                            <div class="card-header">
                                <h5 class="mb-0"><i class="bi bi-person-x"></i> Users with Most Late Returns</h5>
                            </div>
                            <div class="card-body">
                                <div class="table-responsive">
                                    <table class="table table-sm">
                                        <thead>
                                            <tr>
                                                <th>User</th>
                                                <th>Department</th>
                                                <th>Late Returns</th>
                                                <th>Avg Days Late</th>
                                                <th>Strikes</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${data.top_late_users.length === 0 ? `
                                                <tr><td colspan="5" class="text-center text-muted">No late returns found</td></tr>
                                            ` : data.top_late_users.map(user => `
                                                <tr>
                                                    <td>
                                                        <strong>${user.registration_number}</strong><br>
                                                        <small class="text-muted">${user.name}</small>
                                                    </td>
                                                    <td>${user.department || 'N/A'}</td>
                                                    <td><span class="badge bg-danger">${user.late_return_count}</span></td>
                                                    <td>${user.avg_days_late.toFixed(1)} days</td>
                                                    <td><span class="badge bg-warning">${user.strikes}</span></td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Departments -->
                    <div class="col-lg-6">
                        <div class="card">
                            <div class="card-header">
                                <h5 class="mb-0"><i class="bi bi-building"></i> Departments with Late Returns</h5>
                            </div>
                            <div class="card-body">
                                <div class="table-responsive">
                                    <table class="table table-sm">
                                        <thead>
                                            <tr>
                                                <th>Department</th>
                                                <th>Late Returns</th>
                                                <th>Users</th>
                                                <th>Avg Days Late</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${data.departments.length === 0 ? `
                                                <tr><td colspan="4" class="text-center text-muted">No data available</td></tr>
                                            ` : data.departments.map(dept => `
                                                <tr>
                                                    <td><strong>${dept.department}</strong></td>
                                                    <td><span class="badge bg-danger">${dept.late_return_count}</span></td>
                                                    <td><span class="badge bg-secondary">${dept.users_with_late_returns}</span></td>
                                                    <td>${dept.avg_days_late.toFixed(1)} days</td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            document.getElementById('late-loading').innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle"></i> Failed to load analytics: ${error.message}
                </div>
            `;
        }
    },
    
    async loadDebtCollectionView() {
        const content = document.getElementById('dynamic-content');
        content.innerHTML = `
            <div class="container-fluid py-4">
                <h2 class="mb-4"><i class="bi bi-cash-coin"></i> Debt Collection Dashboard</h2>
                <div id="debt-loading" class="text-center py-5">
                    <div class="spinner-border text-primary" role="status"></div>
                    <p class="mt-3">Loading debt data...</p>
                </div>
                <div id="debt-content" style="display: none;"></div>
            </div>
        `;
        
        try {
            const data = await API.getDebtCollectionDashboard();
            
            document.getElementById('debt-loading').style.display = 'none';
            document.getElementById('debt-content').style.display = 'block';
            document.getElementById('debt-content').innerHTML = `
                <!-- Summary Cards -->
                <div class="row g-4 mb-4">
                    <div class="col-md-3">
                        <div class="card border-danger">
                            <div class="card-body">
                                <h6 class="text-danger">Pending Debts</h6>
                                <h3>$${data.overall_stats.pending.amount.toFixed(2)}</h3>
                                <p class="text-muted mb-0">${data.overall_stats.pending.count} items</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card border-success">
                            <div class="card-body">
                                <h6 class="text-success">Paid Debts</h6>
                                <h3>$${data.overall_stats.paid.amount.toFixed(2)}</h3>
                                <p class="text-muted mb-0">${data.overall_stats.paid.count} items</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card border-info">
                            <div class="card-body">
                                <h6 class="text-info">Waived Debts</h6>
                                <h3>$${data.overall_stats.waived.amount.toFixed(2)}</h3>
                                <p class="text-muted mb-0">${data.overall_stats.waived.count} items</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card border-warning">
                            <div class="card-body">
                                <h6 class="text-warning">Disputed Debts</h6>
                                <h3>$${data.overall_stats.disputed.amount.toFixed(2)}</h3>
                                <p class="text-muted mb-0">${data.overall_stats.disputed.count} items</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="row g-4 mb-4">
                    <!-- Debts by User -->
                    <div class="col-lg-6">
                        <div class="card">
                            <div class="card-header">
                                <h5 class="mb-0"><i class="bi bi-people"></i> Outstanding Debts by User</h5>
                            </div>
                            <div class="card-body">
                                <div class="table-responsive">
                                    <table class="table table-sm">
                                        <thead>
                                            <tr>
                                                <th>User</th>
                                                <th>Department</th>
                                                <th>Items</th>
                                                <th>Total Debt</th>
                                                <th>Contact</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${data.debts_by_user.length === 0 ? `
                                                <tr><td colspan="5" class="text-center text-success">No outstanding debts!</td></tr>
                                            ` : data.debts_by_user.map(user => `
                                                <tr>
                                                    <td>
                                                        <strong>${user.registration_number}</strong><br>
                                                        <small class="text-muted">${user.name}</small>
                                                    </td>
                                                    <td>${user.department || 'N/A'}</td>
                                                    <td><span class="badge bg-warning">${user.debt_count}</span></td>
                                                    <td><strong class="text-danger">$${user.total_debt.toFixed(2)}</strong></td>
                                                    <td>
                                                        <small>${user.email || 'N/A'}</small><br>
                                                        <small>${user.phone || 'N/A'}</small>
                                                    </td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Debts by Type and Aging -->
                    <div class="col-lg-6">
                        <div class="card mb-3">
                            <div class="card-header">
                                <h5 class="mb-0"><i class="bi bi-tag"></i> Debts by Type</h5>
                            </div>
                            <div class="card-body">
                                <table class="table table-sm mb-0">
                                    <tbody>
                                        ${data.debts_by_type.map(type => `
                                            <tr>
                                                <td><strong>${type.debt_type.toUpperCase()}</strong></td>
                                                <td><span class="badge bg-secondary">${type.count}</span></td>
                                                <td class="text-end"><strong>$${type.total_amount.toFixed(2)}</strong></td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        
                        <div class="card">
                            <div class="card-header">
                                <h5 class="mb-0"><i class="bi bi-calendar-range"></i> Aging Analysis</h5>
                            </div>
                            <div class="card-body">
                                <table class="table table-sm mb-0">
                                    <tbody>
                                        ${data.aging_analysis.map(age => `
                                            <tr>
                                                <td><strong>${age.age_group}</strong></td>
                                                <td><span class="badge bg-warning">${age.count}</span></td>
                                                <td class="text-end"><strong>$${age.total_amount.toFixed(2)}</strong></td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Recent Activity -->
                <div class="card">
                    <div class="card-header">
                        <h5 class="mb-0"><i class="bi bi-clock-history"></i> Recent Debt Activity</h5>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table table-sm">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>User</th>
                                        <th>Product</th>
                                        <th>Type</th>
                                        <th>Amount</th>
                                        <th>Status</th>
                                        <th>Resolved By</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${data.recent_activity.map(debt => `
                                        <tr>
                                            <td><small>${new Date(debt.created_at).toLocaleDateString()}</small></td>
                                            <td><small>${debt.user}</small></td>
                                            <td><small>${debt.product_name || 'N/A'}</small></td>
                                            <td><span class="badge bg-secondary">${debt.debt_type}</span></td>
                                            <td><strong>$${debt.total_amount.toFixed(2)}</strong></td>
                                            <td>
                                                <span class="badge bg-${
                                                    debt.status === 'paid' ? 'success' :
                                                    debt.status === 'pending' ? 'warning' :
                                                    debt.status === 'disputed' ? 'danger' : 'info'
                                                }">
                                                    ${debt.status}
                                                </span>
                                            </td>
                                            <td><small>${debt.resolved_by || '-'}</small></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            document.getElementById('debt-loading').innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle"></i> Failed to load debt data: ${error.message}
                </div>
            `;
        }
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