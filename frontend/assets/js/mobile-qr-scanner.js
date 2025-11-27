/**
 * Mobile QR Scanner Optimization
 * Enhanced QR scanning for mobile devices with better camera handling
 */

class MobileQRScanner {
    constructor() {
        this.video = null;
        this.canvas = null;
        this.canvasContext = null;
        this.stream = null;
        this.scanning = false;
        this.lastScanTime = 0;
        this.scanCooldown = 1000; // 1 second between scans
        this.focusMode = 'continuous';
        this.torchEnabled = false;
    }

    /**
     * Initialize scanner with mobile optimizations
     */
    async init(videoElement, canvasElement) {
        this.video = videoElement;
        this.canvas = canvasElement;
        this.canvasContext = this.canvas.getContext('2d');

        try {
            // Request camera with mobile-optimized constraints
            const constraints = this.getMobileConstraints();
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            this.video.srcObject = this.stream;
            this.video.setAttribute('playsinline', true); // Important for iOS
            
            await this.video.play();
            
            // Apply mobile camera optimizations
            await this.applyMobileOptimizations();
            
            console.log('Mobile QR Scanner initialized');
            return true;
        } catch (error) {
            console.error('Failed to initialize camera:', error);
            throw error;
        }
    }

    /**
     * Get mobile-optimized camera constraints
     */
    getMobileConstraints() {
        return {
            video: {
                facingMode: { ideal: 'environment' }, // Prefer back camera
                width: { ideal: 1920, max: 1920 },
                height: { ideal: 1080, max: 1080 },
                aspectRatio: { ideal: 16/9 },
                frameRate: { ideal: 30, max: 60 },
                focusMode: ['continuous', 'auto'],
                // Advanced constraints for better scanning
                advanced: [
                    { focusMode: 'continuous' },
                    { exposureMode: 'continuous' },
                    { whiteBalanceMode: 'continuous' }
                ]
            },
            audio: false
        };
    }

