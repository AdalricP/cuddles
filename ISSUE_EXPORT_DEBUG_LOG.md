# Export Issues: Text Crash & Image Freeze

## 1. [FIXED] Text Export Crash
**The Issue:**
Exporting videos with text overlays caused FFmpeg WASM to crash with:
```
RuntimeError: null function or function signature mismatch
TypeError: Cannot read properties of undefined (reading 'startsWith')
```
This was caused by the `drawtext` filter in the WASM environment.

**The Fix:**
We implemented a "Text-to-Image" renderer. Instead of using `drawtext`, we now:
1. Render text to a high-res HTML Canvas.
2. Convert it to a PNG blob.
3. Write the PNG to FFmpeg's virtual FS.
4. Use the `overlay` filter to place it on the video.

## 2. [NEW] Export Freeze with Images/Text
**The Issue:**
Now that text is treated as an image (and for existing drawings which are also images), the export process **freezes** indefinitely.
- FFmpeg starts processing.
- No error is thrown.
- Progress stays at 0% or hangs immediately.

**Suspected Cause:**
FFmpeg WASM struggles with "infinite loop" inputs (`-loop 1` or `loop` filter) mixed with a finite video stream. It seems to wait indefinitely for the image stream to end, even when `trim` or `-t` is used.

**What We Tried (That Didn't Work):**
1. **Input Duration:** Added `-t duration` to the image input args.
   ```js
   inputs.push('-loop', '1', '-t', duration, '-i', 'image.png');
   ```
   *Result: Still freezes.*

2. **Filter Trimming:** Moved looping and trimming inside the filter complex.
   ```js
   // Input is just the image (no loop arg)
   filterComplex.push(`[0:v]loop=loop=-1:size=1:start=0,trim=duration=${duration},setpts=PTS-STARTPTS[v0]`);
   ```
   *Result: Still freezes.*

3. **Threading:** Enforced `-threads 1` and `veryfast` preset.
   *Result: No change.*

**Next Steps to Investigate:**
- Try generating a video file from the image *first* (e.g., `ffmpeg -loop 1 -i img.png -t 5 out.mp4`), then concat/overlay that video stream?
- Investigate if `setsar=1` is interacting badly with the loop.
- Check if the audio stream mapping (`-map 0:a`) is waiting for video streams that never "finish" in the graph.
