import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import trimIcon from '../assets/trim.png';
import TextOverlayLayer from './TextOverlayLayer';
import TextTimeline from './TextTimeline';
import DrawingCanvas from './DrawingCanvas';

const VideoEditor = forwardRef(({ videoFile, activeTool, onUpload, onClose, onTrim, onDownload }, ref) => {
    const [loaded, setLoaded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [videoUrl, setVideoUrl] = useState(null);
    const [message, setMessage] = useState('Initializing FFmpeg...');
    const [startTime, setStartTime] = useState(0);
    const [endTime, setEndTime] = useState(0);
    const [videoDuration, setVideoDuration] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [thumbnails, setThumbnails] = useState([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);

    // Text Feature State
    const [textLayers, setTextLayers] = useState([]);
    const [selectedTextId, setSelectedTextId] = useState(null);

    const handleAddText = () => {
        const newText = {
            id: Date.now().toString(),
            text: 'Double Click to Edit',
            style: {
                fontSize: 40,
                color: '#ffffff',
                fontFamily: 'Clash Display',
                fontWeight: '600',
                textAlign: 'center',
            },
            transform: {
                x: 100,
                y: 100,
                width: 300,
                height: 'auto',
                rotate: 0,
                scale: [1, 1],
            },
            timing: {
                start: 0,
                end: videoDuration || 5, // Default 5s or video duration
            }
        };
        setTextLayers([...textLayers, newText]);
        setSelectedTextId(newText.id);
    };

    const handleToggleDrawing = () => {
        if (isDrawing) {
            setIsDrawing(false);
        } else {
            setIsDrawing(true);
            if (videoRef.current) videoRef.current.pause();
            setIsPlaying(false);
        }
    };

    const handleSaveDrawing = (dataUrl, x = 0, y = 0) => {
        console.log("HANDLESAVEDRAWING");
        const newId = Date.now();
        const newLayer = {
            id: newId,
            type: 'image',
            src: dataUrl,
            text: 'Drawing', // Label for timeline
            timing: {
                start: currentTime,
                end: Math.min(currentTime + 3, videoDuration)
            },
            transform: {
                x: x,
                y: y,
                scale: [1, 1],
                rotate: 0
            },
            style: {}
        };
        setTextLayers(prev => [...prev, newLayer]);
        // setIsDrawing(false); // Keep drawing mode open
        setSelectedTextId(newId);
    };

    const handleUpdateText = (id, updates) => {
        setTextLayers(layers => layers.map(layer =>
            layer.id === id ? { ...layer, ...updates } : layer
        ));
    };

    const handleRemoveText = (id) => {
        setTextLayers(layers => layers.filter(layer => layer.id !== id));
        if (selectedTextId === id) setSelectedTextId(null);
    };

    const ffmpegRef = useRef(new FFmpeg());
    const videoRef = useRef(null);
    const wrapperRef = useRef(null);
    const timelineRef = useRef(null);
    const fileInputRef = useRef(null);

    useImperativeHandle(ref, () => ({
        transcode
    }));

    useEffect(() => {
        load();
    }, []);

    useEffect(() => {
        if (videoFile) {
            const url = URL.createObjectURL(videoFile);
            setVideoUrl(url);
            setMessage(`Loaded ${videoFile.name} `);
            setStartTime(0);
            setEndTime(0);
            setVideoDuration(0);
            setIsPlaying(false);
            setThumbnails([]);
            // Generate thumbnails will be triggered by duration change
        } else {
            setVideoUrl(null);
            setLoaded(false);
            setThumbnails([]);
            if (videoUrl) {
                URL.revokeObjectURL(videoUrl);
            }
        }
    }, [videoFile]);

    useEffect(() => {
        if (videoFile && videoDuration > 0 && timelineRef.current) {
            generateThumbnails(videoFile);
        }
    }, [videoFile, videoDuration]);

    const load = async () => {
        if (loaded) return;
        setIsLoading(true);
        const baseURL = 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm';
        const ffmpeg = ffmpegRef.current;

        // Polyfill startsWith for WASM worker environment
        if (!String.prototype.startsWith) {
            String.prototype.startsWith = function (search, pos) {
                return this.substr(!pos || pos < 0 ? 0 : +pos, search.length) === search;
            };
        }
        if (!String.prototype.endsWith) {
            String.prototype.endsWith = function (search, this_len) {
                if (this_len === undefined || this_len > this.length) {
                    this_len = this.length;
                }
                return this.substring(this_len - search.length, this_len) === search;
            };
        }

        try {
            // Set up event listeners before loading
            ffmpeg.on('log', (data) => {
                if (data && data.message) {
                    console.log(data.message);
                }
            });

            await ffmpeg.load({
                coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
                workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
            });
            setLoaded(true);
            setMessage('Ready');
        } catch (error) {
            console.error(error);
            setMessage('Failed to load FFmpeg');
        } finally {
            setIsLoading(false);
        }
    };

    const generateThumbnails = async (file) => {
        if (!timelineRef.current) return;

        const video = document.createElement('video');
        video.src = URL.createObjectURL(file);
        video.crossOrigin = 'anonymous';
        video.muted = true;

        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                resolve();
            };
        });

        const duration = video.duration;
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        const aspectRatio = videoWidth / videoHeight;

        const timelineWidth = timelineRef.current.clientWidth;
        const thumbnailHeight = 50; // Must match CSS height
        const thumbnailWidth = thumbnailHeight * aspectRatio;
        const count = Math.ceil(timelineWidth / thumbnailWidth);

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const thumbs = [];

        canvas.width = thumbnailWidth;
        canvas.height = thumbnailHeight;

        for (let i = 0; i < count; i++) {
            const time = (duration / count) * i;
            video.currentTime = time;

            await new Promise(resolve => {
                video.onseeked = () => {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    thumbs.push(canvas.toDataURL());
                    resolve();
                };
            });
        }

        setThumbnails(thumbs);
        video.remove();
    };

    useEffect(() => {
        const handleResize = () => {
            if (videoFile && videoDuration > 0) {
                generateThumbnails(videoFile);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [videoFile, videoDuration]);

    useEffect(() => {
        let animationFrameId;

        const updateProgress = () => {
            if (videoRef.current) {
                setCurrentTime(videoRef.current.currentTime);

                // Check trim end logic here too for smoother stopping
                if (videoRef.current.currentTime >= endTime) {
                    videoRef.current.pause();
                    setIsPlaying(false);
                    videoRef.current.currentTime = startTime;
                    return; // Stop the loop
                }
            }
            animationFrameId = requestAnimationFrame(updateProgress);
        };

        if (isPlaying) {
            updateProgress();
        } else {
            cancelAnimationFrame(animationFrameId);
        }

        return () => cancelAnimationFrame(animationFrameId);
    }, [isPlaying, activeTool, endTime, startTime]);



    const handleTimeUpdate = (e) => {
        // Only update state from event if NOT playing (e.g. scrubbing/seeking)
        // When playing, the RAF loop handles it for smoothness
        if (!isPlaying) {
            setCurrentTime(e.target.currentTime);
        }
    };

    // Spacebar shortcut
    useEffect(() => {
        const handleKeyDown = (e) => {
            const isTyping = document.activeElement.tagName === 'INPUT' ||
                document.activeElement.tagName === 'TEXTAREA' ||
                document.activeElement.isContentEditable;

            if (e.code === 'Space' && !isTyping) {
                e.preventDefault();
                togglePlay();
            }

            if (e.code === 'KeyT' && !isTyping) {
                e.preventDefault();
                onTrim();
            }

            if (e.code === 'KeyS' && !isTyping) {
                e.preventDefault();
                onDownload();
            }

            if (e.code === 'KeyA' && !isTyping) {
                e.preventDefault();
                handleAddText();
            }

            if (e.code === 'KeyD' && !isTyping) {
                e.preventDefault();
                handleToggleDrawing();
            }

            if (e.code === 'KeyX' && !isTyping) {
                e.preventDefault();
                onClose();
            }

            if ((e.code === 'Delete' || e.code === 'Backspace') && !isTyping) {
                if (selectedTextId) {
                    e.preventDefault();
                    handleRemoveText(selectedTextId);
                }
            }

            if (e.code === 'KeyU' && !isTyping && !videoUrl) {
                e.preventDefault();
                fileInputRef.current?.click();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPlaying, onTrim, onDownload, onClose, handleAddText]); // Removed isEditing dependency

    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                if (activeTool === 'trim' && videoRef.current.currentTime >= endTime) {
                    videoRef.current.currentTime = startTime;
                }
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleSliderChange = (value) => {
        setStartTime(value[0]);
        setEndTime(value[1]);

        if (videoRef.current) {
            // Seek if start time changed significantly
            if (Math.abs(value[0] - startTime) > 0.1) {
                videoRef.current.currentTime = value[0];
            }
        }
    };

    const handleTimelineClick = (e) => {
        if (activeTool === 'trim' || !timelineRef.current || !videoRef.current) return;

        const rect = timelineRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = x / rect.width;
        const newTime = percentage * videoDuration;

        videoRef.current.currentTime = newTime;
        setCurrentTime(newTime);
    };

    const formatTime = (seconds) => {
        const totalSeconds = Math.round(seconds);
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const renderTextToImage = async (layer) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // We need to render the text at high resolution to avoid blurriness
        // The layer.style.fontSize is in screen pixels (relative to the editor view)
        // We should probably render it at a reasonable scale.

        // Let's use the layer's style properties
        const fontSize = layer.style.fontSize;
        const fontFamily = layer.style.fontFamily;
        const fontWeight = layer.style.fontWeight;
        const color = layer.style.color;

        // Set font to measure
        ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}"`;

        // Measure text
        const textMetrics = ctx.measureText(layer.text);
        const textWidth = textMetrics.width;
        const textHeight = fontSize * 1.2; // Approximate height

        // Add some padding
        const padding = 4; // Match editor padding
        canvas.width = textWidth + padding * 2;
        canvas.height = textHeight + padding * 2;

        // Clear and set styles again (resizing clears canvas)
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}"`;
        ctx.fillStyle = color;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';

        // Draw text
        ctx.fillText(layer.text, canvas.width / 2, canvas.height / 2);

        // Return as blob (better for large images) or data URL
        // FFmpeg fetchFile handles data URLs well
        return canvas.toDataURL('image/png');
    };

    const transcode = async () => {
        console.log("TRANSCODE");
        if (!videoFile || !loaded) return;

        const ffmpeg = ffmpegRef.current;
        setMessage('Trimming...');

        const ext = getFileExtension(videoFile.name);
        const inputName = `input${ext}`;
        const outputName = `output.mp4`; // Always output MP4 for compatibility when re-encoding

        await ffmpeg.writeFile(inputName, await fetchFile(videoFile));

        // Load font and setup fontconfig for WASM
        const fontUrl = '/fonts/ClashDisplay-Semibold.ttf';
        let fontLoaded = false;
        try {
            const fontData = await fetchFile(fontUrl);
            // Verify it's not an HTML file (common 404 error)
            const view = new Uint8Array(fontData.buffer || fontData);
            if (view.length > 4) {
                // Check for HTML/XML start (<) or newlines (0x0A)
                if (view[0] === 0x3C || view[0] === 0x0A) {
                    throw new Error('File appears to be HTML/Text, not a font');
                }
            }

            console.log(`Font loaded. Size: ${fontData.byteLength} bytes`);

            // Create font directory structure that fontconfig expects
            try {
                await ffmpeg.createDir('/usr');
                await ffmpeg.createDir('/usr/share');
                await ffmpeg.createDir('/usr/share/fonts');
                await ffmpeg.createDir('/usr/share/fonts/truetype');
            } catch (e) {
                // Directories might already exist, ignore errors
            }

            // Write font to standard location
            await ffmpeg.writeFile('/usr/share/fonts/truetype/ClashDisplay-Semibold.ttf', fontData);

            // Create a minimal fontconfig file
            const fontconfigXml = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>/usr/share/fonts/truetype</dir>
  <cachedir>/tmp</cachedir>
</fontconfig>`;

            try {
                await ffmpeg.createDir('/etc');
                await ffmpeg.createDir('/etc/fonts');
            } catch (e) {
                // Ignore
            }

            await ffmpeg.writeFile('/etc/fonts/fonts.conf', new TextEncoder().encode(fontconfigXml));

            fontLoaded = true;
            console.log('Font and fontconfig setup complete');
        } catch (e) {
            console.error('Failed to load local font, trying fallback:', e);
            try {
                // Fallback to a reliable remote font (Roboto)
                const fallbackUrl = 'https://raw.githubusercontent.com/google/fonts/main/ofl/roboto/Roboto-Regular.ttf';
                const fallbackData = await fetchFile(fallbackUrl);
                console.log(`Fallback font loaded. Size: ${fallbackData.byteLength} bytes`);

                try {
                    await ffmpeg.createDir('/usr');
                    await ffmpeg.createDir('/usr/share');
                    await ffmpeg.createDir('/usr/share/fonts');
                    await ffmpeg.createDir('/usr/share/fonts/truetype');
                } catch (e) {
                    // Ignore
                }

                await ffmpeg.writeFile('/usr/share/fonts/truetype/Roboto-Regular.ttf', fallbackData);
                fontLoaded = true;
                console.log('Loaded fallback font successfully');
            } catch (fallbackError) {
                console.error('Failed to load fallback font:', fallbackError);
            }
        }

        const duration = endTime - startTime;

        // Calculate scale factors
        const video = videoRef.current;
        // Use videoDimensions to get the actual displayed size of the video content
        // Fallback to clientWidth if videoDimensions are not yet set (prevent Infinity)
        const displayWidth = videoDimensions.width || video.clientWidth || video.videoWidth;
        const displayHeight = videoDimensions.height || video.clientHeight || video.videoHeight;

        const scaleX = video.videoWidth / displayWidth;
        const scaleY = video.videoHeight / displayHeight;

        console.log('Export Dimensions:', {
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            displayWidth,
            displayHeight,
            scaleX,
            scaleY
        });

        // Build filter complex
        let filterComplex = [];
        let currentStream = '[0:v]';
        let inputIndex = 1; // 0 is video, 1+ are images

        // Sort layers by ID (creation time) or add a z-index if needed. 
        // Assuming textLayers order is z-order.


        // We need to construct the args and filter_complex together.
        const inputs = [];

        for (let i = 0; i < textLayers.length; i++) {
            const layer = textLayers[i];
            const start = Math.max(0, layer.timing.start - startTime);
            const end = Math.min(duration, layer.timing.end - startTime);
            if (end <= 0 || start >= duration) continue;

            if (layer.type === 'image') {
                const imgFileName = `layer_${layer.id}.png`;
                // File already written above? No, let's do it here.
                await ffmpeg.writeFile(imgFileName, await fetchFile(layer.src));
                // Remove -loop 1 from input, we'll loop in the filter graph
                inputs.push('-i', imgFileName);

                const layerIndex = inputIndex++;
                const nextStream = `[v${layerIndex}]`;

                // Scale image to match video resolution
                // The drawing was made on clientWidth/clientHeight.
                // We need to scale it by scaleX/scaleY.
                // Also handle layer transform (x, y, scale).
                // Overlay filter handles x and y.
                // Scale filter handles size.

                // Complex scaling:
                // 1. Scale the input image itself based on layer.transform.scale AND video/client ratio.
                const scaleFactorX = layer.transform.scale[0] * scaleX;
                const scaleFactorY = layer.transform.scale[1] * scaleY;

                // Ensure dimensions are even integers and at least 2x2
                // FFmpeg requires even dimensions for many codecs (like 4:2:0 H.264)
                const targetWidth = `trunc(iw*${scaleFactorX}/2)*2`;
                const targetHeight = `trunc(ih*${scaleFactorY}/2)*2`;

                const scaledImg = `[img${layerIndex}]`;
                // Use finite loop count instead of infinite loop to avoid FFmpeg WASM freeze
                // Calculate frames needed: duration * fps (using 30fps as reasonable default)
                // Add a small buffer to ensure we have enough frames
                const fps = 30;
                const loopCount = Math.ceil(duration * fps) + 10;
                filterComplex.push(`[${layerIndex}:v]loop=loop=${loopCount}:size=1:start=0,fps=${fps},scale=${targetWidth}:${targetHeight}:flags=bicubic,format=rgba,setsar=1,setpts=PTS-STARTPTS${scaledImg}`);

                const x = Math.round(layer.transform.x * scaleX);
                const y = Math.round(layer.transform.y * scaleY);

                console.log(`Layer ${i} (Image): start=${start}, end=${end}, x=${x}, y=${y}, scaleX=${scaleFactorX}, scaleY=${scaleFactorY}`);

                // Note: removed enable parameter as it causes WASM crashes
                // Use shortest=1 to end overlay when main video stream ends
                filterComplex.push(`${currentStream}${scaledImg}overlay=x=${x}:y=${y}:shortest=1${nextStream}`);
                currentStream = nextStream;


            } else {
                // Text Layer - Render to image first to avoid FFmpeg WASM drawtext crashes
                const textImgData = await renderTextToImage(layer);
                const imgFileName = `text_layer_${layer.id}.png`;

                await ffmpeg.writeFile(imgFileName, await fetchFile(textImgData));
                inputs.push('-i', imgFileName);

                const layerIndex = inputIndex++;
                const nextStream = `[v${layerIndex}]`;

                // Scale logic for text-as-image
                // The canvas created in renderTextToImage should be sized to the text content
                // We need to place it correctly.
                // Note: renderTextToImage returns a data URL or blob. 
                // We assume the canvas was created with the exact dimensions of the text or a bounding box.

                // For simplicity, let's assume renderTextToImage returns an image that needs to be scaled 
                // similarly to how we scale the video/display ratio.

                // However, since we draw the text at a specific pixel size on the canvas, 
                // we might need to adjust the scale.
                // Let's look at renderTextToImage implementation (below).

                // If renderTextToImage creates a canvas matching the visual size of the text on screen,
                // then we just need to scale it by (scaleX, scaleY).

                const scaleFactorX = layer.transform.scale[0] * scaleX;
                const scaleFactorY = layer.transform.scale[1] * scaleY;

                // Ensure dimensions are even
                const targetWidth = `trunc(iw*${scaleFactorX}/2)*2`;
                const targetHeight = `trunc(ih*${scaleFactorY}/2)*2`;

                const scaledImg = `[txt${layerIndex}]`;

                // Use finite loop count instead of infinite loop to avoid FFmpeg WASM freeze
                // Calculate frames needed: duration * fps (using 30fps as reasonable default)
                const fps = 30;
                const loopCount = Math.ceil(duration * fps) + 10;
                filterComplex.push(`[${layerIndex}:v]loop=loop=${loopCount}:size=1:start=0,fps=${fps},scale=${targetWidth}:${targetHeight}:flags=bicubic,format=rgba,setsar=1,setpts=PTS-STARTPTS${scaledImg}`);

                const x = Math.round(layer.transform.x * scaleX);
                const y = Math.round(layer.transform.y * scaleY);

                console.log(`Layer ${i} (Text->Image): start=${start}, end=${end}, x=${x}, y=${y}`);

                // Use overlay filter instead of drawtext
                // Use shortest=1 to end overlay when main video stream ends
                filterComplex.push(`${currentStream}${scaledImg}overlay=x=${x}:y=${y}:shortest=1${nextStream}`);
                currentStream = nextStream;
            }
        }

        const args = [
            '-threads', '1', // Single thread for WASM stability
            '-ss', startTime.toString(),
            '-i', inputName,
            ...inputs,
            '-t', duration.toString()
        ];

        if (filterComplex.length > 0) {
            const complexFilterStr = filterComplex.join(';');
            console.log('Generated Filter Complex:', complexFilterStr);
            // Map the final stream to output
            args.push('-filter_complex', complexFilterStr);
            args.push('-map', currentStream);
            args.push('-map', '0:a'); // Map audio from original video (0)

            args.push('-c:v', 'libx264'); // Explicit encoder
            args.push('-c:a', 'copy');
            args.push('-preset', 'veryfast'); // More stable than ultrafast in WASM
        } else {
            args.push('-c', 'copy');
        }

        args.push(outputName);

        console.log('FFmpeg args:', args);

        setIsExporting(true);
        setExportProgress(0);

        ffmpeg.on('progress', (data) => {
            if (data && typeof data.progress === 'number') {
                setExportProgress(Math.round(data.progress * 100));
            }
        });

        // Cleanup stale output file
        try {
            await ffmpeg.deleteFile(outputName);
        } catch (e) {
            // Ignore if file doesn't exist
        }

        try {
            await ffmpeg.exec(args);
        } catch (error) {
            console.warn('FFmpeg exec error (might be benign abort):', error);
        }

        setIsExporting(false);
        setExportProgress(100);

        try {
            const data = await ffmpeg.readFile(outputName);

            // Create a download link
            const url = URL.createObjectURL(new Blob([data.buffer], { type: videoFile.type }));
            const a = document.createElement('a');
            a.href = url;
            a.download = `trimmed_${videoFile.name}`;
            document.body.appendChild(a);
            a.click();

            // Cleanup
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setMessage('Done!');
        } catch (readError) {
            console.error('Failed to read output file:', readError);
            setMessage('Export failed: Could not read output file.');
            alert('Export failed. Please check the console for details.');
        }
    };

    const getFileExtension = (filename) => {
        const parts = filename.split('.');
        return parts.length > 1 ? '.' + parts.pop() : '';
    }

    const playbackPosition = videoDuration > 0 ? (currentTime / videoDuration) * 100 : 0;

    const handleBackgroundClick = (e) => {
        // If clicking the video background (and not a child that stopped propagation), deselect text
        if (selectedTextId) {
            setSelectedTextId(null);
        }
    };

    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            onUpload({ target: { files: files } });
        }
    };

    const [isCopied, setIsCopied] = useState(false);

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'cuddles',
                    text: 'Check out cuddles - a lightweight browser video editor!',
                    url: window.location.origin,
                });
            } catch (err) {
                console.log('Error sharing:', err);
            }
        } else {
            try {
                await navigator.clipboard.writeText(window.location.origin);
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2000);
            } catch (err) {
                console.error('Failed to copy:', err);
            }
        }
    };

    // Video Dimensions for Constraining Overlays
    const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0, top: 0, left: 0 });

    const updateVideoDimensions = () => {
        const video = videoRef.current;
        if (!video || !wrapperRef.current) return;

        const videoRatio = video.videoWidth / video.videoHeight;
        const containerRect = wrapperRef.current.getBoundingClientRect();
        const containerRatio = containerRect.width / containerRect.height;

        let width, height, top, left;

        if (videoRatio > containerRatio) {
            // Video is wider than container (fits width)
            width = containerRect.width;
            height = width / videoRatio;
            top = (containerRect.height - height) / 2;
            left = 0;
        } else {
            // Video is taller than container (fits height)
            height = containerRect.height;
            width = height * videoRatio;
            top = 0;
            left = (containerRect.width - width) / 2;
        }

        setVideoDimensions({ width, height, top, left });
    };

    useEffect(() => {
        window.addEventListener('resize', updateVideoDimensions);
        return () => window.removeEventListener('resize', updateVideoDimensions);
    }, []);

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            setVideoDuration(videoRef.current.duration);
            setStartTime(0);
            setEndTime(videoRef.current.duration);
            setLoaded(true);
            updateVideoDimensions(); // Call after metadata is loaded
        }
    };

    return (
        <div className="video-editor">
            <div className="main-content">
                {videoUrl ? (
                    <div className="video-workspace">
                        {/* Top Left Trim Button */}
                        <div className="tool-wrapper top-left">
                            <button
                                className={`editor-tool-btn ${activeTool === 'trim' ? 'active' : ''}`}
                                onClick={onTrim}
                                title="Trim Video"
                            >
                                <div style={{
                                    width: '16px',
                                    height: '16px',
                                    backgroundColor: 'currentColor',
                                    maskImage: `url(${trimIcon})`,
                                    WebkitMaskImage: `url(${trimIcon})`,
                                    maskSize: 'contain',
                                    WebkitMaskSize: 'contain',
                                    maskRepeat: 'no-repeat',
                                    WebkitMaskRepeat: 'no-repeat',
                                    maskPosition: 'center',
                                    WebkitMaskPosition: 'center'
                                }} />
                            </button>
                            <div className="hotkey-badge">T</div>
                        </div>

                        {/* Top Left Text Button (Below Trim) */}
                        <div className="tool-wrapper top-left-2">
                            <button
                                className="editor-tool-btn"
                                onClick={handleAddText}
                                title="Add Text"
                            >
                                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M4 7V4h16v3" />
                                    <path d="M9 20h6" />
                                    <path d="M12 4v16" />
                                </svg>
                            </button>
                            <div className="hotkey-badge">A</div>
                        </div>

                        {/* Top Left Draw Button (Below Text) */}
                        <div className="tool-wrapper top-left-3">
                            <button
                                className={`editor-tool-btn ${isDrawing ? 'active' : ''}`}
                                onClick={handleToggleDrawing}
                                title="Draw"
                            >
                                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 19l7-7 3 3-7 7-3-3z" />
                                    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                                    <path d="M2 2l7.586 7.586" />
                                    <circle cx="11" cy="11" r="2" />
                                </svg>
                            </button>
                            <div className="hotkey-badge">D</div>
                        </div>

                        {/* Top Left Save Button (Below Draw) */}
                        <div className="tool-wrapper top-left-4">
                            <button
                                className="editor-tool-btn"
                                onClick={onDownload}
                                title="Save Video"
                            >
                                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                    <polyline points="17 21 17 13 7 13 7 21" />
                                    <polyline points="7 3 7 8 15 8" />
                                </svg>
                            </button>
                            <div className="hotkey-badge">S</div>
                        </div>


                        {/* Download Notification */}
                        {isExporting && (
                            <div className="download-notification">
                                <span>Downloading! :)</span>
                                <div className="progress-bar-container">
                                    <div
                                        className="progress-bar-fill"
                                        style={{ width: `${exportProgress}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Top Right Close Button */}
                        <div className="tool-wrapper top-right">
                            <button className="close-video-btn" onClick={onClose} title="Close Video">
                                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                            <div className="hotkey-badge">X</div>
                        </div>



                        <div className="video-wrapper" ref={wrapperRef} onClick={handleBackgroundClick}>
                            <video
                                ref={videoRef}
                                src={videoUrl}
                                onLoadedMetadata={(e) => {
                                    handleLoadedMetadata(e);
                                    updateVideoDimensions();
                                }}
                                onTimeUpdate={handleTimeUpdate}
                                onEnded={() => setIsPlaying(false)}
                            />

                            {/* Constrained Overlays Container */}
                            <div style={{
                                position: 'absolute',
                                top: videoDimensions.top,
                                left: videoDimensions.left,
                                width: videoDimensions.width,
                                height: videoDimensions.height,
                                pointerEvents: 'none' // Allow clicks to pass through to video for play/pause if not hitting a child
                            }}>
                                {/* Text Overlay Layer */}
                                <div style={{ width: '100%', height: '100%', pointerEvents: 'auto' }}>
                                    <TextOverlayLayer
                                        textLayers={textLayers}
                                        selectedId={selectedTextId}
                                        onUpdate={handleUpdateText}
                                        onSelect={setSelectedTextId}
                                        currentTime={currentTime}
                                        containerRef={wrapperRef} // Keep wrapperRef for now, or change to this container? TextOverlayLayer uses it for bounds. 
                                    // Actually, TextOverlayLayer uses containerRef to calculate relative positions. 
                                    // If we change the container, we might need to update TextOverlayLayer logic or just ensure it works relative to this new container.
                                    // Since this container is exactly the video size, relative positions (percentages) should work fine if TextOverlayLayer uses them.
                                    // But TextOverlayLayer likely uses pixels. Let's check.
                                    />
                                </div>

                                {isDrawing && (
                                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'auto' }}>
                                        <DrawingCanvas
                                            width={videoDimensions.width}
                                            height={videoDimensions.height}
                                            onSave={handleSaveDrawing}
                                            onCancel={() => setIsDrawing(false)}
                                        />
                                    </div>
                                )}
                            </div>

                            {!isPlaying && !isDrawing && (
                                <div className="play-overlay" onClick={togglePlay} style={{ cursor: 'pointer' }}>
                                    <svg viewBox="0 0 24 24" width="64" height="64" fill="white">
                                        <path d="M8 5v14l11-7z" />
                                    </svg>
                                </div>
                            )}
                        </div>

                        <div className="timeline-area">
                            <div className="time-markers" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem', height: '60px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                    <button
                                        className="editor-tool-btn"
                                        onClick={togglePlay}
                                        title={isPlaying ? "Pause" : "Play"}
                                        style={{
                                            position: 'relative',
                                            transform: 'none',
                                            width: '40px',
                                            height: '40px',
                                            padding: '8px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        {isPlaying ? (
                                            <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="2">
                                                <rect x="6" y="4" width="4" height="16" />
                                                <rect x="14" y="4" width="4" height="16" />
                                            </svg>
                                        ) : (
                                            <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="2">
                                                <polygon points="5 3 19 12 5 21 5 3" />
                                            </svg>
                                        )}
                                    </button>
                                    <div className="hotkey-badge" style={{ fontSize: '10px', height: '16px', padding: '0 4px', minWidth: 'auto' }}>Space</div>
                                </div>
                                <div style={{ position: 'absolute', right: 0, display: 'flex', gap: '1rem' }}>
                                    <span>{formatTime(currentTime)}</span>
                                    <span>{formatTime(videoDuration)}</span>
                                </div>
                            </div>

                            {videoDuration > 0 && (
                                <div
                                    className="timeline-track-container"
                                    ref={timelineRef}
                                    onClick={handleTimelineClick}
                                >
                                    {/* Thumbnails Layer */}
                                    <div className="thumbnails-strip">
                                        {thumbnails.map((thumb, idx) => (
                                            <img key={idx} src={thumb} alt={`frame-${idx}`} />
                                        ))}
                                    </div>

                                    {/* Playback Head */}
                                    <div
                                        className="playback-head"
                                        style={{ left: `${playbackPosition}%` }}
                                    />

                                    {/* Slider Layer - Always visible, disabled when not trimming */}
                                    <div className={`slider-wrapper ${activeTool !== 'trim' ? 'disabled' : ''}`}>
                                        <Slider
                                            range
                                            min={0}
                                            max={videoDuration}
                                            step={0.1}
                                            value={[startTime, endTime]}
                                            onChange={handleSliderChange}
                                            allowCross={false}
                                            disabled={activeTool !== 'trim'}
                                        />
                                    </div>

                                    {/* Text Timeline */}
                                </div>
                            )}

                            {/* Text Timeline - Moved outside to prevent overlap */}
                            {videoDuration > 0 && (
                                <TextTimeline
                                    textLayers={textLayers}
                                    videoDuration={videoDuration}
                                    onUpdate={handleUpdateText}
                                    selectedId={selectedTextId}
                                    onSelect={setSelectedTextId}
                                />
                            )}
                        </div>
                    </div>
                ) : (
                    <div
                        className="empty-state-container"
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <label
                            className="central-upload-btn"
                            style={{
                                borderColor: isDragging ? 'var(--accent)' : '#333',
                                backgroundColor: isDragging ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                                transform: isDragging ? 'scale(1.02)' : 'scale(1)'
                            }}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={onUpload}
                                accept="video/mp4,audio/wav,video/x-m4v,video/*"
                                style={{ display: 'none' }}
                            />
                            <div className="upload-icon-large">
                                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="17 8 12 3 7 8" />
                                    <line x1="12" y1="3" x2="12" y2="15" />
                                </svg>
                            </div>
                            <span className="upload-text">Upload Video</span>
                            <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.6 }}>
                                <div style={{
                                    width: '24px',
                                    height: '24px',
                                    background: '#222',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '12px',
                                    border: '1px solid #333',
                                    color: '#888'
                                }}>U</div>
                            </div>
                        </label>

                        {/* Logo Bottom Left */}
                        <div style={{ position: 'absolute', bottom: '2rem', left: '2rem', opacity: 0.5 }}>
                            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="9" y1="9" x2="9" y2="14" />
                                <line x1="15" y1="9" x2="15" y2="14" />
                                <path d="M8 17l2 2 2-2 2 2 2-2" />
                            </svg>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

export default VideoEditor;
