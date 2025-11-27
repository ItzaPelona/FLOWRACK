/**
 * FlowRack Global Search
 * Universal search across requests, products, users, and suppliers
 * Features: Fuzzy matching, keyboard navigation, recent searches
 */

class GlobalSearch {
    constructor() {
        this.searchData = {
            products: [],
            requests: [],
            users: [],
            suppliers: []
        };
        this.recentSearches = this.loadRecentSearches();
        this.selectedIndex = -1;
        this.activeFilters = ['all'];
        this.searchTimeout = null;
        this.modal = null;
        
        this.init();
    }

    /**
     * Initialize global search
     */
    init() {
        this.createModal();
        this.setupKeyboardShortcuts();
        this.loadSearchData();
        window.GlobalSearch = this; // Make globally accessible
        console.log('🔍 GlobalSearch initialized');
    }

    /**
     * Create search modal HTML
     */
    createModal() {
        const modalHTML = `
            <div class="modal fade global-search-modal" id="globalSearchModal" tabindex="-1">
                <div class="modal-dialog modal-lg modal-dialog-centered">
                    <div class="modal-content">
                        <div class="search-modal-header">
                            <div class="search-input-container">
                                <i class="bi bi-search search-icon"></i>
                                <input 
                                    type="text" 
                                    id="globalSearchInput" 
                                    placeholder="Search everything... (Ctrl+K)"
                                    autocomplete="off"
                                >
                                <button class="search-clear-btn" id="searchClearBtn" style="display: none;">
                                    <i class="bi bi-x-circle-fill"></i>
                                </button>
                            </div>
                        </div>
                        
                        <div class="search-filters">
                            <button class="search-filter-btn active" data-filter="all">
                                <i class="bi bi-grid"></i> All
                            </button>
                            <button class="search-filter-btn" data-filter="products">
                                <i class="bi bi-box-seam"></i> Products
                            </button>
                            <button class="search-filter-btn" data-filter="requests">
                                <i class="bi bi-clipboard-check"></i> Requests
                            </button>
                            <button class="search-filter-btn" data-filter="users">
                                <i class="bi bi-people"></i> Users
                            </button>
                            <button class="search-filter-btn" data-filter="suppliers">
                                <i class="bi bi-truck"></i> Suppliers
                            </button>
                        </div>
                        
                        <div id="searchResultsContainer" class="search-results-container">
                            <!-- Recent searches shown by default -->
                            <div id="recentSearchesSection" class="recent-searches">
                                <div class="recent-searches-header">
                                    <h6 class="recent-searches-title">Recent Searches</h6>
                                    <button class="clear-recent-btn" id="clearRecentBtn">
                                        Clear All
                                    </button>
                                </div>
                                <div id="recentSearchesList"></div>
                            </div>
                            
                            <!-- Search results will appear here -->
                            <div id="searchResults" style="display: none;"></div>
                        </div>
                        
                        <div class="search-footer">
                            <div class="search-shortcuts">
                                <div class="search-shortcut">
                                    <kbd>↑</kbd><kbd>↓</kbd> Navigate
                                </div>
                                <div class="search-shortcut">
                                    <kbd>Enter</kbd> Select
                                </div>
                                <div class="search-shortcut">
                                    <kbd>Esc</kbd> Close
                                </div>
                            </div>
                            <div class="text-muted" style="font-size: 0.8rem;">
                                <span id="searchResultCount"></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = new bootstrap.Modal(document.getElementById('globalSearchModal'));
        this.setupEventListeners();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        const input = document.getElementById('globalSearchInput');
        const clearBtn = document.getElementById('searchClearBtn');
        const filterBtns = document.querySelectorAll('.search-filter-btn');
        const clearRecentBtn = document.getElementById('clearRecentBtn');

        // Search input
        input.addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
            clearBtn.style.display = e.target.value ? 'block' : 'none';
        });

        // Clear button
        clearBtn.addEventListener('click', () => {
            input.value = '';
            clearBtn.style.display = 'none';
            this.showRecentSearches();
        });

        // Filter buttons
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.activeFilters = [btn.dataset.filter];
                this.handleSearch(input.value);
            });
        });

        // Clear recent searches
        clearRecentBtn.addEventListener('click', () => {
            this.clearRecentSearches();
        });

        // Keyboard navigation
        input.addEventListener('keydown', (e) => {
            this.handleKeyboardNavigation(e);
        });

        // Modal shown event
        document.getElementById('globalSearchModal').addEventListener('shown.bs.modal', () => {
            input.focus();
            this.showRecentSearches();
        });

        // Modal hidden event
        document.getElementById('globalSearchModal').addEventListener('hidden.bs.modal', () => {
            input.value = '';
            clearBtn.style.display = 'none';
            this.showRecentSearches();
        });
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+K or Cmd+K to open search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.open();
            }

            // / to focus search
            if (e.key === '/' && !this.isInputFocused()) {
                e.preventDefault();
                this.open();
            }
        });
    }

    /**
     * Check if an input is currently focused
     */
    isInputFocused() {
        const activeElement = document.activeElement;
        return activeElement.tagName === 'INPUT' || 
               activeElement.tagName === 'TEXTAREA' ||
               activeElement.isContentEditable;
    }

    /**
     * Open search modal
     */
    open() {
        this.modal.show();
    }

    /**
     * Close search modal
     */
    close() {
        this.modal.hide();
    }

    /**
     * Load search data from API
     */
    async loadSearchData() {
        try {
            // Load products
            if (typeof apiRequest === 'function') {
                const productsResponse = await apiRequest('/products');
                if (productsResponse.success) {
                    this.searchData.products = productsResponse.products;
                }

                // Load requests (if user has access)
                try {
                    const requestsResponse = await apiRequest('/requests');
                    if (requestsResponse.success) {
                        this.searchData.requests = requestsResponse.requests;
                    }
                } catch (err) {
                    // User may not have access to requests
                }

                // Load users (admin only)
                try {
                    const usersResponse = await apiRequest('/users');
                    if (usersResponse.success) {
                        this.searchData.users = usersResponse.users;
                    }
                } catch (err) {
                    // User may not be admin
                }

                // Load suppliers
                try {
                    const suppliersResponse = await apiRequest('/suppliers');
                    if (suppliersResponse.success) {
                        this.searchData.suppliers = suppliersResponse.suppliers;
                    }
                } catch (err) {
                    // May not have access
                }
            }
            console.log('✅ Search data loaded');
        } catch (error) {
            console.error('Error loading search data:', error);
        }
    }

    /**
     * Handle search input
     */
    handleSearch(query) {
        clearTimeout(this.searchTimeout);
        
        if (!query.trim()) {
            this.showRecentSearches();
            return;
        }

        this.searchTimeout = setTimeout(() => {
            this.performSearch(query);
        }, 300); // Debounce 300ms
    }

    /**
     * Perform search
     */
    performSearch(query) {
        const results = {
            products: [],
            requests: [],
            users: [],
            suppliers: []
        };

        const queryLower = query.toLowerCase();

        // Search products
        if (this.activeFilters.includes('all') || this.activeFilters.includes('products')) {
            results.products = this.searchData.products.filter(item => 
                this.fuzzyMatch(item.name, queryLower) ||
                this.fuzzyMatch(item.sku, queryLower) ||
                this.fuzzyMatch(item.category, queryLower)
            ).slice(0, 5);
        }

        // Search requests
        if (this.activeFilters.includes('all') || this.activeFilters.includes('requests')) {
            results.requests = this.searchData.requests.filter(item => 
                this.fuzzyMatch(item.id?.toString(), queryLower) ||
                this.fuzzyMatch(item.product_name, queryLower) ||
                this.fuzzyMatch(item.status, queryLower)
            ).slice(0, 5);
        }

        // Search users
        if (this.activeFilters.includes('all') || this.activeFilters.includes('users')) {
            results.users = this.searchData.users.filter(item => 
                this.fuzzyMatch(item.username, queryLower) ||
                this.fuzzyMatch(item.email, queryLower) ||
                this.fuzzyMatch(item.role, queryLower)
            ).slice(0, 5);
        }

        // Search suppliers
        if (this.activeFilters.includes('all') || this.activeFilters.includes('suppliers')) {
            results.suppliers = this.searchData.suppliers.filter(item => 
                this.fuzzyMatch(item.name, queryLower) ||
                this.fuzzyMatch(item.contact_person, queryLower) ||
                this.fuzzyMatch(item.email, queryLower)
            ).slice(0, 5);
        }

        this.displayResults(results, query);
        this.saveRecentSearch(query);
    }

    /**
     * Fuzzy match algorithm
     */
    fuzzyMatch(text, query) {
        if (!text) return false;
        const textLower = text.toString().toLowerCase();
        return textLower.includes(query);
    }

    /**
     * Highlight matching text
     */
    highlightMatch(text, query) {
        if (!text || !query) return text;
        const regex = new RegExp(`(${query})`, 'gi');
        return text.toString().replace(regex, '<span class="search-result-match">$1</span>');
    }

    /**
     * Display search results
     */
    displayResults(results, query) {
        const container = document.getElementById('searchResults');
        const recentSection = document.getElementById('recentSearchesSection');
        const countElement = document.getElementById('searchResultCount');
        
        recentSection.style.display = 'none';
        container.style.display = 'block';
        
        let html = '';
        let totalResults = 0;

        // Products
        if (results.products.length > 0) {
            html += this.renderCategory('Products', 'box-seam', results.products, query, (item) => `
                <div class="search-result-item" data-type="product" data-id="${item.id}">
                    <div class="search-result-icon">
                        <i class="bi bi-box-seam"></i>
                    </div>
                    <div class="search-result-content">
                        <div class="search-result-title">
                            ${this.highlightMatch(item.name, query)}
                        </div>
                        <div class="search-result-description">
                            SKU: ${this.highlightMatch(item.sku, query)} • ${item.category || 'No category'}
                        </div>
                        <div class="search-result-meta">
                            <span class="search-result-badge">
                                <i class="bi bi-box"></i> Stock: ${item.current_stock || 0}
                            </span>
                        </div>
                    </div>
                </div>
            `);
            totalResults += results.products.length;
        }

        // Requests
        if (results.requests.length > 0) {
            html += this.renderCategory('Requests', 'clipboard-check', results.requests, query, (item) => `
                <div class="search-result-item" data-type="request" data-id="${item.id}">
                    <div class="search-result-icon">
                        <i class="bi bi-clipboard-check"></i>
                    </div>
                    <div class="search-result-content">
                        <div class="search-result-title">
                            ${this.highlightMatch(item.product_name, query)}
                        </div>
                        <div class="search-result-description">
                            Request #${item.id} • ${item.quantity} units
                        </div>
                        <div class="search-result-meta">
                            <span class="search-result-badge">
                                ${this.getStatusBadge(item.status)}
                            </span>
                            <span>${this.formatDate(item.created_at)}</span>
                        </div>
                    </div>
                </div>
            `);
            totalResults += results.requests.length;
        }

        // Users
        if (results.users.length > 0) {
            html += this.renderCategory('Users', 'people', results.users, query, (item) => `
                <div class="search-result-item" data-type="user" data-id="${item.id}">
                    <div class="search-result-icon">
                        <i class="bi bi-person"></i>
                    </div>
                    <div class="search-result-content">
                        <div class="search-result-title">
                            ${this.highlightMatch(item.username, query)}
                        </div>
                        <div class="search-result-description">
                            ${this.highlightMatch(item.email, query)}
                        </div>
                        <div class="search-result-meta">
                            <span class="search-result-badge">
                                <i class="bi bi-shield"></i> ${item.role}
                            </span>
                        </div>
                    </div>
                </div>
            `);
            totalResults += results.users.length;
        }

        // Suppliers
        if (results.suppliers.length > 0) {
            html += this.renderCategory('Suppliers', 'truck', results.suppliers, query, (item) => `
                <div class="search-result-item" data-type="supplier" data-id="${item.id}">
                    <div class="search-result-icon">
                        <i class="bi bi-truck"></i>
                    </div>
                    <div class="search-result-content">
                        <div class="search-result-title">
                            ${this.highlightMatch(item.name, query)}
                        </div>
                        <div class="search-result-description">
                            ${item.contact_person || 'No contact'} • ${this.highlightMatch(item.email || '', query)}
                        </div>
                        <div class="search-result-meta">
                            <span class="search-result-badge">
                                <i class="bi bi-telephone"></i> ${item.phone || 'No phone'}
                            </span>
                        </div>
                    </div>
                </div>
            `);
            totalResults += results.suppliers.length;
        }

        if (totalResults === 0) {
            html = `
                <div class="search-empty">
                    <div class="search-empty-icon">
                        <i class="bi bi-search"></i>
                    </div>
                    <div class="search-empty-title">No results found</div>
                    <div class="search-empty-text">
                        Try adjusting your search or filters
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
        countElement.textContent = `${totalResults} result${totalResults !== 1 ? 's' : ''}`;
        
        this.setupResultListeners();
        this.selectedIndex = -1;
    }

