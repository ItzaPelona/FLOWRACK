/**
 * Touch Gestures Handler
 * Provides swipe and touch gestures for mobile workflow
 */

class TouchGestures {
    constructor() {
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchEndX = 0;
        this.touchEndY = 0;
        this.minSwipeDistance = 50; // minimum distance for swipe
        this.swipeTimeout = 300; // maximum time for swipe in ms
        this.touchStartTime = 0;
        this.init();
    }

    init() {
        console.log('Touch Gestures initialized');
        
        // Add pull-to-refresh functionality
        this.initPullToRefresh();
        
        // Add swipe navigation
        this.initSwipeNavigation();
    }

    /**
     * Initialize pull-to-refresh on mobile
     */
    initPullToRefresh() {
        let pullStartY = 0;
        let pulling = false;
        const pullThreshold = 80;

        const pullRefreshContainer = document.createElement('div');
        pullRefreshContainer.id = 'pull-refresh-indicator';
        pullRefreshContainer.className = 'pull-refresh-indicator';
        pullRefreshContainer.innerHTML = '<i class="bi bi-arrow-clockwise"></i>';
        document.body.insertBefore(pullRefreshContainer, document.body.firstChild);

        document.addEventListener('touchstart', (e) => {
            if (window.scrollY === 0) {
                pullStartY = e.touches[0].clientY;
                pulling = true;
            }
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (!pulling) return;
            
            const pullDistance = e.touches[0].clientY - pullStartY;
            
            if (pullDistance > 0 && pullDistance < pullThreshold * 2) {
                pullRefreshContainer.style.transform = `translateY(${Math.min(pullDistance, pullThreshold)}px)`;
                pullRefreshContainer.style.opacity = Math.min(pullDistance / pullThreshold, 1);
                
                if (pullDistance > pullThreshold) {
                    pullRefreshContainer.classList.add('ready');
                } else {
                    pullRefreshContainer.classList.remove('ready');
                }
            }
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            if (!pulling) return;
            
            const pullDistance = e.changedTouches[0].clientY - pullStartY;
            
            if (pullDistance > pullThreshold) {
                // Trigger refresh
                pullRefreshContainer.classList.add('refreshing');
                this.handleRefresh().then(() => {
                    setTimeout(() => {
                        pullRefreshContainer.classList.remove('refreshing', 'ready');
                        pullRefreshContainer.style.transform = 'translateY(0)';
                        pullRefreshContainer.style.opacity = '0';
                    }, 500);
                });
            } else {
                pullRefreshContainer.classList.remove('ready');
                pullRefreshContainer.style.transform = 'translateY(0)';
                pullRefreshContainer.style.opacity = '0';
            }
            
            pulling = false;
        });
    }

    /**
     * Handle refresh action
     */
    async handleRefresh() {
        console.log('Pull to refresh triggered');
        
        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('pull-to-refresh'));
        
