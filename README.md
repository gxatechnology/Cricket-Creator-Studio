# Cricket Creator Studio

> **Desktop-grade browser-based video production and tactical diagram suite designed specifically for cricket YouTube channels, Shorts, and social video creators.**

Cricket Creator Studio replaces tedious manual keyframing inside general-purpose video editors with a deterministic, template-driven workflow. Creators can author a single cricket project and automatically export broadcast-ready **16:9 YouTube Landscape** and **9:16 YouTube Shorts** MP4 videos with synchronized audio, procedural sound effects, animated pitch diagrams, and broadcast safe-area layouts.

---

## Table of Contents

- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Installation & Quick Start](#installation--quick-start)
- [Development Commands](#development-commands)
- [Testing](#testing)
- [Environment Configuration](#environment-configuration)
- [MP4 Rendering Architecture & Prerequisites](#mp4-rendering-architecture--prerequisites)
- [Project Documentation](#project-documentation)
- [Current Scope & Limitations](#current-scope--limitations)
- [License](#license)

---

## Key Features

1. **5-Step Episode Project Wizard & Dashboard**
   - Guided project setup across formats (*Quiz Video*, *Field Analysis*, *Match Breakdown*, *Player Analysis*, *Cricket Explainer*, *Rules Explainer*, *Short / Reel*).
   - Live **Renderer Readiness Gate** that validates questions, assets, audio tracks, and timeline integrity before allowing export.

2. **Interactive Cricket Field Designer**
   - **23 fielding presets** (e.g., Powerplay Attack, Death Overs Boundary Protection, Spin Traps).
   - **23 ball-path delivery and shot trajectory animations** (e.g., Yorker, Outswinger, Cover Drive, Pull Shot, Six, Catch).
   - RHB / LHB handedness flip, 30-yard circle toggle, fielding zone labels, coordinate grid, drag-and-drop fielder markers (`-94` to `+94`), and live ball animation playback.

3. **30-Question Quiz Video Builder & Bulk Importer**
   - Bulk question import via **Paste Text**, **CSV**, or **JSON** with row validation, duplicate detection, and flexible merge modes (*Fill Empty Slots*, *Append*, *Replace*).
   - Per-question category tags, difficulty badges, configurable countdown timers (`3s–30s`), answer options (`A–D`), explanations, and optional animated field backdrops.

4. **Multi-Track Timeline & Auto Episode Generator**
   - Multi-track deterministic timeline spanning *Video/Scenes*, *Text/Graphics*, *Quiz*, *Field Animation*, *Voiceover*, *Music*, and *SFX*.
   - **1-Click Auto Build Episode**: Automatically generates full synchronized video clips, voiceover cue scripts, transition cuts, countdown bars, and sound effects from quiz questions in under 1 second.

5. **Multi-Aspect Animation Preview (`16:9`, `9:16`, `1:1`)**
   - Preview stage powered by the exact same timeline evaluation engine used by the video exporter.
   - Live **Broadcast Safe Area** overlays, alignment guides, variable playback speed (`0.25x–2x`), and instant aspect-ratio switching.

6. **Brand & Graphics Studio**
   - Custom Brand Kit: Channel name, handle, watermark text, website, custom monogram or uploaded logo image (stored in IndexedDB), 4-color hex palette, and default CTA bumper.
   - Broadcast graphics: Score bug, bowler/delivery lower-third overlay, match header, and 720p thumbnail composer.

7. **Audio Engine, Procedural SFX & Captions**
   - Procedural broadcast audio cues (countdown tick generator, answer reveal chime, ambient audio tones) normalized to `-1 dBFS`.
   - Support for custom uploaded `.mp3` / `.wav` voiceover and background music tracks with volume and fade controls.
   - Auto-timed subtitle caption generator with `.srt` export.

8. **Segmented MP4 Export Center**
   - Direct-to-disk MP4 encoding (`H.264 High / yuv420p` + `AAC 48 kHz stereo`) supporting `1920×1080` (16:9), `1280×720` (16:9), `854×480` (16:9 draft), `1080×1920` (9:16 Shorts), and `1080×1080` (1:1 Square).
   - **Segmented Checkpoint Recovery**: Splits long renders into contiguous segments concatenated via FFmpeg, allowing interrupted exports to resume seamlessly.

9. **YouTube Packaging & ZIP Backup**
   - Copy-ready YouTube metadata (Title, Description, Auto-Generated Chapters, Tags, Hashtags, Pinned Comment, and Thumbnail text).
   - Full `.zip` project packaging for backup, sharing, and offline migration.

---

## Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Motion, Lucide React
- **Build System & Dev Server**: Vite 8, Express, `tsx`
- **Video & Audio Encoding**: HTML5 Canvas2D, WebCodecs API (`VideoEncoder`, `AudioEncoder`), `mp4-muxer`, `webm-muxer`
- **Server Concatenation Backend**: Node.js `child_process` + FFmpeg
- **Client Persistence**: Browser `localStorage` (project metadata & settings) + `IndexedDB` (audio blobs, custom logo images)
- **Archive & Export**: JSZip
- **Test Runner**: Node Test Runner via `tsx --test`

---

## Prerequisites

- **Node.js**: v20+ or v24 LTS
- **npm**: v10+ (default package manager)
- **Browser**: Chromium-based browser (Google Chrome, Microsoft Edge, Brave, or Chromium) is required for hardware-accelerated `WebCodecs` H.264 video rendering.
- **FFmpeg & FFprobe**: Required on the host machine for segmented render stitching and final MP4 packaging.
  - Windows: Available via `winget install Gyan.FFmpeg` or [ffmpeg.org](https://ffmpeg.org/download.html). Ensure `ffmpeg` and `ffprobe` are on your system `PATH`.
  - macOS: `brew install ffmpeg`
  - Linux: `sudo apt-get install ffmpeg`

---

## Installation & Quick Start

1. **Clone the repository:**
   ```bash
   git clone https://github.com/gxatechnology/Cricket-Creator-Studio.git
   cd Cricket-Creator-Studio
   ```

2. **Install dependencies:**
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```
   Open your browser at [http://localhost:3000](http://localhost:3000).

---

## Development Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Express + Vite development server at `http://localhost:3000` |
| `npm run lint` | Runs TypeScript compiler checks (`tsc --noEmit`) |
| `npm run build` | Compiles production assets into `dist/` using Vite |
| `npm run preview` | Previews the production build locally |

---

## Testing

The project includes unit and integration tests covering the cricket fielding coordinate system, timeline determinism, question importer, readiness checker, audio mixing, and segmented render planner:

```bash
npx tsx --test src/engine/*.test.ts src/render/*.test.ts
```

All 33 test suites run deterministically in under 2 seconds.

---

## Environment Configuration

Copy [.env.example](file:///.env.example) to `.env`:

```ini
# Optional: Port for the Express server (default: 3000)
PORT=3000

# Optional: Gemini API Key for AI trivia and question assist
GEMINI_API_KEY="your-api-key-here"

# Optional: Host URL for Cloud Run or reverse-proxy deployments
APP_URL="http://localhost:3000"
```

---

## MP4 Rendering Architecture & Prerequisites

The rendering pipeline uses a hybrid browser/server architecture:

1. **Frame Evaluation & Offscreen Rendering**: The project timeline is evaluated frame-by-frame on an offscreen HTML5 canvas using Web Workers (`renderWorker.ts`).
2. **Hardware/Software WebCodecs Encoding**: Frames are compressed into H.264 video chunks and AAC audio chunks using browser-native `VideoEncoder` and `AudioEncoder`.
3. **Contiguous Segments**: To prevent memory overflow during multi-minute 1080p renders, the timeline is partitioned into discrete segments (e.g., 18s–20s each).
4. **Server Concatenation**: Segments are posted to the local backend `/api/render/jobs/:jobId/segments/:segmentIndex` and finalized into a single cohesive `.mp4` master file using FFmpeg concat protocols.

> **Note:** Browsers lacking `WebCodecs` H.264 support (such as current Firefox or Safari) cannot render MP4 videos directly; use a Chromium-based browser.

---

## Project Documentation

Detailed architecture specifications, module breakdowns, and benchmark metrics are available in:
- [CRICKET-CREATOR-STUDIO-SALES-BRIEF.md](docs/CRICKET-CREATOR-STUDIO-SALES-BRIEF.md)

---

## Current Scope & Limitations

1. **Single-User Local Storage**: Project state and assets are persisted client-side in `localStorage` and `IndexedDB`. Cloud database synchronization and team collaboration are not yet implemented.
2. **Chromium Requirement for Video Export**: In-browser video rendering relies on Chromium's implementation of the `WebCodecs` API.
3. **Voiceover Narration**: The studio generates procedural broadcast sound effects and timer audio automatically; spoken commentary requires uploading audio clips or integrating a third-party TTS service.
4. **External Uploads**: YouTube metadata and ZIP archives are generated for manual one-click delivery; direct YouTube API OAuth upload is planned for a future release.

---

## License

Private and proprietary. All rights reserved by GXA Technology.
