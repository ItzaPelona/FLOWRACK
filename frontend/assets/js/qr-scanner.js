/**
 * QR Code Scanner using HTML5 Camera API
 * Based on jsQR library for QR code detection
 */

class QRScanner {
    constructor(videoElement, canvasElement, onScanCallback) {
        this.video = videoElement;
        this.canvas = canvasElement;
        this.canvasContext = canvasElement.getContext('2d');
        this.onScan = onScanCallback;
        this.scanning = false;
        this.stream = null;
        this.animationFrame = null;
    }

    async start() {
        try {
            // Request camera access
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' } // Prefer back camera on mobile
            });

            this.video.srcObject = this.stream;
            this.video.setAttribute('playsinline', true); // Required for iOS
            await this.video.play();

            this.scanning = true;
            this.tick();

            return true;
        } catch (error) {
            console.error('Camera access error:', error);
            throw new Error('Unable to access camera. Please grant camera permissions.');
        }
    }

    stop() {
        this.scanning = false;

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        if (this.video) {
            this.video.srcObject = null;
        }
    }

    tick() {
        if (!this.scanning) return;

        if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
            // Set canvas size to match video
            this.canvas.height = this.video.videoHeight;
            this.canvas.width = this.video.videoWidth;

            // Draw current video frame to canvas
            this.canvasContext.drawImage(
                this.video,
                0,
                0,
                this.canvas.width,
                this.canvas.height
            );

            // Get image data
            const imageData = this.canvasContext.getImageData(
                0,
                0,
                this.canvas.width,
                this.canvas.height
            );

            // Scan for QR code using jsQR library
            if (typeof jsQR !== 'undefined') {
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: 'dontInvert'
                });

                if (code) {
                    // Draw detection box
                    this.drawBox(code.location);

                    // Trigger callback
                    if (this.onScan) {
                        this.onScan(code.data);
                    }
                }
            } else {
                console.warn('jsQR library not loaded. Using simple detection.');
                // Fallback: Just display video without QR detection
            }
        }

        this.animationFrame = requestAnimationFrame(() => this.tick());
    }

    drawBox(location) {
        const ctx = this.canvasContext;

        // Draw green box around detected QR code
        ctx.beginPath();
        ctx.moveTo(location.topLeftCorner.x, location.topLeftCorner.y);
        ctx.lineTo(location.topRightCorner.x, location.topRightCorner.y);
        ctx.lineTo(location.bottomRightCorner.x, location.bottomRightCorner.y);
        ctx.lineTo(location.bottomLeftCorner.x, location.bottomLeftCorner.y);
        ctx.lineTo(location.topLeftCorner.x, location.topLeftCorner.y);
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#00FF00';
        ctx.stroke();
    }

    isSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }
}

// Export for use in app.js
if (typeof window !== 'undefined') {
    window.QRScanner = QRScanner;
}