    /**
     * Render category section
     */
    renderCategory(title, icon, items, query, itemRenderer) {
        return `
            <div class="search-category">
                <div class="search-category-header">
                    <i class="bi bi-${icon}"></i>
                    <h6 class="search-category-title">${title}</h6>
                    <span class="search-category-count">${items.length}</span>
                </div>
                ${items.map(itemRenderer).join('')}
            </div>
        `;
    }

    /**
     * Setup result item listeners
     */
    setupResultListeners() {
        const items = document.querySelectorAll('.search-result-item');
        items.forEach((item, index) => {
            item.addEventListener('click', () => {
                this.selectResult(item);
            });
        });
    }

    /**
     * Select a search result
     */
    selectResult(item) {
        const type = item.dataset.type;
        const id = item.dataset.id;
        
        this.close();
        
        // Navigate to appropriate view
        switch (type) {
            case 'product':
                // Open product details or navigate to products view
                if (typeof showView === 'function') {
                    showView('products');
                }
                break;
            case 'request':
                if (typeof showView === 'function') {
                    showView('requests');
                }
                break;
            case 'user':
                if (typeof showView === 'function') {
                    showView('users');
                }
                break;
            case 'supplier':
                if (typeof showView === 'function') {
                    showView('suppliers');
                }
                break;
        }
    }