    /**
     * Apply mobile-specific camera optimizations
     */
    async applyMobileOptimizations() {
        if (!this.stream) return;

        const videoTrack = this.stream.getVideoTracks()[0];
        const capabilities = videoTrack.getCapabilities();
        const settings = videoTrack.getSettings();

        console.log('Camera capabilities:', capabilities);
        console.log('Current settings:', settings);

        try {
            const constraints = {};

            // Enable autofocus if available
            if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
                constraints.focusMode = 'continuous';
            }

            // Set optimal zoom if available
            if (capabilities.zoom) {
                constraints.zoom = capabilities.zoom.min || 1;
            }

            // Enable torch/flash support detection
            if (capabilities.torch) {
                this.torchSupported = true;
            }

            // Apply advanced constraints
            if (Object.keys(constraints).length > 0) {
                await videoTrack.applyConstraints({ advanced: [constraints] });
                console.log('Applied camera optimizations:', constraints);
            }
        } catch (error) {
            console.warn('Could not apply all camera optimizations:', error);
        }
    }

    /**
     * Toggle torch/flashlight
     */
    async toggleTorch() {
        if (!this.stream || !this.torchSupported) {
            console.warn('Torch not supported on this device');
            return false;
        }

        const videoTrack = this.stream.getVideoTracks()[0];
        
        try {
            this.torchEnabled = !this.torchEnabled;
            await videoTrack.applyConstraints({
                advanced: [{ torch: this.torchEnabled }]
            });
            console.log('Torch ' + (this.torchEnabled ? 'enabled' : 'disabled'));
            return this.torchEnabled;
        } catch (error) {
            console.error('Failed to toggle torch:', error);
            return false;
        }
    }

    /**
     * Switch camera (front/back)
     */
    async switchCamera() {
        if (!this.stream) return;

        const videoTrack = this.stream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();
        const currentFacingMode = settings.facingMode;

        // Stop current stream
        this.stop();

        // Switch to opposite camera
        const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
        
        try {
            const constraints = this.getMobileConstraints();
            constraints.video.facingMode = { exact: newFacingMode };
            
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
            await this.video.play();
            
            await this.applyMobileOptimizations();
            
            console.log('Switched to', newFacingMode, 'camera');
            return true;
        } catch (error) {
            console.error('Failed to switch camera:', error);
            // Fallback to default camera
            return this.init(this.video, this.canvas);
        }
    }

    /**
     * Start scanning for QR codes
     */
    startScanning(onCodeDetected) {
        if (this.scanning) return;
        
        this.scanning = true;
        this.scan(onCodeDetected);
    }

    /**
     * Scan for QR codes with mobile optimizations
     */
    scan(onCodeDetected) {
        if (!this.scanning || !this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
            if (this.scanning) {
                requestAnimationFrame(() => this.scan(onCodeDetected));
            }
            return;
        }

        // Set canvas size to match video
        if (this.canvas.width !== this.video.videoWidth || 
            this.canvas.height !== this.video.videoHeight) {
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
        }

        // Draw current frame
        this.canvasContext.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        
        // Get image data for processing
        const imageData = this.canvasContext.getImageData(0, 0, this.canvas.width, this.canvas.height);
        
        // Scan for QR code using jsQR
        if (typeof jsQR !== 'undefined') {
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'dontInvert' // Faster on mobile
            });

            if (code) {
                const now = Date.now();
                
                // Prevent rapid duplicate scans
                if (now - this.lastScanTime > this.scanCooldown) {
                    this.lastScanTime = now;
                    
                    // Draw scan indicator
                    this.drawScanIndicator(code.location);
                    
                    // Trigger haptic feedback if available
                    this.triggerHapticFeedback();
                    
                    // Callback with detected code
                    if (onCodeDetected) {
                        onCodeDetected(code.data);
                    }
                }
            }
        }

        // Continue scanning
        requestAnimationFrame(() => this.scan(onCodeDetected));
    }

    /**
     * Draw visual indicator when QR code is detected
     */
    drawScanIndicator(location) {
        if (!location) return;

        this.canvasContext.beginPath();
        this.canvasContext.moveTo(location.topLeftCorner.x, location.topLeftCorner.y);
        this.canvasContext.lineTo(location.topRightCorner.x, location.topRightCorner.y);
        this.canvasContext.lineTo(location.bottomRightCorner.x, location.bottomRightCorner.y);
        this.canvasContext.lineTo(location.bottomLeftCorner.x, location.bottomLeftCorner.y);
        this.canvasContext.closePath();
        
        this.canvasContext.lineWidth = 4;
        this.canvasContext.strokeStyle = '#00ff00';
        this.canvasContext.stroke();
    }

    /**
     * Trigger haptic feedback on mobile devices
     */
    triggerHapticFeedback() {
        // Vibration API
        if ('vibrate' in navigator) {
            navigator.vibrate(100); // Short vibration
        }

        // Haptic feedback for iOS
        if (window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate([100]);
        }
    }

    /**
     * Stop scanning
     */
    stopScanning() {
        this.scanning = false;
    }

    /**
     * Stop camera stream
     */
    stop() {
        this.stopScanning();
        
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        if (this.video) {
            this.video.srcObject = null;
        }
    }

    /**
     * Get camera info for debugging
     */
    getCameraInfo() {
        if (!this.stream) return null;

        const videoTrack = this.stream.getVideoTracks()[0];
        return {
            label: videoTrack.label,
            settings: videoTrack.getSettings(),
            capabilities: videoTrack.getCapabilities(),
            constraints: videoTrack.getConstraints()
        };
    }

    /**
     * Take a snapshot of current frame
     */
    takeSnapshot() {
        if (!this.video || !this.canvas) return null;

        this.canvasContext.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        return this.canvas.toDataURL('image/png');
    }
}

// Export for global access
window.MobileQRScanner = MobileQRScanner;
