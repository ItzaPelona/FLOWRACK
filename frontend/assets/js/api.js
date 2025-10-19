/**
 * FlowRack API Client
 * Handles all API communications with the backend
 */

const API = {
    baseURL: window.location.origin + '/api',
    
    // Get authorization headers
    getHeaders() {
        const token = localStorage.getItem('flowrack_token');
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        return headers;
    },
    
    // Make API request
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: this.getHeaders(),
            ...options
        };
        
        try {
            const response = await fetch(url, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }
            
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },
    
    // Authentication endpoints
    async login(registrationNumber, password) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({
                registration_number: registrationNumber,
                password: password
            })
        });
    },
    
    async logout() {
        return this.request('/auth/logout', {
            method: 'POST'
        });
    },
    
    async verifyToken() {
        return this.request('/auth/verify-token', {
            method: 'POST'
        });
    },
    
    async getProfile() {
        return this.request('/auth/profile');
    },
    
    async changePassword(oldPassword, newPassword) {
        return this.request('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({
                old_password: oldPassword,
                new_password: newPassword
            })
        });
    },
    
    // User endpoints
    async getUsers(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/users${queryString ? '?' + queryString : ''}`);
    },
    
    async createUser(userData) {
        return this.request('/users', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    },
    
    async updateUser(userId, userData) {
        return this.request(`/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(userData)
        });
    },
    
    // Product endpoints
    async getProducts(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/products${queryString ? '?' + queryString : ''}`);
    },
    
    async getProduct(productId) {
        return this.request(`/products/${productId}`);
    },
    
    async createProduct(productData) {
        return this.request('/products', {
            method: 'POST',
            body: JSON.stringify(productData)
        });
    },
    
    async updateProduct(productId, productData) {
        return this.request(`/products/${productId}`, {
            method: 'PUT',
            body: JSON.stringify(productData)
        });
    },
    
    async updateStock(productId, stockData) {
        return this.request(`/products/${productId}/stock`, {
            method: 'PUT',
            body: JSON.stringify(stockData)
        });
    },
    
    async deleteProduct(productId) {
        return this.request(`/products/${productId}`, {
            method: 'DELETE'
        });
    },
    
    async getCategories() {
        return this.request('/products/categories');
    },
    
    async getLowStockProducts(threshold = 1.0) {
        return this.request(`/products/low-stock?threshold=${threshold}`);
    },
    
    async checkAvailability(productId, quantity) {
        return this.request(`/products/${productId}/availability?quantity=${quantity}`);
    },
    
    async getProductTransactions(productId, limit = 50) {
        return this.request(`/products/${productId}/transactions?limit=${limit}`);
    },
    
    // Request endpoints
    async getRequests(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/requests${queryString ? '?' + queryString : ''}`);
    },
    
    async getRequest(requestId) {
        return this.request(`/requests/${requestId}`);
    },
    
    async createRequest(requestData) {
        return this.request('/requests', {
            method: 'POST',
            body: JSON.stringify(requestData)
        });
    },
    
    async updateRequest(requestId, requestData) {
        return this.request(`/requests/${requestId}`, {
            method: 'PUT',
            body: JSON.stringify(requestData)
        });
    },
    
    async updateRequestStatus(requestId, status, notes = '') {
        return this.request(`/requests/${requestId}/status`, {
            method: 'PUT',
            body: JSON.stringify({
                status: status,
                notes: notes
            })
        });
    },
    
    async cancelRequest(requestId, reason = '') {
        return this.request(`/requests/${requestId}/cancel`, {
            method: 'POST',
            body: JSON.stringify({
                reason: reason
            })
        });
    },
    
    // Debt endpoints
    async getDebts(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/debts${queryString ? '?' + queryString : ''}`);
    },
    
    async getDebt(debtId) {
        return this.request(`/debts/${debtId}`);
    },
    
    async createDebt(debtData) {
        return this.request('/debts', {
            method: 'POST',
            body: JSON.stringify(debtData)
        });
    },
    
    async updateDebt(debtId, debtData) {
        return this.request(`/debts/${debtId}`, {
            method: 'PUT',
            body: JSON.stringify(debtData)
        });
    },
    
    async resolveDebt(debtId, resolution) {
        return this.request(`/debts/${debtId}/resolve`, {
            method: 'POST',
            body: JSON.stringify(resolution)
        });
    },
    
    // Dashboard endpoints
    async getDashboard() {
        return this.request('/dashboard');
    },
    
    async getRecentActivity(limit = 10) {
        return this.request(`/dashboard/activity?limit=${limit}`);
    },
    
    async getAnalytics(period = 'week') {
        return this.request(`/dashboard/analytics?period=${period}`);
    },
    
    // Delivery endpoints
    async getDeliveries(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/deliveries${queryString ? '?' + queryString : ''}`);
    },
    
    async updateDelivery(deliveryId, deliveryData) {
        return this.request(`/deliveries/${deliveryId}`, {
            method: 'PUT',
            body: JSON.stringify(deliveryData)
        });
    },
    
    async recordWeight(deliveryId, weightData) {
        return this.request(`/deliveries/${deliveryId}/weight`, {
            method: 'POST',
            body: JSON.stringify(weightData)
        });
    },
    
    // Search endpoints
    async search(query, type = 'all') {
        return this.request(`/search?q=${encodeURIComponent(query)}&type=${type}`);
    },
    
    // File upload helper
    async uploadFile(endpoint, file, additionalData = {}) {
        const token = localStorage.getItem('flowrack_token');
        const formData = new FormData();
        
        formData.append('file', file);
        
        // Add additional data
        Object.keys(additionalData).forEach(key => {
            formData.append(key, additionalData[key]);
        });
        
        const response = await fetch(`${this.baseURL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || `HTTP ${response.status}`);
        }
        
        return response.json();
    }
};

// Export for use in other modules
window.API = API;