    /**
     * Handle keyboard navigation
     */
    handleKeyboardNavigation(e) {
        const items = document.querySelectorAll('.search-result-item');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.selectedIndex = Math.min(this.selectedIndex + 1, items.length - 1);
            this.updateSelection(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
            this.updateSelection(items);
        } else if (e.key === 'Enter' && this.selectedIndex >= 0) {
            e.preventDefault();
            items[this.selectedIndex]?.click();
        } else if (e.key === 'Escape') {
            this.close();
        }
    }

    /**
     * Update visual selection
     */
    updateSelection(items) {
        items.forEach((item, index) => {
            if (index === this.selectedIndex) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            } else {
                item.classList.remove('selected');
            }
        });
    }

    /**
     * Show recent searches
     */
    showRecentSearches() {
        const recentSection = document.getElementById('recentSearchesSection');
        const resultsSection = document.getElementById('searchResults');
        const list = document.getElementById('recentSearchesList');
        
        resultsSection.style.display = 'none';
        recentSection.style.display = 'block';
        
        if (this.recentSearches.length === 0) {
            list.innerHTML = '<p class="text-muted" style="font-size: 0.9rem; padding: 1rem;">No recent searches</p>';
            return;
        }
        
        const html = this.recentSearches.map(search => `
            <div class="recent-search-item" data-query="${search}">
                <i class="bi bi-clock-history"></i>
                <span class="recent-search-text">${search}</span>
                <button class="remove-recent-btn" data-query="${search}">
                    <i class="bi bi-x"></i>
                </button>
            </div>
        `).join('');
        
        list.innerHTML = html;
        
        // Setup click handlers
        list.querySelectorAll('.recent-search-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.remove-recent-btn')) {
                    const query = item.dataset.query;
                    document.getElementById('globalSearchInput').value = query;
                    this.performSearch(query);
                }
            });
        });
        
        list.querySelectorAll('.remove-recent-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeRecentSearch(btn.dataset.query);
            });
        });
    }

    /**
     * Save recent search
     */
    saveRecentSearch(query) {
        if (!query.trim()) return;
        
        // Remove if already exists
        this.recentSearches = this.recentSearches.filter(s => s !== query);
        
        // Add to beginning
        this.recentSearches.unshift(query);
        
        // Keep only last 10
        this.recentSearches = this.recentSearches.slice(0, 10);
        
        localStorage.setItem('flowrack_recent_searches', JSON.stringify(this.recentSearches));
    }

    /**
     * Load recent searches
     */
    loadRecentSearches() {
        try {
            return JSON.parse(localStorage.getItem('flowrack_recent_searches') || '[]');
        } catch {
            return [];
        }
    }

    /**
     * Remove a recent search
     */
    removeRecentSearch(query) {
        this.recentSearches = this.recentSearches.filter(s => s !== query);
        localStorage.setItem('flowrack_recent_searches', JSON.stringify(this.recentSearches));
        this.showRecentSearches();
    }

    /**
     * Clear all recent searches
     */
    clearRecentSearches() {
        this.recentSearches = [];
        localStorage.removeItem('flowrack_recent_searches');
        this.showRecentSearches();
    }

    /**
     * Helper: Get status badge HTML
     */
    getStatusBadge(status) {
        const badges = {
            pending: '<span class="badge bg-warning">Pending</span>',
            approved: '<span class="badge bg-success">Approved</span>',
            rejected: '<span class="badge bg-danger">Rejected</span>',
            delivered: '<span class="badge bg-info">Delivered</span>'
        };
        return badges[status] || status;
    }

    /**
     * Helper: Format date
     */
    formatDate(date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleDateString();
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new GlobalSearch();
    });
} else {
    new GlobalSearch();
}

// Export for use in other modules
window.GlobalSearch = GlobalSearch;
