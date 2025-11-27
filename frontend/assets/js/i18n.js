/**
 * FlowRack Internationalization (i18n) System
 * Support for multiple languages with dynamic content translation
 */

class I18n {
    constructor() {
        this.currentLanguage = this.getStoredLanguage() || this.detectLanguage();
        this.translations = {};
        this.defaultLanguage = 'en';
        this.supportedLanguages = ['en', 'es'];
        this.initialized = false;
        // Set window.I18n immediately so other scripts can access methods
        window.I18n = this;
        this.init();
    }

    /**
     * Initialize i18n system
     */
    async init() {
        await this.loadTranslations(this.currentLanguage);
        this.applyLanguage(this.currentLanguage);
        this.setupEventListeners();
        this.initialized = true;
        console.log('🌐 I18n initialized with language:', this.currentLanguage);
        return this;
    }

    /**
     * Get stored language from localStorage
     */
    getStoredLanguage() {
        return localStorage.getItem('flowrack_language');
    }

    /**
     * Detect browser language
     */
    detectLanguage() {
        const browserLang = navigator.language || navigator.userLanguage;
        const lang = browserLang.split('-')[0]; // Get 'en' from 'en-US'
        
        return this.supportedLanguages.includes(lang) ? lang : this.defaultLanguage;
    }

