/**
 * Canvas Compositor - Handles rendering video frames with overlays
 * Used by WebCodecs exporter to composite frames before encoding
 */

/**
 * Get active overlays at a given timestamp
 * @param {Array} overlays - Array of overlay objects
 * @param {number} currentTime - Current timestamp in seconds
 * @param {number} startTime - Export start time (to adjust overlay timing)
 * @returns {Array} - Array of active overlays
 */
export const getActiveOverlays = (overlays = [], currentTime, startTime = 0) => {
    return overlays.filter(overlay => {
        const adjustedStart = Math.max(0, overlay.timing.start - startTime);
        const adjustedEnd = overlay.timing.end - startTime;
        return currentTime >= adjustedStart && currentTime <= adjustedEnd;
    });
};

/**
 * Create an OffscreenCanvas for compositing
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @returns {OffscreenCanvas}
 */
export const createCompositorCanvas = (width, height) => {
    if (typeof OffscreenCanvas !== 'undefined') {
        return new OffscreenCanvas(width, height);
    }
    // Fallback for browsers without OffscreenCanvas (shouldn't happen with WebCodecs)
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
};

/**
 * Draw a video frame to the canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {VideoFrame} videoFrame - WebCodecs VideoFrame object
 * @param {number} canvasWidth - Target canvas width
 * @param {number} canvasHeight - Target canvas height
 */
export const drawVideoFrame = (ctx, videoFrame, canvasWidth, canvasHeight) => {
    ctx.drawImage(
        videoFrame,
        0, 0,
        canvasWidth,
        canvasHeight
    );
};

/**
 * Draw a text overlay to the canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} overlay - Text overlay object
 * @param {number} scaleX - Horizontal scale factor
 * @param {number} scaleY - Vertical scale factor
 */
export const drawTextOverlay = (ctx, overlay, scaleX = 1, scaleY = 1) => {
    const { style, transform, text } = overlay;

    ctx.save();

    // Apply transformations
    const x = transform.x * scaleX;
    const y = transform.y * scaleY;
    const scale = transform.scale || [1, 1];
    const rotation = transform.rotate || 0;

    ctx.translate(x, y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scale[0] * scaleX, scale[1] * scaleY);

    // Set font properties
    ctx.font = `${style.fontWeight || '600'} ${style.fontSize || 40}px "${style.fontFamily || 'Arial'}"`;
    ctx.fillStyle = style.color || '#ffffff';
    ctx.textAlign = style.textAlign || 'center';
    ctx.textBaseline = 'middle';

    // Draw text
    ctx.fillText(text, 0, 0);

    ctx.restore();
};

/**
 * Draw an image overlay (drawing) to the canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} overlay - Image overlay object
 * @param {HTMLImageElement} image - Loaded image element
 * @param {number} scaleX - Horizontal scale factor
 * @param {number} scaleY - Vertical scale factor
 */
export const drawImageOverlay = (ctx, overlay, image, scaleX = 1, scaleY = 1) => {
    const { transform } = overlay;

    ctx.save();

    // Apply transformations
    const x = transform.x * scaleX;
    const y = transform.y * scaleY;
    const scale = transform.scale || [1, 1];
    const rotation = transform.rotate || 0;

    ctx.translate(x, y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scale[0] * scaleX, scale[1] * scaleY);

    // Draw image centered at origin
    ctx.drawImage(image, -image.width / 2, -image.height / 2);

    ctx.restore();
};

/**
 * Compose a single frame with video and overlays
 * @param {Object} options - Compositing options
 * @param {VideoFrame} options.videoFrame - Source video frame
 * @param {Array} options.overlays - Array of overlay objects
 * @param {number} options.currentTime - Current timestamp in seconds
 * @param {number} options.startTime - Export start time
 * @param {number} options.scaleX - Horizontal scale factor
 * @param {number} options.scaleY - Vertical scale factor
 * @param {OffscreenCanvas} options.canvas - Reusable canvas (optional)
 * @returns {ImageBitmap} - Composited frame as ImageBitmap
 */
