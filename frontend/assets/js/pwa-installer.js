/**
 * PWA Install Prompt
 * Handles installation prompts and PWA installation workflow
 */

class PWAInstaller {
    constructor() {
        this.deferredPrompt = null;
        this.installed = false;
        this.init();
    }

    init() {
        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches || 
            window.navigator.standalone === true) {
            this.installed = true;
            console.log('PWA is already installed');
            return;
        }

        // Listen for beforeinstallprompt event
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('beforeinstallprompt event fired');
            // Prevent the mini-infobar from appearing on mobile
            e.preventDefault();
            // Store the event for later use
            this.deferredPrompt = e;
            // Show custom install UI
            this.showInstallPrompt();
        });

        // Listen for app installed event
        window.addEventListener('appinstalled', () => {
            console.log('PWA installed successfully');
            this.installed = true;
            this.hideInstallPrompt();
            this.showInstalledMessage();
        });

        // Check if user has dismissed the prompt before
        const dismissed = localStorage.getItem('pwa_install_dismissed');
        const dismissedTime = localStorage.getItem('pwa_install_dismissed_time');
        
        // Show prompt again after 7 days if previously dismissed
        if (dismissed && dismissedTime) {
            const daysSinceDismissed = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60 * 24);
            if (daysSinceDismissed < 7) {
                console.log('Install prompt was recently dismissed');
                return;
            }
        }
    }

    showInstallPrompt() {
        // Create install banner if it doesn't exist
        if (document.getElementById('pwa-install-banner')) {
            return;
        }

        const banner = document.createElement('div');
        banner.id = 'pwa-install-banner';
        banner.className = 'pwa-install-banner';
        banner.innerHTML = `
            <div class="pwa-install-content">
                <div class="pwa-install-icon">
                    <img src="/assets/icons/icon-72x72.png" alt="FlowRack" width="48" height="48">
                </div>
                <div class="pwa-install-text">
                    <h4>Install FlowRack</h4>
                    <p>Install our app for quick access and offline use</p>
                </div>
                <div class="pwa-install-actions">
                    <button id="pwa-install-btn" class="btn btn-primary btn-sm">
                        <i class="bi bi-download"></i> Install
                    </button>
                    <button id="pwa-dismiss-btn" class="btn btn-secondary btn-sm">
                        <i class="bi bi-x"></i>
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(banner);

        // Add event listeners
        document.getElementById('pwa-install-btn').addEventListener('click', () => {
            this.installApp();
        });

        document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
            this.dismissPrompt();
        });

        // Animate in
        setTimeout(() => {
            banner.classList.add('show');
        }, 100);
    }

    hideInstallPrompt() {
        const banner = document.getElementById('pwa-install-banner');
        if (banner) {
            banner.classList.remove('show');
            setTimeout(() => {
                banner.remove();
            }, 300);
        }
    }

    async installApp() {
        if (!this.deferredPrompt) {
            console.log('No deferred prompt available');
            return;
        }

        // Show the install prompt
        this.deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await this.deferredPrompt.userChoice;
        console.log(`User response to install prompt: ${outcome}`);

        if (outcome === 'accepted') {
            console.log('User accepted the install prompt');
        } else {
            console.log('User dismissed the install prompt');
            this.dismissPrompt();
        }

        // Clear the deferred prompt
        this.deferredPrompt = null;
        this.hideInstallPrompt();
    }

    dismissPrompt() {
        this.hideInstallPrompt();
        localStorage.setItem('pwa_install_dismissed', 'true');
        localStorage.setItem('pwa_install_dismissed_time', Date.now().toString());
    }

    showInstalledMessage() {
        const toast = document.createElement('div');
        toast.className = 'pwa-toast success';
        toast.innerHTML = `
            <i class="bi bi-check-circle"></i>
            <span>FlowRack installed successfully!</span>
        `;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
        }, 100);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Method to trigger install prompt manually
    showManualPrompt() {
        if (this.installed) {
            alert('FlowRack is already installed on this device');
            return;
        }

        if (this.deferredPrompt) {
            this.installApp();
        } else {
            // Show instruction for manual installation
            const instructions = this.getManualInstallInstructions();
            this.showInstallInstructions(instructions);
        }
    }

    getManualInstallInstructions() {
        const userAgent = navigator.userAgent.toLowerCase();
        
        if (/iphone|ipad|ipod/.test(userAgent)) {
            return {
                title: 'Install on iOS',
                steps: [
                    'Tap the Share button <i class="bi bi-box-arrow-up"></i>',
                    'Scroll down and tap "Add to Home Screen"',
                    'Tap "Add" to confirm'
                ]
            };
        } else if (/android/.test(userAgent)) {
            return {
                title: 'Install on Android',
                steps: [
                    'Tap the menu button <i class="bi bi-three-dots-vertical"></i>',
                    'Tap "Add to Home screen" or "Install app"',
                    'Tap "Add" or "Install" to confirm'
                ]
            };
        } else {
            return {
                title: 'Install on Desktop',
                steps: [
                    'Look for the install icon in your browser\'s address bar',
                    'Click it and select "Install"',
                    'The app will open in its own window'
                ]
            };
        }
    }

    showInstallInstructions(instructions) {
        const modal = document.createElement('div');
        modal.className = 'pwa-install-modal';
        modal.innerHTML = `
            <div class="pwa-install-modal-content">
                <div class="pwa-install-modal-header">
                    <h3>${instructions.title}</h3>
                    <button class="pwa-close-btn"><i class="bi bi-x-lg"></i></button>
                </div>
                <div class="pwa-install-modal-body">
                    <ol>
                        ${instructions.steps.map(step => `<li>${step}</li>`).join('')}
                    </ol>
                </div>
                <div class="pwa-install-modal-footer">
                    <button class="btn btn-primary pwa-close-btn">Got it!</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add close event listeners
        modal.querySelectorAll('.pwa-close-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.classList.remove('show');
                setTimeout(() => modal.remove(), 300);
            });
        });

        // Show modal
        setTimeout(() => {
            modal.classList.add('show');
        }, 100);
    }
}

// Initialize PWA installer
const pwaInstaller = new PWAInstaller();

// Export for global access
window.PWAInstaller = pwaInstaller;
