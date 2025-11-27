/**
 * FlowRack Keyboard Shortcuts Manager
 * Power user features with customizable keyboard shortcuts
 */

class KeyboardShortcuts {
    constructor() {
        this.shortcuts = {
            // Navigation
            'ctrl+d': { action: () => this.navigate('dashboard'), description: 'Go to Dashboard', category: 'Navigation' },
            'ctrl+shift+r': { action: () => this.navigate('requests'), description: 'View Requests', category: 'Navigation' },
            'ctrl+shift+p': { action: () => this.navigate('products'), description: 'View Products', category: 'Navigation' },
            'ctrl+shift+s': { action: () => this.navigate('suppliers'), description: 'View Suppliers', category: 'Navigation' },
            
            // Actions
            'ctrl+n': { action: () => this.newRequest(), description: 'New Request', category: 'Actions' },
            'ctrl+shift+n': { action: () => this.newProduct(), description: 'New Product', category: 'Actions' },
            'ctrl+s': { action: (e) => this.save(e), description: 'Save Current Form', category: 'Actions' },
            'ctrl+k': { action: () => this.openSearch(), description: 'Open Global Search', category: 'Search' },
            '/': { action: () => this.focusSearch(), description: 'Focus Search', category: 'Search' },
            
            // UI
            'ctrl+shift+d': { action: () => this.toggleTheme(), description: 'Toggle Dark/Light Mode', category: 'UI' },
            'ctrl+shift+l': { action: () => this.toggleLanguage(), description: 'Toggle Language', category: 'UI' },
            'ctrl+shift+f': { action: () => this.toggleFavorites(), description: 'Toggle Favorites Panel', category: 'UI' },
            
            // Help
            'ctrl+shift+h': { action: () => this.showHelp(), description: 'Show Keyboard Shortcuts', category: 'Help' },
            '?': { action: () => this.showHelp(), description: 'Show Help', category: 'Help' },
            
            // Utility
            'esc': { action: () => this.escape(), description: 'Close Modal/Cancel', category: 'Utility' },
            'ctrl+shift+r': { action: () => this.refresh(), description: 'Refresh Current View', category: 'Utility' }
        };
        
        this.enabled = true;
        this.modal = null;
        this.init();
    }

    /**
     * Initialize keyboard shortcuts
     */
    init() {
        this.setupEventListeners();
        this.createHelpModal();
        window.KeyboardShortcuts = this;
        console.log('⌨️ KeyboardShortcuts initialized');
    }

    /**
     * Setup keyboard event listeners
     */
    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (!this.enabled) return;
            
            // Don't trigger shortcuts if user is typing in input
            if (this.isInputFocused() && !this.isSpecialKey(e)) {
                return;
            }
            
            const key = this.getKeyCombo(e);
            const shortcut = this.shortcuts[key];
            
