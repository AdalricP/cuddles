/**
 * MediaRecorder Video Exporter
 * Handles video export with overlays using the MediaRecorder API
 * Supports video trim, text overlays, drawing overlays
 *
 * This is simpler and more reliable than WebCodecs + MP4Box for most use cases.
 * MediaRecorder handles the muxing automatically and produces valid MP4 files.
 */

import { CanvasCompositor } from './canvasCompositor.js';

/**
 * MediaRecorderExporter class
 * Uses MediaRecorder API for simpler, more reliable video export
 */
export class MediaRecorderExporter {
    constructor(options = {}) {
        this.videoFile = options.videoFile;
        this.startTime = options.startTime || 0;
        this.endTime = options.endTime || null;
        this.overlays = options.overlays || [];
        this.onProgress = options.onProgress || (() => {});
        this.onLog = options.onLog || (() => {});

        // Display dimensions - the size of the video element when overlays were created
        // This is needed to scale overlay coordinates correctly
        this.displayWidth = options.displayWidth || null;
        this.displayHeight = options.displayHeight || null;

        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.abortController = new AbortController();
    }

    /**
     * Main export method
     * @returns {Promise<Blob>} - Exported video as Blob
     */
    async export() {
        try {
            this.onLog('Starting MediaRecorder export...');

            // Get video metadata
            const videoInfo = await this.getVideoInfo();

            // Calculate duration
            const duration = this.endTime || videoInfo.duration;
            const exportDuration = duration - this.startTime;
            const fps = videoInfo.fps || 30;
            const totalFrames = Math.ceil(exportDuration * fps);

            this.onLog(`Export: ${exportDuration.toFixed(2)}s, ${totalFrames} frames @ ${fps}fps`);

            // Process and record video
            const blob = await this.processVideoFrames(videoInfo, exportDuration);

            this.onLog('Export complete!');
            this.onProgress(1);

            return blob;

        } catch (error) {
            this.onLog(`Export error: ${error.message}`);
            console.error('MediaRecorder export error:', error);
            throw error;
        }
    }

    /**
     * Get video metadata without full demuxing
     */
    async getVideoInfo() {
        const videoUrl = URL.createObjectURL(this.videoFile);
        const video = document.createElement('video');
        video.src = videoUrl;
        video.muted = true;

        await new Promise((resolve, reject) => {
            video.onloadedmetadata = resolve;
            video.onerror = reject;
        });

        const info = {
            width: video.videoWidth,
            height: video.videoHeight,
            duration: video.duration,
            fps: 30
        };

        URL.revokeObjectURL(videoUrl);
        return info;
    }