export const composeFrame = async ({
    videoFrame,
    overlays = [],
    currentTime,
    startTime = 0,
    scaleX = 1,
    scaleY = 1,
    canvas = null
}) => {
    const width = videoFrame.displayWidth || videoFrame.codedWidth;
    const height = videoFrame.displayHeight || videoFrame.codedHeight;

    // Create or reuse canvas
    const compositorCanvas = canvas || createCompositorCanvas(width, height);
    const ctx = compositorCanvas.getContext('2d');

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw video frame
    drawVideoFrame(ctx, videoFrame, width, height);

    // Get active overlays for current time
    const activeOverlays = getActiveOverlays(overlays, currentTime, startTime);

    // Draw each active overlay
    for (const overlay of activeOverlays) {
        if (overlay.type === 'image' && overlay._imageElement) {
            // Drawing/image overlay
            drawImageOverlay(ctx, overlay, overlay._imageElement, scaleX, scaleY);
        } else {
            // Text overlay
            drawTextOverlay(ctx, overlay, scaleX, scaleY);
        }
    }

    // Convert to ImageBitmap for encoder
    return compositorCanvas.transferToImageBitmap
        ? compositorCanvas.transferToImageBitmap()
        : createImageBitmap(compositorCanvas);
};

/**
 * Preload images for image overlays
 * @param {Array} overlays - Array of overlay objects
 * @returns {Promise<Array>} - Array of overlays with loaded images
 */
export const preloadOverlayImages = async (overlays = []) => {
    const imagePromises = overlays
        .filter(overlay => overlay.type === 'image' && overlay.src)
        .map(async (overlay) => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    overlay._imageElement = img;
                    resolve(overlay);
                };
                img.onerror = reject;
                img.src = overlay.src;
            });
        });

    await Promise.all(imagePromises);
    return overlays;
};

/**
 * CanvasCompositor class - Manages canvas and overlay rendering
 */
export class CanvasCompositor {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.canvas = createCompositorCanvas(width, height);
        this.ctx = this.canvas.getContext('2d');
        this.overlays = [];
        this.scaleX = 1;
        this.scaleY = 1;
        this.startTime = 0;
    }

    /**
     * Set dimensions
     */
    setDimensions(width, height) {
        if (width !== this.width || height !== this.height) {
            this.width = width;
            this.height = height;
            this.canvas.width = width;
            this.canvas.height = height;
        }
    }

    /**
     * Set overlays
     */
    setOverlays(overlays) {
        this.overlays = overlays;
    }

    /**
     * Set scale factors
     */
    setScale(scaleX, scaleY) {
        this.scaleX = scaleX;
        this.scaleY = scaleY;
    }

    /**
     * Set start time for overlay timing adjustment
     */
    setStartTime(startTime) {
        this.startTime = startTime;
    }

    /**
     * Preload all image overlays
     */
    async preloadImages() {
        return preloadOverlayImages(this.overlays);
    }

    /**
     * Compose frame with video and active overlays
     */
    async compose(videoFrame, currentTime) {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Draw video frame
        drawVideoFrame(this.ctx, videoFrame, this.width, this.height);

        // Get and draw active overlays
        const activeOverlays = getActiveOverlays(this.overlays, currentTime, this.startTime);

        for (const overlay of activeOverlays) {
            if (overlay.type === 'image' && overlay._imageElement) {
                drawImageOverlay(this.ctx, overlay, overlay._imageElement, this.scaleX, this.scaleY);
            } else {
                drawTextOverlay(this.ctx, overlay, this.scaleX, this.scaleY);
            }
        }

        // Return ImageBitmap
        return this.canvas.transferToImageBitmap();
    }

    /**
     * Clean up resources
     */
    destroy() {
        // Canvas will be garbage collected
        this.canvas = null;
        this.ctx = null;
        this.overlays = [];
    }
}
