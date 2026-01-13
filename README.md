# Cuddles

A browser-based video editor built with React and Vite. Trim videos, add text overlays, draw on your videos, and export them — all in your browser.

## Features

- **Video Trimming** - Select start and end points to trim your video
- **Text Overlays** - Add customizable text with fonts, colors, and positioning
- **Drawing Tool** - Draw directly on your videos with a pen tool
- **Real-time Preview** - See your changes instantly as you edit
- **Export with Overlays** - Export your edited video with all overlays preserved
- **Audio Preservation** - Original audio is maintained in exports

## Tech Stack

- **React 19** - UI framework
- **Vite** - Build tool and dev server
- **FFmpeg WASM** - Video processing for trim-only exports
- **WebCodecs API** - Fast overlay-based exports
- **MediaRecorder API** - Reliable video recording
- **MP4Box.js** - MP4 muxing
- **react-moveable** - Drag, scale, and rotate overlays

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run linter
npm run lint
```

## Controls

| Key | Action |
|-----|--------|
| `U` | Upload video |
| `Space` | Play/Pause |
| `T` | Toggle trim mode |
| `A` | Add text overlay |
| `D` | Toggle drawing mode |
| `X` | Close editor |
| `S` | Export/download video |

## How It Works

### Export Routing

The editor automatically chooses the best export method based on your browser and what features you're using:

| Scenario | Method |
|----------|--------|
| Trim only (no overlays) | FFmpeg WASM |
| Text/Drawing overlays | WebCodecs + MediaRecorder (Chrome/Edge/Arc) |
| Unsupported browser | Shows warning |

### Overlay System

Overlays are stored with timing information, so you can have text and drawings appear and disappear at specific points in your video. Each overlay supports:

- Position (x, y)
- Scale
- Rotation
- Start/end time

## Project Structure

```
src/
├── components/
│   ├── VideoEditor.jsx    # Main editor component
│   ├── TextOverlayLayer.jsx # Text overlay rendering
│   ├── TextTimeline.jsx   # Overlay timeline
│   └── DrawingCanvas.jsx  # Drawing tool
├── utils/
│   ├── exportRouter.js    # Export method selection
│   ├── webcodecsExporter.js # WebCodecs export implementation
│   └── canvasCompositor.js # Frame composition utilities
└── App.jsx                # Root component
```

## Browser Support

| Browser | Trim | Text | Draw | Export |
|---------|------|------|------|--------|
| Chrome | ✅ | ✅ | ✅ | ✅ |
| Edge | ✅ | ✅ | ✅ | ✅ |
| Arc | ✅ | ✅ | ✅ | ✅ |
| Firefox | ✅ | ✅ | ✅ | ⚠️ Trim only |
| Safari | ✅ | ✅ | ✅ | ⚠️ Trim only |

⚠️ Text and drawing overlays require WebCodecs API support (Chromium-based browsers).

## License

MIT
