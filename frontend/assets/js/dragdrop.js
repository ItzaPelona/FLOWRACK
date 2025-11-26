/**
 * Dashboard Card Drag and Drop Module
 * Allows users to reorder dashboard statistics cards and saves positions
 */

const DragDropCards = {
    draggedElement: null,
    draggedIndex: null,
    
    /**
     * Initialize drag and drop for dashboard cards
     */
    init() {
        this.setupDraggableCards();
        this.loadSavedPositions();
    },
    
    /**
     * Setup draggable functionality for all stat cards
     */
    setupDraggableCards() {
        // Wait for dashboard to be loaded
        setTimeout(() => {
            const containers = [
                document.querySelector('.user-only.row'),
                document.querySelector('.operator-only.row'),
                document.querySelector('.admin-only.row')
            ];
            
            containers.forEach(container => {
                if (container) {
                    this.makeDraggable(container);
                }
            });
        }, 500);
    },
    
    /**
     * Make cards in a container draggable
     */
    makeDraggable(container) {
        const cards = container.querySelectorAll('.col-3, .col-md-3');
        
        cards.forEach((card, index) => {
            card.setAttribute('draggable', 'true');
            card.classList.add('draggable-card');
            card.dataset.originalIndex = index;
            
            // Drag start
            card.addEventListener('dragstart', (e) => {
                this.draggedElement = card;
                this.draggedIndex = index;
                card.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', card.innerHTML);
            });
            
            // Drag end
            card.addEventListener('dragend', (e) => {
                card.classList.remove('dragging');
                this.savePositions(container);
                
                // Remove all drag-over classes
                const allCards = container.querySelectorAll('.col-3, .col-md-3');
                allCards.forEach(c => c.classList.remove('drag-over'));
            });
            
            // Drag over
            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                if (card !== this.draggedElement) {
                    card.classList.add('drag-over');
                }
            });
            
            // Drag leave
            card.addEventListener('dragleave', (e) => {
                card.classList.remove('drag-over');
            });
            
            // Drop
            card.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                card.classList.remove('drag-over');
                
                if (this.draggedElement !== card) {
                    // Swap the cards
                    this.swapCards(this.draggedElement, card, container);
                }
            });
        });
    },
    
    /**
     * Swap two cards in the DOM
     */
    swapCards(card1, card2, container) {
        const allCards = Array.from(container.querySelectorAll('.col-3, .col-md-3'));
        const index1 = allCards.indexOf(card1);
        const index2 = allCards.indexOf(card2);
        
        if (index1 < index2) {
            container.insertBefore(card1, card2.nextSibling);
        } else {
            container.insertBefore(card1, card2);
        }
    },
    
    /**
     * Save card positions to localStorage
     */
    savePositions(container) {
        const cards = container.querySelectorAll('.col-3, .col-md-3');
        const positions = [];
        
        cards.forEach((card, index) => {
            const cardId = this.getCardId(card);
            positions.push({
                id: cardId,
                position: index
            });
        });
        
        // Determine which type of cards (user/operator/admin)
        let storageKey = 'flowrack_card_positions_user';
        if (container.classList.contains('operator-only')) {
            storageKey = 'flowrack_card_positions_operator';
        } else if (container.classList.contains('admin-only')) {
            storageKey = 'flowrack_card_positions_admin';
        }
        
        localStorage.setItem(storageKey, JSON.stringify(positions));
        console.log('Card positions saved:', positions);
    },
    
    /**
     * Load saved card positions from localStorage
     */
    loadSavedPositions() {
        setTimeout(() => {
            const userRole = App.currentUser?.role || 'user';
            let storageKey = `flowrack_card_positions_${userRole}`;
            
            const savedPositions = localStorage.getItem(storageKey);
            
            if (savedPositions) {
                const positions = JSON.parse(savedPositions);
                this.applyPositions(positions, userRole);
                console.log('Card positions loaded:', positions);
            }
        }, 600);
    },
    
    /**
     * Apply saved positions to cards
     */
    applyPositions(positions, userRole) {
        let container;
        
        if (userRole === 'admin') {
            container = document.querySelector('.admin-only.row');
        } else if (userRole === 'operator') {
            container = document.querySelector('.operator-only.row');
        } else {
            container = document.querySelector('.user-only.row');
        }
        
        if (!container) return;
        
        const cards = Array.from(container.querySelectorAll('.col-3, .col-md-3'));
        
        // Sort cards based on saved positions
        positions.forEach(savedPos => {
            const card = cards.find(c => this.getCardId(c) === savedPos.id);
            if (card) {
                container.appendChild(card);
            }
        });
    },
    
    /**
     * Get a unique ID for a card based on its content
     */
    getCardId(card) {
        const statNumber = card.querySelector('.stat-number');
        if (statNumber) {
            return statNumber.id || statNumber.textContent;
        }
        return card.querySelector('.stat-label')?.textContent || 'unknown';
    },
    
    /**
     * Reset cards to original positions
     */
    resetPositions() {
        const userRole = App.currentUser?.role || 'user';
        const storageKey = `flowrack_card_positions_${userRole}`;
        localStorage.removeItem(storageKey);
        
        // Reload the page to show original positions
        window.location.reload();
    },
    
    /**
     * Enable or disable dragging
     */
    setDraggingEnabled(enabled) {
        const allCards = document.querySelectorAll('.draggable-card');
        allCards.forEach(card => {
            card.setAttribute('draggable', enabled ? 'true' : 'false');
            if (!enabled) {
                card.style.cursor = 'default';
            } else {
                card.style.cursor = 'move';
            }
        });
    }
};

// Initialize when dashboard is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait for App to be ready
    const checkAppReady = setInterval(() => {
        if (window.App && App.currentUser) {
            DragDropCards.init();
            clearInterval(checkAppReady);
        }
    }, 100);
});

// Export for global use
window.DragDropCards = DragDropCards;
