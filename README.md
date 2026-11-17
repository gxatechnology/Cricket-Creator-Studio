# Cricket Creator Studio

> **Desktop-grade browser-based video production and tactical diagram suite designed specifically for cricket YouTube channels, Shorts, and social video creators.**

Cricket Creator Studio replaces tedious manual keyframing inside general-purpose video editors with a deterministic, template-driven workflow. Creators can author a single cricket project and automatically export broadcast-ready **16:9 YouTube Landscape** and **9:16 YouTube Shorts** MP4 videos with synchronized audio, procedural sound effects, animated pitch diagrams, and broadcast safe-area layouts.

---

## Table of Contents

- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Installation & Quick Start](#installation--quick-start)
- [Authentication & Security (Supabase + Google OAuth)](#authentication--security-supabase--google-oauth)
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

9. **Secure Creator Account & Guest Mode**
   - Production-oriented Google Sign-In using Supabase Auth with PKCE flow.
   - Local offline Guest Mode for seamless local development without external dependencies.
   - Local device projects are strictly preserved and never forcibly uploaded or overwritten on login.

10. **YouTube Packaging & ZIP Backup**
    - Copy-ready YouTube metadata (Title, Description, Auto-Generated Chapters, Tags, Hashtags, Pinned Comment, and Thumbnail text).
    - Full `.zip` project packaging for backup, sharing, and offline migration.

---

## Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Motion, Lucide React
- **Authentication**: Supabase Auth (`@supabase/supabase-js` v2) with Google OAuth 2.0 PKCE flow
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

## Authentication & Security (Supabase + Google OAuth)

Cricket Creator Studio supports authenticated creator sessions powered by **Supabase Auth** with Google OAuth 2.0 PKCE flows, alongside an offline **Guest Mode** for local development.

### 1. Supabase Project Setup
1. Create a project at [supabase.com](https://supabase.com).
2. Go to **Project Settings** -> **API** and copy:
   - **Project URL** -> `VITE_SUPABASE_URL`
   - **anon / public key** -> `VITE_SUPABASE_ANON_KEY`

### 2. Google Cloud Console Configuration
1. Open the [Google Cloud Console](https://console.cloud.google.com/) -> **APIs & Services** -> **Credentials**.
2. Create an **OAuth 2.0 Client ID** of type **Web application**.
3. Under **Authorized redirect URIs**, add the Supabase Auth callback URL:
   ```
   https://<your-supabase-project-id>.supabase.co/auth/v1/callback
   ```
4. Copy the generated **Client ID** and **Client Secret**.

### 3. Supabase Google Provider Setup
1. In your Supabase dashboard, go to **Authentication** -> **Providers** -> **Google**.
2. Toggle **Enable Google provider**.
3. Paste your Google Cloud **Client ID** and **Client Secret**.
4. In **Authentication** -> **URL Configuration**:
   - Set **Site URL** to `http://localhost:3000` (or your production hosting domain).
   - In **Redirect URLs**, add `http://localhost:3000/**`.

### 4. Local Callback & PKCE Flow
- When a creator clicks **Sign in with Google**, the client initiates an OAuth flow with `redirectTo: window.location.origin`.
- On return, the client exchanges the PKCE code automatically and cleans query parameters (`?code=...`) from the browser URL bar.
- If Supabase environment variables are missing, the UI gracefully displays a **Configuration Required** status banner and keeps all offline studio features active in Guest Mode.

### 5. Server Authorization & Cross-User Isolation
- **No Untrusted IDs**: Render jobs derive user ownership directly from verified server-side identity (`req.user.id`). User IDs in HTTP request bodies are rejected as ownership indicators.
- **Cross-User Protection**: Render job status, segment uploads, resume calls, cancellation, finalization, and deletion verify that `runtime.job.ownerId === req.user.id`. Any unauthorized attempt returns `403 Forbidden`.
- **Safe Local Development**: In local development (`process.env.NODE_ENV !== 'production'`), loopback requests (`127.0.0.1`, `localhost`) are granted `guest:local` status so creators can render without configuring cloud auth.
- **Strict Production Mode**: Set `REQUIRE_AUTH=true` in hosted production environments to mandate a valid Supabase JWT Bearer token on all render job requests.

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

The project includes 41 deterministic unit tests covering fielding math, timeline assembly, question parsing, readiness gates, audio mixing, segment rendering, authentication state, and backend authorization:

```bash
npx tsx --test src/engine/*.test.ts src/render/*.test.ts src/auth/*.test.ts src/server/*.test.ts
```

All 41 tests execute in ~2.3 seconds.

---

## Environment Configuration

Copy [.env.example](file:///.env.example) to `.env`:

```ini
# Supabase Authentication (Browser / Vite Public)
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-publishable-key"

# Server Settings
PORT=3000
REQUIRE_AUTH=false

# Optional Gemini AI Content Assist
GEMINI_API_KEY="your-gemini-api-key"

# Deployment URL
APP_URL="http://localhost:3000"
```

---

## MP4 Rendering Architecture & Prerequisites

The rendering pipeline uses a hybrid browser/server architecture:

1. **Frame Evaluation & Offscreen Rendering**: The project timeline is evaluated frame-by-frame on an offscreen HTML5 canvas using Web Workers (`renderWorker.ts`).
2. **Hardware/Software WebCodecs Encoding**: Frames are compressed into H.264 video chunks and AAC audio chunks using browser-native `VideoEncoder` and `AudioEncoder`.
3. **Contiguous Segments**: To prevent memory overflow during multi-minute 1080p renders, the timeline is partitioned into discrete segments (e.g., 18s–20s each).
4. **Server Concatenation**: Segments are posted to `/api/render/jobs/:jobId/segments/:segmentIndex` with authenticated Bearer tokens and finalized into a single `.mp4` master file using FFmpeg concat protocols.

> **Note:** Browsers lacking `WebCodecs` H.264 support (such as current Firefox or Safari) cannot render MP4 videos directly; use a Chromium-based browser.

---

## Project Documentation

Detailed architecture specifications, module breakdowns, and benchmark metrics are available in:
- [CRICKET-CREATOR-STUDIO-SALES-BRIEF.md](docs/CRICKET-CREATOR-STUDIO-SALES-BRIEF.md)

---

## Current Scope & Limitations

1. **Single-User Local Storage**: Project state and assets are persisted client-side in `localStorage` and `IndexedDB`. Cloud database synchronization and team collaboration are planned for future phases.
2. **Chromium Requirement for Video Export**: In-browser video rendering relies on Chromium's implementation of the `WebCodecs` API.
3. **Voiceover Narration**: The studio generates procedural broadcast sound effects and timer audio automatically; spoken commentary requires uploading audio clips or integrating a third-party TTS service.
4. **YouTube Publishing**: YouTube metadata and ZIP archives are generated for manual one-click delivery; direct YouTube API OAuth upload is planned for Phase 2.

---

## License

Private and proprietary. All rights reserved by GXA Technology.
