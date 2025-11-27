/**
 * FlowRack Theme Manager
 * Handles light/dark mode switching with localStorage persistence
 */

class ThemeManager {
    constructor() {
        this.currentTheme = this.getStoredTheme() || this.getPreferredTheme();
        this.init();
    }

    /**
     * Initialize theme manager
     */
    init() {
        this.applyTheme(this.currentTheme);
        this.setupEventListeners();
        this.setupSystemThemeListener();
        window.ThemeManager = this; // Make globally accessible
        console.log('🎨 ThemeManager initialized with theme:', this.currentTheme);
    }

    /**
     * Get stored theme from localStorage
     */
    getStoredTheme() {
        return localStorage.getItem('flowrack_theme');
    }

    /**
     * Get user's preferred theme from system
     */
    getPreferredTheme() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    }

    /**
     * Apply theme to document
     */
    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.currentTheme = theme;
        localStorage.setItem('flowrack_theme', theme);
        
        // Update theme color meta tag
        const themeColorMeta = document.querySelector('meta[name="theme-color"]');
        if (themeColorMeta) {
            themeColorMeta.setAttribute('content', theme === 'dark' ? '#1a1d23' : '#007bff');
        }
        
        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('themeChanged', { 
            detail: { theme } 
        }));
        
        console.log('✅ Theme applied:', theme);
    }

    /**
     * Toggle between light and dark theme
     */
    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(newTheme);
        this.updateToggleButtons();
        
        // Show notification
        this.showThemeNotification(newTheme);
    }

    /**
     * Update all theme toggle buttons in the DOM
     */
    updateToggleButtons() {
        const buttons = document.querySelectorAll('.theme-toggle-btn');
        buttons.forEach(button => {
            const lightIcon = button.querySelector('.theme-icon-light');
            const darkIcon = button.querySelector('.theme-icon-dark');
            
            if (this.currentTheme === 'dark') {
                if (lightIcon) lightIcon.style.display = 'none';
                if (darkIcon) darkIcon.style.display = 'inline-block';
            } else {
                if (lightIcon) lightIcon.style.display = 'inline-block';
                if (darkIcon) darkIcon.style.display = 'none';
            }
        });
    }

    /**
     * Show theme change notification
     */
    showThemeNotification(theme) {
        const themeName = theme === 'dark' ? 'Dark Mode' : 'Light Mode';
        const icon = theme === 'dark' ? '🌙' : '☀️';
        
        // Use existing notification system if available
        if (typeof showSuccess === 'function') {
            showSuccess(`${icon} ${themeName} activated`);
        } else {
            console.log(`${icon} ${themeName} activated`);
        }
    }

    /**
     * Setup event listeners for theme toggle buttons
     */
    setupEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('.theme-toggle-btn')) {
                e.preventDefault();
                this.toggleTheme();
            }
        });
    }

    /**
     * Listen for system theme changes
     */
    setupSystemThemeListener() {
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (!this.getStoredTheme()) {
                    // Only auto-switch if user hasn't manually set a preference
                    const newTheme = e.matches ? 'dark' : 'light';
                    this.applyTheme(newTheme);
                    this.updateToggleButtons();
                    console.log('🔄 System theme changed to:', newTheme);
                }
            });
        }
    }

    /**
     * Get current theme
     */
    getTheme() {
        return this.currentTheme;
    }

    /**
     * Check if dark mode is active
     */
    isDarkMode() {
        return this.currentTheme === 'dark';
    }

    /**
     * Force set a specific theme
     */
    setTheme(theme) {
        if (theme !== 'light' && theme !== 'dark') {
            console.error('Invalid theme:', theme);
            return;
        }
        this.applyTheme(theme);
        this.updateToggleButtons();
    }

    /**
     * Create theme toggle button HTML
     */
    static createToggleButton() {
        return `
            <button class="theme-toggle-btn" title="Toggle theme">
                <i class="bi bi-sun-fill theme-icon-light"></i>
                <i class="bi bi-moon-fill theme-icon-dark"></i>
                <span class="d-none d-md-inline">Theme</span>
            </button>
        `;
    }

    /**
     * Insert theme toggle button into navbar
     */
    insertToggleButton(selector = '.navbar-nav') {
        const navbar = document.querySelector(selector);
        if (!navbar) {
            console.warn('Navbar not found for theme toggle');
            return;
        }

        // Create li element for navbar
        const li = document.createElement('li');
        li.className = 'nav-item';
        li.innerHTML = `
            <a class="nav-link theme-toggle-btn" href="#" title="Toggle Dark/Light Mode">
                <i class="bi bi-sun-fill theme-icon-light"></i>
                <i class="bi bi-moon-fill theme-icon-dark"></i>
                <span class="d-none d-lg-inline ms-1">Theme</span>
            </a>
        `;

        // Insert at the end of navbar
        navbar.appendChild(li);
        
        // Update button state
        this.updateToggleButtons();
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new ThemeManager();
    });
} else {
    new ThemeManager();
}

// Export for use in other modules
window.ThemeManager = ThemeManager;
