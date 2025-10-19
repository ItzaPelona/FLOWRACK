/**
 * FlowRack Utility Functions
 * Common helper functions used throughout the application
 */

const Utils = {
    /**
     * Format date and time for display
     * @param {string|Date} dateTime - Date/time to format
     * @param {boolean} includeTime - Whether to include time
     * @returns {string} Formatted date/time string
     */
    formatDateTime(dateTime, includeTime = true) {
        if (!dateTime) return 'N/A';
        
        const date = new Date(dateTime);
        if (isNaN(date.getTime())) return 'Invalid Date';
        
        const options = {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        };
        
        if (includeTime) {
            options.hour = '2-digit';
            options.minute = '2-digit';
        }
        
        return date.toLocaleDateString(undefined, options);
    },
    
    /**
     * Format date for input fields (YYYY-MM-DD)
     * @param {string|Date} date - Date to format
     * @returns {string} Formatted date string
     */
    formatDateForInput(date) {
        if (!date) return '';
        
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        
        return d.toISOString().split('T')[0];
    },
    
    /**
     * Format time for input fields (HH:MM)
     * @param {string|Date} time - Time to format
     * @returns {string} Formatted time string
     */
    formatTimeForInput(time) {
        if (!time) return '';
        
        if (typeof time === 'string' && time.includes(':')) {
            return time.substring(0, 5); // Return HH:MM part
        }
        
        const d = new Date(time);
        if (isNaN(d.getTime())) return '';
        
        return d.toTimeString().substring(0, 5);
    },
    
    /**
     * Format currency amount
     * @param {number} amount - Amount to format
     * @param {string} currency - Currency code (default: USD)
     * @returns {string} Formatted currency string
     */
    formatCurrency(amount, currency = 'USD') {
        if (amount === null || amount === undefined || isNaN(amount)) return '$0.00';
        
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency
        }).format(amount);
    },
    
    /**
     * Format number with thousand separators
     * @param {number} number - Number to format
     * @param {number} decimals - Number of decimal places
     * @returns {string} Formatted number string
     */
    formatNumber(number, decimals = 2) {
        if (number === null || number === undefined || isNaN(number)) return '0';
        
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(number);
    },
    
    /**
     * Get status badge class
     * @param {string} status - Status value
     * @returns {string} Bootstrap badge class
     */
    getStatusBadgeClass(status) {
        const statusClasses = {
            'pending': 'bg-warning text-dark',
            'approved': 'bg-info',
            'collecting': 'bg-primary',
            'delivered': 'bg-success',
            'returned': 'bg-secondary',
            'cancelled': 'bg-danger',
            'paid': 'bg-success',
            'waived': 'bg-info',
            'disputed': 'bg-warning text-dark',
            'in_stock': 'bg-success',
            'low_stock': 'bg-warning text-dark',
            'out_of_stock': 'bg-danger'
        };
        
        return statusClasses[status] || 'bg-light text-dark';
    },
    
    /**
     * Get status display text
     * @param {string} status - Status value
     * @returns {string} Display-friendly status text
     */
    getStatusDisplay(status) {
        const statusDisplay = {
            'pending': 'Pending',
            'approved': 'Approved',
            'collecting': 'Collecting',
            'delivered': 'Delivered',
            'returned': 'Returned',
            'cancelled': 'Cancelled',
            'paid': 'Paid',
            'waived': 'Waived',
            'disputed': 'Disputed',
            'in_stock': 'In Stock',
            'low_stock': 'Low Stock',
            'out_of_stock': 'Out of Stock'
        };
        
        return statusDisplay[status] || status;
    },
    
    /**
     * Validate email address
     * @param {string} email - Email to validate
     * @returns {boolean} True if valid email
     */
    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },
    
    /**
     * Validate phone number
     * @param {string} phone - Phone number to validate
     * @returns {boolean} True if valid phone
     */
    validatePhone(phone) {
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
    },
    
    /**
     * Debounce function calls
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    /**
     * Throttle function calls
     * @param {Function} func - Function to throttle
     * @param {number} limit - Time limit in milliseconds
     * @returns {Function} Throttled function
     */
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    /**
     * Generate unique ID
     * @returns {string} Unique ID
     */
    generateId() {
        return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    },
    
    /**
     * Deep clone object
     * @param {*} obj - Object to clone
     * @returns {*} Cloned object
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (typeof obj === 'object') {
            const clonedObj = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    clonedObj[key] = this.deepClone(obj[key]);
                }
            }
            return clonedObj;
        }
    },
    
    /**
     * Calculate time ago
     * @param {string|Date} date - Date to calculate from
     * @returns {string} Time ago string
     */
    timeAgo(date) {
        if (!date) return 'Unknown';
        
        const now = new Date();
        const past = new Date(date);
        const diffMs = now - past;
        
        if (diffMs < 0) return 'In the future';
        
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffSecs < 60) return 'Just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
        
        return this.formatDateTime(date, false);
    },
    
    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    /**
     * Store data in localStorage with expiration
     * @param {string} key - Storage key
     * @param {*} value - Value to store
     * @param {number} expirationHours - Expiration in hours
     */
    setLocalStorage(key, value, expirationHours = 24) {
        const item = {
            value: value,
            expiry: new Date().getTime() + (expirationHours * 60 * 60 * 1000)
        };
        localStorage.setItem(key, JSON.stringify(item));
    },
    
    /**
     * Get data from localStorage with expiration check
     * @param {string} key - Storage key
     * @returns {*} Stored value or null if expired/not found
     */
    getLocalStorage(key) {
        const itemStr = localStorage.getItem(key);
        if (!itemStr) return null;
        
        try {
            const item = JSON.parse(itemStr);
            if (new Date().getTime() > item.expiry) {
                localStorage.removeItem(key);
                return null;
            }
            return item.value;
        } catch (e) {
            localStorage.removeItem(key);
            return null;
        }
    },
    
    /**
     * Download data as file
     * @param {string} data - Data to download
     * @param {string} filename - File name
     * @param {string} type - MIME type
     */
    downloadFile(data, filename, type = 'text/plain') {
        const blob = new Blob([data], { type: type });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    },
    
    /**
     * Convert object to CSV
     * @param {Array} data - Array of objects
     * @param {Array} columns - Column definitions
     * @returns {string} CSV string
     */
    objectsToCsv(data, columns) {
        if (!data || data.length === 0) return '';
        
        const headers = columns ? columns.map(col => col.header || col.key) : Object.keys(data[0]);
        const keys = columns ? columns.map(col => col.key) : Object.keys(data[0]);
        
        const csvContent = [
            headers.join(','),
            ...data.map(row => 
                keys.map(key => {
                    const value = row[key];
                    if (value === null || value === undefined) return '';
                    if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                        return `"${value.replace(/"/g, '""')}"`;
                    }
                    return value;
                }).join(',')
            )
        ].join('\n');
        
        return csvContent;
    },
    
    /**
     * Print element content
     * @param {string} elementId - ID of element to print
     * @param {string} title - Print title
     */
    printElement(elementId, title = 'Print') {
        const element = document.getElementById(elementId);
        if (!element) {
            console.error('Element not found for printing');
            return;
        }
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${title}</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    @media print {
                        .no-print { display: none !important; }
                        .page-break { page-break-before: always; }
                    }
                </style>
            </head>
            <body>
                ${element.innerHTML}
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    },
    
    /**
     * Check if device is mobile
     * @returns {boolean} True if mobile device
     */
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },
    
    /**
     * Check if app is in PWA mode
     * @returns {boolean} True if in PWA mode
     */
    isPWA() {
        return window.matchMedia('(display-mode: standalone)').matches ||
               window.navigator.standalone ||
               document.referrer.includes('android-app://');
    },
    
    /**
     * Show native-like confirmation dialog
     * @param {string} message - Confirmation message
     * @returns {Promise<boolean>} User's choice
     */
    async confirm(message) {
        return new Promise((resolve) => {
            if (confirm(message)) {
                resolve(true);
            } else {
                resolve(false);
            }
        });
    }
};

// Export for use in other modules
window.Utils = Utils;