# Cricket Creator Studio — Concept & Architecture Brief

**Software Architecture & Capabilities Overview**  
*Deterministic Video Production & Tactical Diagram Studio for Cricket Creators*

---

## 1. Executive Summary & Value Proposition

**Cricket Creator Studio** is a specialized, browser-based video production and tactical diagram workspace designed specifically for cricket YouTube channels and Shorts creators.

Instead of manually keyframing quiz cards, countdown bars, fielding diagrams, captions, and vertical Shorts re-crops inside general-purpose editors (Premiere Pro, After Effects, CapCut), creators author **one deterministic cricket project** and publish both **16:9 YouTube Landscape** and **9:16 YouTube Shorts** MP4 masters with synchronized audio and broadcast safe-area layouts.

> **Branding Note:** Neutral placeholder branding (`Cricket Creator Studio` / `@CricketCreator`) is used by default with zero third-party logos or copyrighted player assets. All color swatches, channel handles, watermarks, monograms/logos, and CTA bumpers are live-customizable in the **Brand & Graphics** module.

---

## 2. Core Modules & Studio Capabilities

1. **5-Step New Episode Project Wizard & Project Dashboard**
   - Guided project creation across episode types (*Quiz Video*, *Field Analysis*, *Match Breakdown*, *Player Analysis*, *Cricket Explainer*, *Rules Explainer*, *Short / Reel*, *Custom*), aspect ratio, brand presets, episode metadata, and starter question banks.
   - Live **Renderer Readiness Gate** checking quiz completeness, asset preflight, audio tracks, and timeline integrity before rendering.

2. **Quiz Video Builder & Bulk Importer (Up to 100 Questions)**
   - Supports **Paste Text**, **CSV**, and **JSON** bulk import with line-by-line validation, duplicate/format checks, and merge modes (*Fill Empty Slots*, *Append*, *Replace*).
   - Per-question controls for category tag, difficulty badge, custom countdown duration (`3s–30s`), correct answer selection (`A–D`), explanation text, and optional **Cricket Field Backdrop** behind quiz cards.
   - Includes deterministic **AI Content Assist** templates for rapid cricket trivia drafting and structuring.

3. **Interactive Cricket Field Designer**
   - Includes **23 fielding formation presets** (Powerplay Attack, Death Overs Boundary Protection, Spin Traps, etc.) and **23 delivery/shot/dismissal ball-path animations** (Yorker, Outswinger, Cover Drive, Pull Shot, Six, Catch, etc.).
   - Supports **RHB / LHB handedness flip**, 30-yard circle toggle, fielding zone labels, coordinate grid, drag-and-drop fielder positioning (`-94` to `+94`), highlighted key fielder rings, and live ball trajectory playback.

4. **Production Timeline & Auto Episode Builder**
   - Multi-track deterministic timeline (*Video/Scenes*, *Text/Graphics*, *Quiz*, *Field Animation*, *Voiceover*, *Music*, *SFX*) with clip inspector, snapping (`0.5s`), splitting, duplication, and transition defaults.
   - **One-Click Auto Build Episode**: Reads active quiz questions and timing rules (*Intro, Question, Countdown, Reveal, Explanation, Transition, Score/CTA, Outro*) to generate the full synchronized episode timeline, VO cue scripts, and countdown/reveal SFX automatically.

5. **Multi-Aspect Animation Preview (`16:9`, `9:16`, `1:1`)**
   - Single-source-of-truth stage powered by the exact same deterministic timeline evaluator used by the video exporter.
   - Features **Broadcast Safe Area** guides, alignment grid, speed selector (`0.25x–2x`), scene jumper, and instant aspect-ratio toggle.

6. **Brand & Graphics Studio**
   - Customizable Brand Kit (Brand Name, Channel Name, Handle, Watermark text, Website, Monogram badge or uploaded logo image from IndexedDB, 4-color hex palette, and Default CTA).
   - Broadcast graphic overlay templates (Score Bug, Bowler/Delivery Lower Third, Match Header) and `1280×720` Thumbnail Composer.