        // Reload current view data
        if (typeof App !== 'undefined' && App.currentView) {
            await new Promise(resolve => setTimeout(resolve, 800));
            window.location.reload();
        }
    }

    /**
     * Initialize swipe navigation and actions
     */
    initSwipeNavigation() {
        document.addEventListener('touchstart', (e) => {
            this.touchStartX = e.changedTouches[0].screenX;
            this.touchStartY = e.changedTouches[0].screenY;
            this.touchStartTime = Date.now();
        }, false);

        document.addEventListener('touchend', (e) => {
            this.touchEndX = e.changedTouches[0].screenX;
            this.touchEndY = e.changedTouches[0].screenY;
            this.handleSwipe();
        }, false);
    }

    /**
     * Handle swipe gesture
     */
    handleSwipe() {
        const swipeTime = Date.now() - this.touchStartTime;
        const deltaX = this.touchEndX - this.touchStartX;
        const deltaY = this.touchEndY - this.touchStartY;
        
        // Check if swipe is fast enough
        if (swipeTime > this.swipeTimeout) return;
        
        // Check if swipe is long enough
        if (Math.abs(deltaX) < this.minSwipeDistance && Math.abs(deltaY) < this.minSwipeDistance) {
            return;
        }
        
        // Determine swipe direction
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            // Horizontal swipe
            if (deltaX > 0) {
                this.handleSwipeRight();
            } else {
                this.handleSwipeLeft();
            }
        } else {
            // Vertical swipe
            if (deltaY > 0) {
                this.handleSwipeDown();
            } else {
                this.handleSwipeUp();
            }
        }
    }

    /**
     * Handle swipe right (go back)
     */
    handleSwipeRight() {
        console.log('Swipe right detected');
        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('swipe-right'));
    }

    /**
     * Handle swipe left (go forward)
     */
    handleSwipeLeft() {
        console.log('Swipe left detected');
        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('swipe-left'));
    }

    /**
     * Handle swipe down
     */
    handleSwipeDown() {
        console.log('Swipe down detected');
        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('swipe-down'));
    }

    /**
     * Handle swipe up
     */
    handleSwipeUp() {
        console.log('Swipe up detected');
        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('swipe-up'));
    }

    /**
     * Add swipe-to-delete functionality to an element
     * @param {HTMLElement} element - Element to add swipe-to-delete
     * @param {Function} onDelete - Callback when delete is confirmed
     */
    addSwipeToDelete(element, onDelete) {
        let startX = 0;
        let currentX = 0;
        let isDragging = false;
        const deleteThreshold = -100; // swipe 100px left to delete

        element.style.transition = 'transform 0.3s ease';

        element.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            isDragging = true;
            element.style.transition = 'none';
        });

        element.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            
            currentX = e.touches[0].clientX;
            const deltaX = currentX - startX;
            
            // Only allow left swipe
            if (deltaX < 0) {
                element.style.transform = `translateX(${deltaX}px)`;
                
                if (deltaX < deleteThreshold) {
                    element.classList.add('delete-ready');
                } else {
                    element.classList.remove('delete-ready');
                }
            }
        });

        element.addEventListener('touchend', () => {
            isDragging = false;
            element.style.transition = 'transform 0.3s ease';
            
            const deltaX = currentX - startX;
            
            if (deltaX < deleteThreshold) {
                // Confirm delete
                element.style.transform = `translateX(-100%)`;
                element.classList.add('deleting');
                
                setTimeout(() => {
                    if (onDelete) onDelete();
                }, 300);
            } else {
                // Reset position
                element.style.transform = 'translateX(0)';
                element.classList.remove('delete-ready');
            }
        });
    }

    /**
     * Add swipe-to-reveal-actions functionality
     * @param {HTMLElement} element - Element to add swipe actions
     * @param {Array} actions - Array of action objects {label, icon, callback, color}
     */
    addSwipeActions(element, actions) {
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'swipe-actions';
        
        actions.forEach(action => {
            const btn = document.createElement('button');
            btn.className = `swipe-action ${action.color || 'primary'}`;
            btn.innerHTML = `<i class="bi bi-${action.icon}"></i> ${action.label}`;
            btn.addEventListener('click', () => {
                if (action.callback) action.callback();
                this.resetSwipe(element);
            });
            actionsContainer.appendChild(btn);
        });
        
        element.parentNode.style.position = 'relative';
        element.parentNode.insertBefore(actionsContainer, element);
        
        let startX = 0;
        let currentX = 0;
        let isDragging = false;
        const revealThreshold = 80;
        
        element.style.transition = 'transform 0.3s ease';
        
        element.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            isDragging = true;
            element.style.transition = 'none';
        });
        
        element.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            
            currentX = e.touches[0].clientX;
            const deltaX = currentX - startX;
            
            // Only allow left swipe
            if (deltaX < 0 && deltaX > -200) {
                element.style.transform = `translateX(${deltaX}px)`;
            }
        });
        
        element.addEventListener('touchend', () => {
            isDragging = false;
            element.style.transition = 'transform 0.3s ease';
            
            const deltaX = currentX - startX;
            
            if (deltaX < -revealThreshold) {
                // Reveal actions
                element.style.transform = `translateX(-${actionsContainer.offsetWidth}px)`;
                actionsContainer.classList.add('revealed');
            } else {
                // Reset position
                this.resetSwipe(element);
            }
        });
    }

    /**
     * Reset swipe position
     * @param {HTMLElement} element - Element to reset
     */
    resetSwipe(element) {
        element.style.transform = 'translateX(0)';
        const actionsContainer = element.previousElementSibling;
        if (actionsContainer && actionsContainer.classList.contains('swipe-actions')) {
            actionsContainer.classList.remove('revealed');
        }
    }
}

// Initialize touch gestures
const touchGestures = new TouchGestures();

// Export for global access
window.TouchGestures = touchGestures;
