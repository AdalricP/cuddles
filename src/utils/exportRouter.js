/**
 * Export Router - Determines the best export method based on browser capabilities
 * and export requirements (overlays, trim, etc.)
 */

/**
 * Check if the browser supports WebCodecs API
 * @returns {boolean}
 */
export const canUseWebCodecs = () => {
    return (
        typeof window !== 'undefined' &&
        'VideoEncoder' in window &&
        'VideoDecoder' in window &&
        'AudioEncoder' in window &&
        'AudioDecoder' in window
    );
};

/**
 * Check if this is a Chromium-based browser (Chrome, Edge, Arc, Opera, etc.)
 * @returns {boolean}
 */
export const isChromium = () => {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent;
    return ua.includes('Chrome') && !ua.includes('Edg'); // Edge is also Chromium but handled separately
};

/**
 * Determine if WebCodecs is needed for this export
 * WebCodecs is required when there are text or drawing overlays
 * @param {Array} textLayers - Text overlay layers
 * @param {Array} drawingLayers - Drawing overlay layers
 * @returns {boolean}
 */
export const needsWebCodecs = (textLayers = [], drawingLayers = []) => {
    return textLayers.length > 0 || drawingLayers.length > 0;
};

/**
 * Get the appropriate export method based on browser capabilities and requirements
 * @param {Object} options - Export options
 * @param {Array} options.textLayers - Text overlay layers
 * @param {Array} options.drawingLayers - Drawing overlay layers (optional, derived from textLayers with type='image')
 * @returns {string} - Export method: 'webcodecs', 'ffmpeg', or 'unsupported'
 */
export const getExportMethod = ({ textLayers = [], drawingLayers = [] } = {}) => {
    const hasOverlays = needsWebCodecs(textLayers, drawingLayers);
    const supportsWebCodecs = canUseWebCodecs();

    // Export with overlays requires WebCodecs
    if (hasOverlays) {
        if (supportsWebCodecs) {
            return 'webcodecs';
        }
        return 'unsupported';
    }

    // No overlays - can use FFmpeg for trim-only exports (works everywhere)
    return 'ffmpeg';
};

/**
 * Get user-friendly message for unsupported browser
 * @returns {string}
 */
export const getUnsupportedMessage = () => {
    if (isChromium()) {
        return 'Please update your browser to use text and drawing overlays.';
    }
    return 'Text and drawing overlays require Chrome, Edge, or Arc. Trim-only export is available.';
};

/**
 * Export method constants
 */
export const EXPORT_METHODS = {
    WEBCODECS: 'webcodecs',
    FFMPEG: 'ffmpeg',
    UNSUPPORTED: 'unsupported'
};