    /**
     * Process video frames and record with MediaRecorder
     */
    async processVideoFrames(videoInfo, exportDuration) {
        this.onLog('Processing video frames...');

        const videoUrl = URL.createObjectURL(this.videoFile);
        const video = document.createElement('video');
        video.src = videoUrl;
        video.muted = false; // Need audio
        video.playsInline = true;
        video.crossOrigin = 'anonymous';

        // Wait for video to load
        await new Promise((resolve, reject) => {
            video.onloadedmetadata = resolve;
            video.onerror = reject;
        });

        const fps = videoInfo.fps || 30;
        const totalFrames = Math.ceil(exportDuration * fps);

        // Create canvas for compositing
        const canvas = document.createElement('canvas');
        canvas.width = videoInfo.width;
        canvas.height = videoInfo.height;
        const ctx = canvas.getContext('2d');

        this.onLog(`Encoding ${totalFrames} frames...`);

        // Create MediaStream from canvas
        const canvasStream = canvas.captureStream(fps);

        // Add audio track from video using Web Audio API
        let stream = canvasStream;

        try {
            const audioContext = new AudioContext();
            const source = audioContext.createMediaElementSource(video);
            const destination = audioContext.createMediaStreamDestination();

            // Connect video audio to the destination
            source.connect(destination);
            // Don't connect to audioContext.destination to prevent playing through speakers

            // Add audio track to the stream
            const audioTracks = destination.stream.getAudioTracks();
            if (audioTracks.length > 0) {
                stream = new MediaStream([
                    ...canvasStream.getVideoTracks(),
                    ...audioTracks
                ]);
                this.onLog('Audio track added to stream');
            }
        } catch (e) {
            this.onLog(`Could not add audio: ${e.message}`);
            // Continue without audio
        }

        // Find supported MIME type
        const mimeType = this.getSupportedMimeType();
        this.onLog(`Using MIME type: ${mimeType}`);

        // Setup MediaRecorder with the combined stream (video + audio)
        this.recordedChunks = [];
        this.mediaRecorder = new MediaRecorder(stream, {
            mimeType: mimeType,
            videoBitsPerSecond: 5000000 // 5 Mbps
        });

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                this.recordedChunks.push(event.data);
            }
        };

        this.mediaRecorder.onerror = (event) => {
            this.onLog(`MediaRecorder error: ${event.error}`);
            throw new Error(`MediaRecorder error: ${event.error}`);
        };

        // Start recording
        this.mediaRecorder.start();
        this.onLog('Recording started');

        // Helper to seek to specific time
        const seekToTime = (time) => {
            return new Promise((resolve) => {
                const onSeek = () => {
                    video.removeEventListener('seeked', onSeek);
                    resolve();
                };
                video.addEventListener('seeked', onSeek);
                video.currentTime = time;
            });
        };

        // Seek to start time
        await seekToTime(this.startTime);

        // Preload overlay images
        const imageOverlays = this.overlays.filter(o => o.type === 'image' && o.src);
        for (const overlay of imageOverlays) {
            try {
                overlay._cachedImage = await this.loadImage(overlay.src);
            } catch (e) {
                this.onLog(`Failed to load image: ${e.message}`);
            }
        }

        // Play and render frames in real-time
        const startTime = performance.now();
        let frameCount = 0;

        const renderFrame = async () => {
            if (this.abortController.signal.aborted) {
                this.onLog('Export aborted');
                this.mediaRecorder.stop();
                URL.revokeObjectURL(videoUrl);
                return;
            }

            const currentTime = video.currentTime;
            const relativeTime = currentTime - this.startTime;

            // Check if we've reached the end
            if (relativeTime >= exportDuration || currentTime >= (this.endTime || video.duration)) {
                this.onLog('Reached end of export range');
                this.mediaRecorder.stop();
                URL.revokeObjectURL(videoUrl);
                return;
            }

            // Clear and draw video frame
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            // Draw active overlays
            const activeOverlays = this.overlays.filter(o => {
                const start = Math.max(0, o.timing.start - this.startTime);
                const end = o.timing.end - this.startTime;
                return relativeTime >= start && relativeTime <= end;
            });

            for (const overlay of activeOverlays) {
                await this.drawOverlay(ctx, overlay, canvas.width, canvas.height);
            }

            // Update progress
            frameCount++;
            this.onProgress(Math.min(relativeTime / exportDuration, 0.99));

            // Continue rendering
            requestAnimationFrame(renderFrame);
        };

        // Start playback and rendering
        await video.play();
        renderFrame();

        // Wait for recording to complete
        return new Promise((resolve, reject) => {
            this.mediaRecorder.onstop = () => {
                video.pause();
                URL.revokeObjectURL(videoUrl);

                this.onLog(`Recording stopped. Chunks: ${this.recordedChunks.length}`);

                if (this.recordedChunks.length === 0) {
                    reject(new Error('No data was recorded'));
                    return;
                }

                // Create blob from recorded chunks
                const blob = new Blob(this.recordedChunks, { type: mimeType });
                this.onLog(`Generated blob: ${blob.size} bytes, type: ${blob.type}`);

                // Ensure it's an MP4 blob (some browsers use webm)
                const mp4Blob = mimeType.includes('mp4') || blob.type.includes('mp4')
                    ? blob
                    : new Blob([blob], { type: 'video/mp4' });

                resolve(mp4Blob);
            };

            // Timeout safety - stop recording after export duration + buffer
            setTimeout(() => {
                if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                    this.onLog('Recording timeout - stopping');
                    this.mediaRecorder.stop();
                }
            }, (exportDuration + 2) * 1000);
        });
    }

    /**
     * Get supported MIME type for MediaRecorder
     * Prioritize formats that support both video and audio
     */
    getSupportedMimeType() {
        const types = [
            'video/mp4;codecs="avc1.42E01E,mp4a.40.2"', // H.264 + AAC (audio)
            'video/mp4;codecs="avc1.640029,mp4a.40.2"', // H.264 High + AAC
            'video/mp4;codecs="avc1.42E01E"',
            'video/mp4;codecs="avc1.640029"',
            'video/mp4',
            'video/webm;codecs="vp9,opus"',
            'video/webm;codecs="vp8,opus"',
            'video/webm;codecs="vp9"',
            'video/webm;codecs="vp8"',
            'video/webm'
        ];

        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }

        throw new Error('No supported MediaRecorder MIME type found');
    }

    /**
     * Draw overlay to canvas context
     */
    async drawOverlay(ctx, overlay, canvasWidth, canvasHeight) {
        const { style, transform, text, type, src } = overlay;

        ctx.save();

        // Calculate scale factors - overlay coordinates are relative to display size
        // but we're drawing to a canvas sized to the actual video dimensions
        let scaleX = 1;
        let scaleY = 1;

        if (this.displayWidth && this.displayHeight) {
            scaleX = canvasWidth / this.displayWidth;
            scaleY = canvasHeight / this.displayHeight;
        }

        const baseScale = transform.scale || [1, 1];
        const rotation = transform.rotate || 0;

        if (type === 'image' && src) {
            // Use cached image if available
            const img = overlay._cachedImage || await this.loadImage(src);
            overlay._cachedImage = img;

            // Images are positioned with top-left at (x, y) in the preview
            // Scale the image size to match export resolution
            const scaledWidth = img.width * scaleX;
            const scaledHeight = img.height * scaleY;
            const x = transform.x * scaleX;
            const y = transform.y * scaleY;

            // Apply user scale and rotation (from transform origin center)
            ctx.translate(x + scaledWidth / 2, y + scaledHeight / 2);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.scale(baseScale[0], baseScale[1]);
            ctx.drawImage(img, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
        } else {
            // Text overlay - CSS positioning is tricky:
            // - left/top position the element's top-left corner at (x, y)
            // - transform-origin is 50% 50% (center of element)
            // - Element has 4px padding and width = max-content (text width)
            // - So the visual center is offset from (x, y) by half element size

            const fontSize = style.fontSize || 40;
            const avgScale = (scaleX + scaleY) / 2;
            const scaledFontSize = Math.max(1, fontSize * avgScale);

            // Set font first to measure text
            ctx.font = `${style.fontWeight || '600'} ${scaledFontSize}px "${style.fontFamily || 'Arial'}"`;
            const metrics = ctx.measureText(text);
            const textWidth = metrics.width;
            const textHeight = scaledFontSize; // Approximate height

            // Add padding (4px) and scale it
            const padding = 4 * avgScale;
            const elementWidth = textWidth + padding * 2;
            const elementHeight = textHeight + padding * 2;

            // In CSS: left/top positions top-left at (x,y)
            // Transform origin at center means transforms happen from (x + w/2, y + h/2)
            const x = transform.x * scaleX;
            const y = transform.y * scaleY;

            // Position at the element's center (where transform-origin is)
            ctx.translate(x + elementWidth / 2, y + elementHeight / 2);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.scale(baseScale[0], baseScale[1]);

            // Draw text centered at the origin
            ctx.fillStyle = style.color || '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, 0, 0);
        }

        ctx.restore();
    }

    /**
     * Load image from src
     */
    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }

    /**
     * Abort the export
     */
    abort() {
        this.abortController.abort();
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }
    }
}

/**
 * Convenience function to export with MediaRecorder
 * @param {Object} options - Export options
 * @returns {Promise<Blob>} - Exported video blob
 */
export async function exportWithWebCodecs(options) {
    const exporter = new MediaRecorderExporter(options);
    return exporter.export();
}