7. **Audio, Voiceover & Captions**
   - Supports uploaded audio tracks (`.mp3` / `.wav` persisted in IndexedDB), volume/fade controls, master mute, `-1 dBFS` audio normalization, procedural SFX triggers (countdown ticks & answer reveal chimes), and auto-timed captions with `.srt` export.

8. **Segmented Export & Render Center (Browser WebCodecs + FFmpeg Concatenation)**
   - Exports real `.mp4` (`H.264 High / yuv420p` + `AAC 48 kHz stereo`) files directly from timeline state:
     - `1920×1080` (`16:9` YouTube Landscape)
     - `1280×720` (`16:9` Preview Draft)
     - `854×480` (`16:9` Quick Draft)
     - `1080×1920` (`9:16` YouTube Shorts / Reels)
     - `1080×1080` (`1:1` Square Social)
   - **Segmented Checkpoint Recovery**: Splits longer exports into contiguous segments concatenated server-side via FFmpeg (`H.264` + `AAC`), preserving completed segments so interrupted renders can resume without losing progress.

9. **Package & YouTube Delivery**
   - Generates copy-ready YouTube Title, Description, Auto-Generated Timeline Chapters, Tags, Hashtags, Pinned Comment, Thumbnail Hook text, and full editable `.zip` project packages.

10. **Project Manager & Version Snapshots**
    - Multi-project workspace management, snapshot restore points, Undo/Redo history, and `Ctrl+K` command palette.

---

## 3. Workflows

### A. Rapid Quiz Video Automation Workflow
1. Create an episode in the **5-Step Project Wizard** -> paste raw text or CSV questions into **Bulk Question Importer** -> click **Validate Questions** & **Import**.
2. Adjust per-question countdowns or enable field backdrops in **Quiz Video Builder**.
3. Open **Production Timeline** -> configure Intro/Question/Reveal/Explanation pacing -> click **AUTO BUILD EPISODE** to lay out every video track, broadcast graphic, caption cue, and SFX clip in under 1 second.

### B. Tactical Field Animation Workflow
1. Pick a match situation in **Cricket Field Designer** (e.g., *Powerplay Attack (2 Slips)* or *Death Overs Boundary Protection*).
2. Toggle **RHB / LHB**, adjust individual fielder markers or jersey numbers, pick a curved delivery/shot preset, and scrub/animate the ball path on the pitch diagram.
3. Render the animated diagram standalone or embedded inside quiz countdowns and pre-question breakdowns.

### C. Dual-Format Publishing (`16:9` Landscape + `9:16` Shorts)
- Switch aspect ratio cleanly between `16:9` (`1280×720` / `1920×1080`) and `9:16` (`1080×1920`) from the same timeline project.
- Built-in **safe-area-aware layout adaptation** automatically repositions the score bug, lower-third telemetry, question card, 4 answer boxes, countdown bar, captions, and channel watermark so nothing overlaps or clips in vertical Shorts framing.

---

## 4. Technical Scope & Architecture Notes

1. **Browser & Hardware Encoding Dependency**: Video frame encoding relies on Chromium's `WebCodecs` (`VideoEncoder` / `AudioEncoder`) paired with the local Node/FFmpeg concatenation backend. Safari/Firefox or older browsers without `WebCodecs` H.264 support are unsupported for in-browser MP4 rendering.
2. **Audio & Voiceover Source**: Mixes procedural broadcast audio cues (countdown ticks, reveal chimes, ambient tones) normalized to `-1 dBFS`. Spoken narration uses uploaded `.mp3`/`.wav` tracks per project.
3. **Local Persistence**: Projects (`localStorage`) and binary media assets (`IndexedDB`) persist locally in the browser alongside temporary segment stitching on the backend server.
