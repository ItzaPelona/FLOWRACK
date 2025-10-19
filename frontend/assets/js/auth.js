/**
 * FlowRack Authentication Helper
 * Handles authentication-related functionality
 */

const Auth = {
    /**
     * Check if user is authenticated
     * @returns {boolean} Authentication status
     */
    isAuthenticated() {
        const token = localStorage.getItem('flowrack_token');
        return token !== null && token !== undefined;
    },
    
    /**
     * Get current user from storage
     * @returns {Object|null} User object or null
     */
    getCurrentUser() {
        if (!this.isAuthenticated()) return null;
        
        try {
            const userStr = localStorage.getItem('flowrack_user');
            return userStr ? JSON.parse(userStr) : null;
        } catch (e) {
            console.error('Failed to parse user data:', e);
            return null;
        }
    },
    
    /**
     * Set current user in storage
     * @param {Object} user - User object to store
     */
    setCurrentUser(user) {
        if (user) {
            localStorage.setItem('flowrack_user', JSON.stringify(user));
        } else {
            localStorage.removeItem('flowrack_user');
        }
    },
    
    /**
     * Get authentication token
     * @returns {string|null} Token or null
     */
    getToken() {
        return localStorage.getItem('flowrack_token');
    },
    
    /**
     * Set authentication token
     * @param {string} token - JWT token
     */
    setToken(token) {
        if (token) {
            localStorage.setItem('flowrack_token', token);
        } else {
            localStorage.removeItem('flowrack_token');
        }
    },
    
    /**
     * Clear all authentication data
     */
    clearAuth() {
        localStorage.removeItem('flowrack_token');
        localStorage.removeItem('flowrack_user');
        localStorage.removeItem('flowrack_preferences');
    },
    
    /**
     * Check if user has specific role
     * @param {string} role - Role to check
     * @returns {boolean} True if user has role
     */
    hasRole(role) {
        const user = this.getCurrentUser();
        return user && user.role === role;
    },
    
    /**
     * Check if user has any of the specified roles
     * @param {Array<string>} roles - Roles to check
     * @returns {boolean} True if user has any role
     */
    hasAnyRole(roles) {
        const user = this.getCurrentUser();
        return user && roles.includes(user.role);
    },
    
    /**
     * Check if user can perform action based on role
     * @param {string} action - Action to check
     * @returns {boolean} True if user can perform action
     */
    canPerform(action) {
        const user = this.getCurrentUser();
        if (!user) return false;
        
        const permissions = {
            // Admin permissions
            'manage_users': ['admin'],
            'manage_products': ['admin', 'operator'],
            'manage_inventory': ['admin', 'operator'],
            'view_all_requests': ['admin', 'operator'],
            'approve_requests': ['admin', 'operator'],
            'manage_deliveries': ['admin', 'operator'],
            'manage_debts': ['admin', 'operator'],
            'view_analytics': ['admin', 'operator'],
            
            // User permissions
            'create_requests': ['admin', 'operator', 'user'],
            'view_own_requests': ['admin', 'operator', 'user'],
            'view_own_debts': ['admin', 'operator', 'user'],
            'cancel_own_requests': ['admin', 'operator', 'user'],
            'update_profile': ['admin', 'operator', 'user']
        };
        
        const allowedRoles = permissions[action];
        return allowedRoles && allowedRoles.includes(user.role);
    },
    
    /**
     * Get user preferences
     * @returns {Object} User preferences
     */
    getPreferences() {
        try {
            const prefs = localStorage.getItem('flowrack_preferences');
            return prefs ? JSON.parse(prefs) : {};
        } catch (e) {
            console.error('Failed to parse preferences:', e);
            return {};
        }
    },
    
    /**
     * Set user preferences
     * @param {Object} preferences - Preferences object
     */
    setPreferences(preferences) {
        localStorage.setItem('flowrack_preferences', JSON.stringify(preferences));
    },
    
    /**
     * Update specific preference
     * @param {string} key - Preference key
     * @param {*} value - Preference value
     */
    updatePreference(key, value) {
        const prefs = this.getPreferences();
        prefs[key] = value;
        this.setPreferences(prefs);
    },
    
    /**
     * Check token expiration (simplified check)
     * @returns {boolean} True if token appears valid
     */
    isTokenValid() {
        const token = this.getToken();
        if (!token) return false;
        
        try {
            // Simple check - in production, you'd want to verify with server
            const parts = token.split('.');
            if (parts.length !== 3) return false;
            
            const payload = JSON.parse(atob(parts[1]));
            const exp = payload.exp * 1000; // Convert to milliseconds
            
            return Date.now() < exp;
        } catch (e) {
            console.error('Token validation error:', e);
            return false;
        }
    },
    
    /**
     * Automatically refresh token if needed
     * @returns {Promise<boolean>} Success status
     */
    async refreshTokenIfNeeded() {
        if (!this.isAuthenticated()) return false;
        
        try {
            const response = await API.verifyToken();
            if (response.valid) {
                this.setCurrentUser(response.user);
                return true;
            } else {
                this.clearAuth();
                return false;
            }
        } catch (error) {
            console.error('Token refresh failed:', error);
            this.clearAuth();
            return false;
        }
    },
    
    /**
     * Login with credentials
     * @param {string} registrationNumber - User registration number
     * @param {string} password - User password
     * @returns {Promise<Object>} Login response
     */
    async login(registrationNumber, password) {
        try {
            const response = await API.login(registrationNumber, password);
            
            if (response.access_token && response.user) {
                this.setToken(response.access_token);
                this.setCurrentUser(response.user);
                
                // Update UI based on user role
                document.body.className = `role-${response.user.role}`;
                
                return response;
            } else {
                throw new Error('Invalid response from server');
            }
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    },
    
    /**
     * Logout user
     * @returns {Promise<boolean>} Success status
     */
    async logout() {
        try {
            // Try to notify server about logout
            if (this.isAuthenticated()) {
                try {
                    await API.logout();
                } catch (e) {
                    // Continue with logout even if server request fails
                    console.warn('Server logout failed:', e);
                }
            }
            
            // Clear local authentication data
            this.clearAuth();
            
            // Reset UI
            document.body.className = '';
            
            // Redirect to login
            if (typeof App !== 'undefined' && App.showView) {
                App.showView('login');
            }
            
            return true;
        } catch (error) {
            console.error('Logout error:', error);
            return false;
        }
    },
    
    /**
     * Initialize authentication on app load
     */
    async initialize() {
        try {
            // Check if user is authenticated
            if (this.isAuthenticated()) {
                // Verify token with server
                const isValid = await this.refreshTokenIfNeeded();
                
                if (isValid) {
                    const user = this.getCurrentUser();
                    if (user) {
                        document.body.className = `role-${user.role}`;
                        return user;
                    }
                }
            }
            
            // Not authenticated or token invalid
            this.clearAuth();
            return null;
        } catch (error) {
            console.error('Auth initialization error:', error);
            this.clearAuth();
            return null;
        }
    },
    
    /**
     * Set up automatic token refresh
     */
    setupAutoRefresh() {
        // Refresh token every 30 minutes
        setInterval(async () => {
            if (this.isAuthenticated()) {
                await this.refreshTokenIfNeeded();
            }
        }, 30 * 60 * 1000); // 30 minutes
    },
    
    /**
     * Handle authentication errors
     * @param {Error} error - Authentication error
     */
    handleAuthError(error) {
        console.error('Authentication error:', error);
        
        // If error suggests invalid/expired token, logout
        if (error.message && (
            error.message.includes('token') ||
            error.message.includes('unauthorized') ||
            error.message.includes('401')
        )) {
            this.logout();
        }
    }
};

// Set up authentication interceptor for API requests
if (typeof API !== 'undefined') {
    const originalRequest = API.request;
    API.request = async function(endpoint, options = {}) {
        try {
            return await originalRequest.call(this, endpoint, options);
        } catch (error) {
            // Handle authentication errors
            if (error.message && error.message.includes('401')) {
                Auth.handleAuthError(error);
            }
            throw error;
        }
    };
}

// Export for use in other modules
window.Auth = Auth;