    /**
     * Load translation file
     */
    async loadTranslations(lang) {
        try {
            const response = await fetch(`/assets/i18n/${lang}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load ${lang} translations`);
            }
            this.translations[lang] = await response.json();
            console.log(`✅ Loaded ${lang} translations`);
        } catch (error) {
            console.error(`Error loading ${lang} translations:`, error);
            // Fallback to default language
            if (lang !== this.defaultLanguage) {
                await this.loadTranslations(this.defaultLanguage);
            }
        }
    }

    /**
     * Get translation for a key
     */
    t(key, params = {}) {
        const keys = key.split('.');
        let translation = this.translations[this.currentLanguage];
        
        // Navigate through nested keys
        for (const k of keys) {
            if (translation && typeof translation === 'object') {
                translation = translation[k];
            } else {
                break;
            }
        }
        
        // Fallback to English if not found
        if (!translation && this.currentLanguage !== this.defaultLanguage) {
            let fallback = this.translations[this.defaultLanguage];
            for (const k of keys) {
                if (fallback && typeof fallback === 'object') {
                    fallback = fallback[k];
                } else {
                    break;
                }
            }
            translation = fallback;
        }
        
        // Return key if no translation found
        if (!translation) {
            console.warn(`Translation not found: ${key}`);
            return key;
        }
        
        // Replace parameters
        if (typeof translation === 'string' && Object.keys(params).length > 0) {
            Object.keys(params).forEach(param => {
                translation = translation.replace(`{${param}}`, params[param]);
            });
        }
        
        return translation;
    }

    /**
     * Set language
     */
    async setLanguage(lang) {
        if (!this.supportedLanguages.includes(lang)) {
            console.error(`Language not supported: ${lang}`);
            return;
        }
        
        // Load translations if not already loaded
        if (!this.translations[lang]) {
            await this.loadTranslations(lang);
        }
        
        this.currentLanguage = lang;
        localStorage.setItem('flowrack_language', lang);
        
        this.applyLanguage(lang);
        this.showNotification(lang);
        
        // Dispatch event
        window.dispatchEvent(new CustomEvent('languageChanged', {
            detail: { language: lang }
        }));
        
        console.log('🌐 Language changed to:', lang);
    }

    /**
     * Apply language to document
     */
    applyLanguage(lang) {
        document.documentElement.setAttribute('lang', lang);
        
        // Update all elements with data-i18n attribute
        this.updateTranslations();
        
        // Update language selector buttons
        this.updateLanguageButtons();
    }

    /**
     * Update all translations in the DOM
     */
    updateTranslations() {
        // Elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.t(key);
            
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                element.placeholder = translation;
            } else {
                element.textContent = translation;
            }
        });
        
        // Elements with data-i18n-title attribute (for tooltips)
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            element.title = this.t(key);
        });
        
        // Elements with data-i18n-html attribute (for HTML content)
        document.querySelectorAll('[data-i18n-html]').forEach(element => {
            const key = element.getAttribute('data-i18n-html');
            element.innerHTML = this.t(key);
        });
    }

    /**
     * Toggle between languages
     */
    async toggleLanguage() {
        const currentIndex = this.supportedLanguages.indexOf(this.currentLanguage);
        const nextIndex = (currentIndex + 1) % this.supportedLanguages.length;
        const nextLang = this.supportedLanguages[nextIndex];
        
        await this.setLanguage(nextLang);
    }

    /**
     * Get current language
     */
    getLanguage() {
        return this.currentLanguage;
    }

    /**
     * Get language name
     */
    getLanguageName(lang = this.currentLanguage) {
        const names = {
            'en': 'English',
            'es': 'Español'
        };
        return names[lang] || lang;
    }

    /**
     * Get language flag emoji
     */
    getLanguageFlag(lang = this.currentLanguage) {
        const flags = {
            'en': '🇺🇸',
            'es': '🇪🇸'
        };
        return flags[lang] || '🌐';
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Language toggle buttons
        document.addEventListener('click', async (e) => {
            if (e.target.closest('.language-toggle-btn')) {
                e.preventDefault();
                await this.toggleLanguage();
            }
        });
        
        // Language select dropdowns
        document.addEventListener('change', async (e) => {
            if (e.target.classList.contains('language-select')) {
                const lang = e.target.value;
                await this.setLanguage(lang);
            }
        });
    }

    /**
     * Update language toggle buttons
     */
    updateLanguageButtons() {
        const buttons = document.querySelectorAll('.language-toggle-btn');
        buttons.forEach(btn => {
            const flag = btn.querySelector('.language-flag');
            const text = btn.querySelector('.language-text');
            
            if (flag) {
                flag.textContent = this.getLanguageFlag();
            }
            if (text) {
                text.textContent = this.getLanguageName();
            }
        });
        
        // Update select dropdowns
        const selects = document.querySelectorAll('.language-select');
        selects.forEach(select => {
            select.value = this.currentLanguage;
        });
        
        // Update current language display in navbar
        const currentLangDisplay = document.getElementById('current-language');
        if (currentLangDisplay) {
            currentLangDisplay.textContent = this.currentLanguage.toUpperCase();
        }
    }

    /**
     * Create language toggle button HTML
     */
    static createToggleButton() {
        return `
            <button class="language-toggle-btn btn" title="Change language">
                <span class="language-flag">🌐</span>
                <span class="language-text d-none d-md-inline ms-1"></span>
            </button>
        `;
    }

    /**
     * Create language selector dropdown
     */
    static createSelector() {
        return `
            <select class="language-select form-select">
                <option value="en">English</option>
                <option value="es">Español</option>
            </select>
        `;
    }

    /**
     * Show language change notification
     */
    showNotification(lang) {
        const langName = this.getLanguageName(lang);
        const flag = this.getLanguageFlag(lang);
        
        if (typeof showSuccess === 'function') {
            showSuccess(`${flag} ${langName} ${this.t('theme.theme_activated')}`);
        } else {
            console.log(`${flag} Language changed to ${langName}`);
        }
    }

    /**
     * Format date according to current language
     */
    formatDate(date, options = {}) {
        const d = new Date(date);
        const locale = this.currentLanguage === 'es' ? 'es-ES' : 'en-US';
        
        return d.toLocaleDateString(locale, options);
    }

    /**
     * Format time according to current language
     */
    formatTime(date, options = {}) {
        const d = new Date(date);
        const locale = this.currentLanguage === 'es' ? 'es-ES' : 'en-US';
        
        return d.toLocaleTimeString(locale, options);
    }

    /**
     * Format date and time
     */
    formatDateTime(date, options = {}) {
        const d = new Date(date);
        const locale = this.currentLanguage === 'es' ? 'es-ES' : 'en-US';
        
        return d.toLocaleString(locale, options);
    }

    /**
     * Format number according to current language
     */
    formatNumber(number, options = {}) {
        const locale = this.currentLanguage === 'es' ? 'es-ES' : 'en-US';
        return new Intl.NumberFormat(locale, options).format(number);
    }

    /**
     * Format currency
     */
    formatCurrency(amount, currency = 'USD') {
        const locale = this.currentLanguage === 'es' ? 'es-ES' : 'en-US';
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency
        }).format(amount);
    }

    /**
     * Pluralize (basic implementation)
     */
    pluralize(count, singular, plural) {
        if (this.currentLanguage === 'es') {
            return count === 1 ? singular : plural;
        }
        return count === 1 ? singular : plural;
    }

    /**
     * Get all available languages
     */
    getAvailableLanguages() {
        return this.supportedLanguages.map(lang => ({
            code: lang,
            name: this.getLanguageName(lang),
            flag: this.getLanguageFlag(lang)
        }));
    }

    /**
     * Insert language toggle into navbar
     */
    insertToggleButton(selector = '.navbar-nav') {
        const navbar = document.querySelector(selector);
        if (!navbar) {
            console.warn('Navbar not found for language toggle');
            return;
        }

        const li = document.createElement('li');
        li.className = 'nav-item';
        li.innerHTML = `
            <a class="nav-link language-toggle-btn" href="#" title="Change language">
                <span class="language-flag">${this.getLanguageFlag()}</span>
                <span class="language-text d-none d-lg-inline ms-1">${this.getLanguageName()}</span>
            </a>
        `;

        navbar.appendChild(li);
        this.updateLanguageButtons();
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new I18n();
    });
} else {
    new I18n();
}

// Helper function for quick translation (shorthand)
window.t = function(key, params) {
    return window.I18n ? window.I18n.t(key, params) : key;
};