            if (shortcut) {
                e.preventDefault();
                shortcut.action(e);
            }
        });
    }

    /**
     * Get key combination string
     */
    getKeyCombo(e) {
        const parts = [];
        
        if (e.ctrlKey || e.metaKey) parts.push('ctrl');
        if (e.shiftKey) parts.push('shift');
        if (e.altKey) parts.push('alt');
        
        // Get the actual key
        let key = e.key.toLowerCase();
        
        // Handle special keys
        if (key === 'escape') key = 'esc';
        
        parts.push(key);
        
        return parts.join('+');
    }

    /**
     * Check if input is focused
     */
    isInputFocused() {
        const active = document.activeElement;
        return active.tagName === 'INPUT' || 
               active.tagName === 'TEXTAREA' ||
               active.isContentEditable;
    }

    /**
     * Check if it's a special key that should work even in inputs
     */
    isSpecialKey(e) {
        return e.key === 'Escape' || 
               (e.ctrlKey && e.key === 'k') ||
               (e.ctrlKey && e.key === 's');
    }

    /**
     * Navigate to a view
     */
    navigate(view) {
        if (typeof showView === 'function') {
            showView(view);
            this.showNotification(`Navigated to ${view}`);
        }
    }

    /**
     * Create new request
     */
    newRequest() {
        if (typeof showView === 'function') {
            showView('new-request');
            this.showNotification('Creating new request...');
        }
    }

    /**
     * Create new product
     */
    newProduct() {
        // Trigger new product modal or view
        const newProductBtn = document.querySelector('[data-action="new-product"]');
        if (newProductBtn) {
            newProductBtn.click();
            this.showNotification('Creating new product...');
        }
    }

    /**
     * Save current form
     */
    save(e) {
        const saveBtn = document.querySelector('button[type="submit"]:visible, .btn-save:visible');
        if (saveBtn) {
            e.preventDefault();
            saveBtn.click();
            this.showNotification('Saving...');
        }
    }

    /**
     * Open global search
     */
    openSearch() {
        if (window.GlobalSearch) {
            window.GlobalSearch.open();
        }
    }

    /**
     * Focus search input
     */
    focusSearch() {
        const searchInput = document.querySelector('input[type="search"], #searchInput');
        if (searchInput) {
            searchInput.focus();
        } else {
            this.openSearch();
        }
    }

    /**
     * Toggle theme
     */
    toggleTheme() {
        if (window.ThemeManager) {
            window.ThemeManager.toggleTheme();
        }
    }

    /**
     * Toggle language
     */
    toggleLanguage() {
        if (window.I18n) {
            const currentLang = window.I18n.getLanguage();
            const newLang = currentLang === 'en' ? 'es' : 'en';
            window.I18n.setLanguage(newLang);
        }
    }

    /**
     * Toggle favorites panel
     */
    toggleFavorites() {
        if (window.FavoritesManager) {
            window.FavoritesManager.togglePanel();
        }
    }

    /**
     * Refresh current view
     */
    refresh() {
        const refreshBtn = document.querySelector('.btn-refresh, [data-action="refresh"]');
        if (refreshBtn) {
            refreshBtn.click();
        } else {
            window.location.reload();
        }
    }

    /**
     * Escape/Cancel
     */
    escape() {
        // Close any open modals
        const openModal = document.querySelector('.modal.show');
        if (openModal) {
            const modal = bootstrap.Modal.getInstance(openModal);
            if (modal) modal.hide();
        }
    }

    /**
     * Show keyboard shortcuts help
     */
    showHelp() {
        if (this.modal) {
            this.modal.show();
        }
    }

    /**
     * Create help modal
     */
    createHelpModal() {
        const categories = this.groupByCategory();
        
        const modalHTML = `
            <div class="modal fade" id="keyboardShortcutsModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="bi bi-keyboard"></i> Keyboard Shortcuts
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            ${Object.entries(categories).map(([category, shortcuts]) => `
                                <div class="shortcut-category mb-4">
                                    <h6 class="shortcut-category-title text-muted text-uppercase mb-3">
                                        ${category}
                                    </h6>
                                    <div class="shortcut-list">
                                        ${shortcuts.map(([key, data]) => `
                                            <div class="shortcut-item">
                                                <div class="shortcut-description">${data.description}</div>
                                                <div class="shortcut-keys">
                                                    ${this.formatKeyCombo(key)}
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <style>
                .shortcut-category-title {
                    font-weight: 600;
                    font-size: 0.875rem;
                    letter-spacing: 0.5px;
                    border-bottom: 2px solid var(--border-color);
                    padding-bottom: 0.5rem;
                }
                
                .shortcut-list {
                    display: grid;
                    gap: 0.75rem;
                }
                
                .shortcut-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.75rem;
                    background: var(--bg-secondary);
                    border-radius: 6px;
                    transition: all 0.2s ease;
                }
                
                .shortcut-item:hover {
                    background: var(--bg-hover);
                    transform: translateX(4px);
                }
                
                .shortcut-description {
                    color: var(--text-primary);
                    font-size: 0.95rem;
                }
                
                .shortcut-keys {
                    display: flex;
                    gap: 0.25rem;
                }
                
                .shortcut-key {
                    display: inline-block;
                    padding: 0.25rem 0.5rem;
                    background: var(--bg-card);
                    border: 1px solid var(--border-color);
                    border-radius: 4px;
                    font-family: monospace;
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    box-shadow: 0 2px 0 var(--border-color);
                    min-width: 2rem;
                    text-align: center;
                }
                
                @media (max-width: 768px) {
                    .shortcut-item {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 0.5rem;
                    }
                }
            </style>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = new bootstrap.Modal(document.getElementById('keyboardShortcutsModal'));
    }

    /**
     * Group shortcuts by category
     */
    groupByCategory() {
        const categories = {};
        
        Object.entries(this.shortcuts).forEach(([key, data]) => {
            const category = data.category || 'Other';
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push([key, data]);
        });
        
        return categories;
    }

    /**
     * Format key combination for display
     */
    formatKeyCombo(combo) {
        const parts = combo.split('+').map(part => {
            const keyMap = {
                'ctrl': window.navigator.platform.includes('Mac') ? '⌘' : 'Ctrl',
                'shift': '⇧',
                'alt': window.navigator.platform.includes('Mac') ? '⌥' : 'Alt',
                'esc': 'Esc',
                '/': '/',
                '?': '?'
            };
            
            return `<span class="shortcut-key">${keyMap[part] || part.toUpperCase()}</span>`;
        });
        
        return parts.join('<span style="margin: 0 0.125rem;">+</span>');
    }

    /**
     * Show notification
     */
    showNotification(message) {
        if (typeof showSuccess === 'function') {
            showSuccess(message);
        } else {
            console.log('⌨️', message);
        }
    }

    /**
     * Enable shortcuts
     */
    enable() {
        this.enabled = true;
        console.log('⌨️ Keyboard shortcuts enabled');
    }

    /**
     * Disable shortcuts
     */
    disable() {
        this.enabled = false;
        console.log('⌨️ Keyboard shortcuts disabled');
    }

    /**
     * Add custom shortcut
     */
    addShortcut(key, action, description, category = 'Custom') {
        this.shortcuts[key] = {
            action,
            description,
            category
        };
        console.log(`⌨️ Added shortcut: ${key}`);
    }

    /**
     * Remove shortcut
     */
    removeShortcut(key) {
        delete this.shortcuts[key];
        console.log(`⌨️ Removed shortcut: ${key}`);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new KeyboardShortcuts();
    });
} else {
    new KeyboardShortcuts();
}

// Export
window.KeyboardShortcuts = KeyboardShortcuts;
