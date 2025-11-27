/**
 * FlowRack Favorites Manager
 * Pin and manage frequently requested items
 */

class FavoritesManager {
    constructor() {
        this.favorites = this.loadFavorites();
        this.panelOpen = false;
        this.panel = null;
        this.init();
    }

    /**
     * Initialize favorites manager
     */
    init() {
        this.createPanel();
        this.createToggleButton();
        this.renderFavorites();
        window.FavoritesManager = this;
        console.log('⭐ FavoritesManager initialized');
    }

    /**
     * Create favorites panel
     */
    createPanel() {
        const panelHTML = `
            <div class="favorites-panel" id="favoritesPanel">
                <div class="favorites-panel-header">
                    <h5 class="favorites-panel-title">
                        <i class="bi bi-star-fill"></i>
                        Favorites
                    </h5>
                </div>
                
                <div class="favorites-panel-body" id="favoritesPanelBody">
                    <!-- Favorites will be rendered here -->
                </div>
                
                <div class="favorites-stats" id="favoritesStats">
                    <div class="favorites-stat">
                        <span class="favorites-stat-value" id="favoritesCount">0</span>
                        <span class="favorites-stat-label">Pinned</span>
                    </div>
                    <div class="favorites-stat">
                        <span class="favorites-stat-value" id="favoritesUsed">0</span>
                        <span class="favorites-stat-label">Used</span>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', panelHTML);
        this.panel = document.getElementById('favoritesPanel');
        
        // Close panel when clicking outside
        document.addEventListener('click', (e) => {
            if (this.panelOpen && 
                !this.panel.contains(e.target) && 
                !e.target.closest('.favorites-toggle-btn') &&
                !e.target.closest('.favorite-star-btn')) {
                this.closePanel();
            }
        });
    }

    /**
     * Create toggle button
     */
    createToggleButton() {
        const buttonHTML = `
            <button class="favorites-toggle-btn" id="favoritesToggleBtn" title="Favorites">
                <i class="bi bi-star-fill"></i>
                <span class="badge" id="favoritesCountBadge" style="display: none;">0</span>
            </button>
        `;
        
        document.body.insertAdjacentHTML('beforeend', buttonHTML);
        
        document.getElementById('favoritesToggleBtn').addEventListener('click', () => {
            this.togglePanel();
        });
    }

    /**
     * Load favorites from localStorage
     */
    loadFavorites() {
        try {
            const stored = localStorage.getItem('flowrack_favorites');
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error loading favorites:', error);
            return [];
        }
    }

    /**
     * Save favorites to localStorage
     */
    saveFavorites() {
        try {
            localStorage.setItem('flowrack_favorites', JSON.stringify(this.favorites));
        } catch (error) {
            console.error('Error saving favorites:', error);
        }
    }

    /**
     * Add item to favorites
     */
    addFavorite(item) {
        // Check if already exists
        const exists = this.favorites.some(fav => 
            fav.id === item.id && fav.type === item.type
        );
        
        if (exists) {
            this.showNotification('Already in favorites', 'info');
            return;
        }
        
        // Add favorite with metadata
        const favorite = {
            id: item.id,
            type: item.type || 'product',
            name: item.name,
            sku: item.sku,
            category: item.category,
            addedAt: new Date().toISOString(),
            usedCount: 0
        };
        
        this.favorites.unshift(favorite);
        this.saveFavorites();
        this.renderFavorites();
        this.updateStarButtons(item.id, item.type, true);
        
        this.showNotification(`Added ${item.name} to favorites`, 'success');
        console.log('⭐ Added to favorites:', favorite);
    }

    /**
     * Remove item from favorites
     */
    removeFavorite(id, type = 'product') {
        const index = this.favorites.findIndex(fav => 
            fav.id === id && fav.type === type
        );
        
        if (index === -1) return;
        
        const removed = this.favorites.splice(index, 1)[0];
        this.saveFavorites();
        this.renderFavorites();
        this.updateStarButtons(id, type, false);
        
        this.showNotification(`Removed ${removed.name} from favorites`, 'info');
        console.log('⭐ Removed from favorites:', removed);
    }

    /**
     * Toggle favorite
     */
    toggleFavorite(item) {
        const isFavorite = this.isFavorite(item.id, item.type);
        
        if (isFavorite) {
            this.removeFavorite(item.id, item.type);
        } else {
            this.addFavorite(item);
        }
    }

    /**
     * Check if item is favorite
     */
    isFavorite(id, type = 'product') {
        return this.favorites.some(fav => 
            fav.id === id && fav.type === type
        );
    }

    /**
     * Increment usage count
     */
    incrementUsage(id, type = 'product') {
        const favorite = this.favorites.find(fav => 
            fav.id === id && fav.type === type
        );
        
        if (favorite) {
            favorite.usedCount = (favorite.usedCount || 0) + 1;
            favorite.lastUsed = new Date().toISOString();
            this.saveFavorites();
            this.renderFavorites();
        }
    }

    /**
     * Render favorites in panel
     */
    renderFavorites() {
        const container = document.getElementById('favoritesPanelBody');
        const countBadge = document.getElementById('favoritesCountBadge');
        const countStat = document.getElementById('favoritesCount');
        const usedStat = document.getElementById('favoritesUsed');
        
        // Update counts
        const count = this.favorites.length;
        const totalUsed = this.favorites.reduce((sum, fav) => sum + (fav.usedCount || 0), 0);
        
        if (count > 0) {
            countBadge.textContent = count;
            countBadge.style.display = 'block';
        } else {
            countBadge.style.display = 'none';
        }
        
        countStat.textContent = count;
        usedStat.textContent = totalUsed;
        
        // Render items
        if (this.favorites.length === 0) {
            container.innerHTML = `
                <div class="favorites-empty">
                    <div class="favorites-empty-icon">
                        <i class="bi bi-star"></i>
                    </div>
                    <div class="favorites-empty-title">No favorites yet</div>
                    <div class="favorites-empty-text">
                        Click the star icon on any product to add it here
                    </div>
                </div>
            `;
            return;
        }
        
        // Group by type
        const grouped = this.groupByType();
        
        let html = '';
        
        Object.entries(grouped).forEach(([type, items]) => {
            if (items.length === 0) return;
            
            html += `
                <div class="favorites-section">
                    <h6 class="favorites-section-title">
                        ${this.getTypeIcon(type)} ${this.getTypeLabel(type)} (${items.length})
                    </h6>
                    ${items.map(item => this.renderFavoriteItem(item)).join('')}
                </div>
            `;
        });
        
        container.innerHTML = html;
        this.setupFavoriteListeners();
    }

    /**
     * Render single favorite item
     */
    renderFavoriteItem(item) {
        return `
            <div class="favorite-item" data-id="${item.id}" data-type="${item.type}">
                <button class="remove-favorite-btn" data-id="${item.id}" data-type="${item.type}">
                    <i class="bi bi-x"></i>
                </button>
                
                <div class="favorite-item-header">
                    <div class="favorite-item-icon">
                        <i class="bi bi-${this.getTypeIcon(item.type)}"></i>
                    </div>
                    <div class="favorite-item-info">
                        <div class="favorite-item-name" title="${item.name}">
                            ${item.name}
                        </div>
                        ${item.sku ? `<div class="favorite-item-sku">SKU: ${item.sku}</div>` : ''}
                    </div>
                </div>
                
                <div class="favorite-item-actions">
                    <button class="btn btn-sm btn-primary request-favorite-btn" 
                            data-id="${item.id}" data-type="${item.type}">
                        <i class="bi bi-plus-circle"></i> Request
                    </button>
                    <button class="btn btn-sm btn-outline-secondary view-favorite-btn" 
                            data-id="${item.id}" data-type="${item.type}">
                        <i class="bi bi-eye"></i> View
                    </button>
                </div>
                
                ${item.usedCount > 0 ? `
                    <div style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--text-muted);">
                        <i class="bi bi-graph-up"></i> Used ${item.usedCount} time${item.usedCount !== 1 ? 's' : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Setup favorite item listeners
     */
    setupFavoriteListeners() {
        // Remove buttons
        document.querySelectorAll('.remove-favorite-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                const type = btn.dataset.type;
                this.removeFavorite(id, type);
            });
        });
        
        // Request buttons
        document.querySelectorAll('.request-favorite-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                const type = btn.dataset.type;
                this.requestFavorite(id, type);
            });
        });
        
        // View buttons
        document.querySelectorAll('.view-favorite-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                const type = btn.dataset.type;
                this.viewFavorite(id, type);
            });
        });
        
        // Item click
        document.querySelectorAll('.favorite-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('button')) {
                    const id = parseInt(item.dataset.id);
                    const type = item.dataset.type;
                    this.viewFavorite(id, type);
                }
            });
        });
    }

    /**
     * Request a favorite item
     */
    requestFavorite(id, type) {
        this.incrementUsage(id, type);
        
        if (typeof showView === 'function') {
            showView('new-request');
            // Pre-fill product if possible
            setTimeout(() => {
                const productSelect = document.getElementById('requestProduct');
                if (productSelect && type === 'product') {
                    productSelect.value = id;
                    productSelect.dispatchEvent(new Event('change'));
                }
            }, 100);
        }
        
        this.closePanel();
    }

    /**
     * View favorite item details
     */
    viewFavorite(id, type) {
        this.incrementUsage(id, type);
        
        // Navigate based on type
        if (typeof showView === 'function') {
            switch (type) {
                case 'product':
                    showView('products');
                    break;
                case 'request':
                    showView('requests');
                    break;
                default:
                    showView('dashboard');
            }
        }
        
        this.closePanel();
    }

    /**
     * Group favorites by type
     */
    groupByType() {
        return this.favorites.reduce((groups, item) => {
            const type = item.type || 'product';
            if (!groups[type]) groups[type] = [];
            groups[type].push(item);
            return groups;
        }, {});
    }

    /**
     * Get type icon
     */
    getTypeIcon(type) {
        const icons = {
            product: 'box-seam',
            request: 'clipboard-check',
            supplier: 'truck'
        };
        return icons[type] || 'star';
    }

    /**
     * Get type label
     */
    getTypeLabel(type) {
        const labels = {
            product: 'Products',
            request: 'Requests',
            supplier: 'Suppliers'
        };
        return labels[type] || type;
    }

    /**
     * Update star buttons in the UI
     */
    updateStarButtons(id, type, isFavorite) {
        const buttons = document.querySelectorAll(`.favorite-star-btn[data-id="${id}"][data-type="${type}"]`);
        buttons.forEach(btn => {
            if (isFavorite) {
                btn.classList.add('active');
                btn.querySelector('i').className = 'bi bi-star-fill';
                btn.title = 'Remove from favorites';
            } else {
                btn.classList.remove('active');
                btn.querySelector('i').className = 'bi bi-star';
                btn.title = 'Add to favorites';
            }
        });
    }

    /**
     * Toggle panel open/close
     */
    togglePanel() {
        if (this.panelOpen) {
            this.closePanel();
        } else {
            this.openPanel();
        }
    }

    /**
     * Open panel
     */
    openPanel() {
        this.panel.classList.add('open');
        this.panelOpen = true;
        this.renderFavorites(); // Refresh
    }

    /**
     * Close panel
     */
    closePanel() {
        this.panel.classList.remove('open');
        this.panelOpen = false;
    }

    /**
     * Create star button for products
     */
    static createStarButton(item) {
        const isFavorite = window.FavoritesManager?.isFavorite(item.id, item.type || 'product');
        
        return `
            <button class="favorite-star-btn ${isFavorite ? 'active' : ''}" 
                    data-id="${item.id}" 
                    data-type="${item.type || 'product'}"
                    title="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
                <i class="bi bi-star${isFavorite ? '-fill' : ''}"></i>
            </button>
        `;
    }

    /**
     * Setup star button listener
     */
    static setupStarButton(button, item) {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            if (window.FavoritesManager) {
                window.FavoritesManager.toggleFavorite(item);
            }
        });
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'success') {
        if (typeof showSuccess === 'function' && type === 'success') {
            showSuccess(message);
        } else if (typeof showError === 'function' && type === 'error') {
            showError(message);
        } else {
            console.log('⭐', message);
        }
    }

    /**
     * Get favorites
     */
    getFavorites() {
        return this.favorites;
    }

    /**
     * Clear all favorites
     */
    clearAll() {
        if (confirm('Are you sure you want to remove all favorites?')) {
            this.favorites = [];
            this.saveFavorites();
            this.renderFavorites();
            this.showNotification('All favorites cleared', 'info');
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new FavoritesManager();
    });
} else {
    new FavoritesManager();
}

// Export
window.FavoritesManager = FavoritesManager;
