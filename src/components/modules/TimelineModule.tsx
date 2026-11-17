import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Lock,
  Magnet,
  Pause,
  Play,
  Plus,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Unlock,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useStudio } from '../../context/StudioContext';
import type {
  AutoEpisodeTiming,
  TimelineClip,
  TimelineClipStatus,
  TimelineClipType,
  TimelineTrackId,
  TransitionType,
} from '../../types/studio';
import {
  DEFAULT_AUTO_EPISODE_TIMING,
  buildAutoEpisodeTimeline,
} from '../../engine/autoEpisode';
import {
  DEFAULT_TIMELINE_TRACKS,
  computeTimelineTotalDuration,
  duplicateClip,
  formatTimecode,
  snapTimeToGrid,
  sortClips,
  splitClipAtTime,
} from '../../engine/timeline';

const CLIP_COLORS: Record<TimelineTrackId, string> = {
  video: 'bg-sky-950/90 border-sky-500/60 text-sky-100',
  graphics: 'bg-violet-950/90 border-violet-500/60 text-violet-100',
  quiz: 'bg-amber-950/90 border-[#D4AF37]/70 text-amber-100',
  field: 'bg-emerald-950/90 border-emerald-500/60 text-emerald-100',
  voiceover: 'bg-cyan-950/90 border-cyan-500/60 text-cyan-100',
  music: 'bg-indigo-950/90 border-indigo-500/60 text-indigo-100',
  sfx: 'bg-rose-950/90 border-rose-500/60 text-rose-100',
};

const CLIP_TYPES: TimelineClipType[] = [
  'intro',
  'question',
  'countdown',
  'reveal',
  'explanation',
  'transition',
  'cta',
  'outro',
  'field-scene',
  'graphic',
  'voiceover',
  'music',
  'sfx',
];

const TRANSITION_TYPES: { id: TransitionType; label: string }[] = [
  { id: 'cut', label: 'Cut (None)' },
  { id: 'fade', label: 'Fade' },
  { id: 'crossfade', label: 'Crossfade' },
  { id: 'slide-left', label: 'Slide Left' },
  { id: 'slide-right', label: 'Slide Right' },
  { id: 'zoom', label: 'Zoom Frame' },
  { id: 'broadcast-wipe', label: 'Broadcast Wipe' },
];

export function TimelineModule() {
  const { activeProject, updateActiveProject } = useStudio();
  const tracks = activeProject.timelineTracks ?? DEFAULT_TIMELINE_TRACKS;
  const clips = activeProject.timelineClips ?? [];
  const fps = activeProject.settings.fps;

  const [selectedClipId, setSelectedClipId] = useState<string | null>(
    clips[0]?.id ?? null
  );
  const [playheadSec, setPlayheadSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pxPerSec, setPxPerSec] = useState(26);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [showAutoBuilder, setShowAutoBuilder] = useState(true);
  const [timingDraft, setTimingDraft] = useState<AutoEpisodeTiming>(
    activeProject.autoEpisodeTiming ?? DEFAULT_AUTO_EPISODE_TIMING
  );

  // Sync timing draft when active project changes
  useEffect(() => {
    setTimingDraft(activeProject.autoEpisodeTiming ?? DEFAULT_AUTO_EPISODE_TIMING);
  }, [activeProject.id, activeProject.autoEpisodeTiming]);

  const totalDurationSec = useMemo(
    () => Math.max(15, computeTimelineTotalDuration(clips)),
    [clips]
  );

  const selectedClip = useMemo(
    () => clips.find((c) => c.id === selectedClipId) ?? null,
    [clips, selectedClipId]
  );

  // Dragging state for move / resize
  const dragStateRef = useRef<{
    mode: 'move' | 'resize';
    clipId: string;
    startClientX: number;
    initialStartSec: number;
    initialDurationSec: number;
  } | null>(null);

  const rulerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      lastTickRef.current = null;
      return;
    }
    const tick = (now: number) => {
      if (lastTickRef.current === null) lastTickRef.current = now;
      const dt = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      setPlayheadSec((prev) => {
        const next = prev + dt;
        if (next >= totalDurationSec) {
          setIsPlaying(false);
          return totalDurationSec;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, totalDurationSec]);

  // Global mouse move / up for smooth timeline clip dragging & resizing
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const ds = dragStateRef.current;
      if (!ds) return;
      const dx = e.clientX - ds.startClientX;
      const deltaSec = dx / pxPerSec;

      updateActiveProject((prev) => {
        const nextClips = prev.timelineClips.map((c) => {
          if (c.id !== ds.clipId) return c;
          if (ds.mode === 'move') {
            const rawStart = Math.max(0, ds.initialStartSec + deltaSec);
            const snapped = snapEnabled
              ? snapTimeToGrid(rawStart, 0.5)
              : Math.round(rawStart * 10) / 10;
            return { ...c, startSec: snapped };
          } else {
            const rawDur = Math.max(0.5, ds.initialDurationSec + deltaSec);
            const snappedDur = snapEnabled
              ? Math.max(0.5, snapTimeToGrid(rawDur, 0.5))
              : Math.round(rawDur * 10) / 10;
            return { ...c, durationSec: snappedDur };
          }
        });
        return { ...prev, timelineClips: sortClips(nextClips) };
      }, false);
    };

    const onMouseUp = () => {
      dragStateRef.current = null;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [pxPerSec, snapEnabled, updateActiveProject]);

  // Keyboard shortcuts inside Timeline: Space, Delete, ArrowLeft/Right, Shift+Arrow
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTextInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (isTextInput) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIsPlaying(false);
        const step = e.shiftKey ? 1 : 1 / fps;
        setPlayheadSec((p) => Math.max(0, Math.round((p - step) * 100) / 100));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setIsPlaying(false);
        const step = e.shiftKey ? 1 : 1 / fps;
        setPlayheadSec((p) =>
          Math.min(totalDurationSec, Math.round((p + step) * 100) / 100)
        );
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedClipId) {
        e.preventDefault();
        updateActiveProject((prev) => ({
          ...prev,
          timelineClips: prev.timelineClips.filter((c) => c.id !== selectedClipId),
        }));
        setSelectedClipId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fps, selectedClipId, totalDurationSec, updateActiveProject]);

  const handleTrackToggle = (trackId: TimelineTrackId, field: 'muted' | 'locked') => {
    updateActiveProject((prev) => ({
      ...prev,
      timelineTracks: prev.timelineTracks.map((t) =>
        t.id === trackId ? { ...t, [field]: !t[field] } : t
      ),
    }));
  };

  const handleUpdateClip = (clipId: string, patch: Partial<TimelineClip>) => {
    updateActiveProject((prev) => ({
      ...prev,
      timelineClips: sortClips(
        prev.timelineClips.map((c) => (c.id === clipId ? { ...c, ...patch } : c))
      ),
    }));
  };

  const handleDeleteClip = (clipId: string) => {
    updateActiveProject((prev) => ({
      ...prev,
      timelineClips: prev.timelineClips.filter((c) => c.id !== clipId),
    }));
    if (selectedClipId === clipId) setSelectedClipId(null);
  };

  const handleDuplicateClip = (clip: TimelineClip) => {
    const copy = duplicateClip(clip);
    updateActiveProject((prev) => ({
      ...prev,
      timelineClips: sortClips([...prev.timelineClips, copy]),
    }));
    setSelectedClipId(copy.id);
  };

  const handleSplitClip = (clip: TimelineClip) => {
    const splitTime =
      playheadSec > clip.startSec + 0.5 &&
      playheadSec < clip.startSec + clip.durationSec - 0.5
        ? playheadSec
        : clip.startSec + clip.durationSec / 2;
    const parts = splitClipAtTime(clip, splitTime);
    if (!parts) return;
    updateActiveProject((prev) => ({
      ...prev,
      timelineClips: sortClips(
        prev.timelineClips.flatMap((c) => (c.id === clip.id ? parts : [c]))
      ),
    }));
    setSelectedClipId(parts[1].id);
  };

  const handleAddClip = (trackId: TimelineTrackId) => {
    const defaultType: TimelineClipType =
      trackId === 'video'
        ? 'intro'
        : trackId === 'graphics'
        ? 'graphic'
        : trackId === 'quiz'
        ? 'question'
        : trackId === 'field'
        ? 'field-scene'
        : trackId === 'voiceover'
        ? 'voiceover'
        : trackId === 'music'
        ? 'music'
        : 'sfx';
    const newClip: TimelineClip = {
      id: `clip-${Date.now().toString(36)}`,
      trackId,
      name: `New ${trackId.toUpperCase()} Clip`,
      startSec: snapEnabled ? snapTimeToGrid(playheadSec, 0.5) : Math.round(playheadSec * 10) / 10,
      durationSec: 4,
      type: defaultType,
      status: trackId === 'voiceover' ? 'draft' : 'ready',
      volume: 1,
    };
    updateActiveProject((prev) => ({
      ...prev,
      timelineClips: sortClips([...prev.timelineClips, newClip]),
    }));
    setSelectedClipId(newClip.id);
  };

  const handleAutoBuildEpisode = () => {
    const built = buildAutoEpisodeTimeline(
      activeProject,
      timingDraft,
      activeProject.autoSfx
    );
    updateActiveProject((prev) => ({
      ...prev,
      autoEpisodeTiming: { ...timingDraft },
      timelineClips: built.clips,
      voiceoverSegments: built.voiceoverSegments,
    }));
    setPlayheadSec(0);
    setSelectedClipId(built.clips[0]?.id ?? null);
  };

  const estimatedAutoRuntime = useMemo(() => {
    const activeQs = activeProject.quizQuestions.filter((q) => q.prompt.trim().length > 0);
    const qDur = activeQs.reduce(
      (sum, q, idx) =>
        sum +
        timingDraft.questionSec +
        (q.countdownSec || timingDraft.countdownSec) +
        timingDraft.revealSec +
        timingDraft.explanationSec +
        (idx < activeQs.length - 1 ? timingDraft.transitionSec : 0),
      0
    );
    return Math.round(
      timingDraft.introSec + qDur + timingDraft.ctaSec + timingDraft.outroSec
    );
  }, [activeProject.quizQuestions, timingDraft]);

  const timelineWidthPx = Math.max(920, Math.ceil((totalDurationSec + 10) * pxPerSec));
  const currentFrame = Math.round(playheadSec * fps);

  const handleRulerSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const x = Math.max(0, e.clientX - rect.left);
    const t = Math.min(totalDurationSec, x / pxPerSec);
    setIsPlaying(false);
    setPlayheadSec(snapEnabled ? snapTimeToGrid(t, 0.25) : Math.round(t * 100) / 100);
  };

  const rulerStepSec = pxPerSec >= 40 ? 2 : pxPerSec >= 22 ? 5 : 10;
  const rulerMarks: number[] = [];
  for (let s = 0; s <= totalDurationSec + 10; s += rulerStepSec) {
    rulerMarks.push(s);
  }

  return (
    <div className="h-full flex flex-col bg-[#080E1A] overflow-hidden">
      {/* Top Timeline Transport & Controls */}
      <div className="px-5 py-3 border-b border-slate-800/80 bg-[#0C1426] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (!isPlaying && playheadSec >= totalDurationSec - 0.05) {
                setPlayheadSec(0);
              }
              setIsPlaying((p) => !p);
            }}
            className="px-3.5 py-1.5 rounded-md bg-[#D4AF37] hover:bg-[#E2BE48] text-[#080E1A] text-xs font-bold flex items-center gap-1.5"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setPlayheadSec((p) => Math.max(0, p - 1 / fps));
            }}
            aria-label="Previous frame"
            className="p-1.5 rounded bg-[#131E38] hover:bg-[#1B2A4F] border border-slate-700/80 text-slate-200"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              setPlayheadSec((p) => Math.min(totalDurationSec, p + 1 / fps));
            }}
            aria-label="Next frame"
            className="p-1.5 rounded bg-[#131E38] hover:bg-[#1B2A4F] border border-slate-700/80 text-slate-200"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <div
            data-testid="timeline-readout"
            className="px-3 py-1 rounded bg-[#080E1A] border border-slate-800 text-xs font-mono-tabular text-slate-100 flex items-center gap-3"
          >
            <span>{formatTimecode(playheadSec, fps)}</span>
            <span className="text-slate-600">/</span>
            <span className="text-slate-400">{formatTimecode(totalDurationSec, fps)}</span>
            <span className="text-slate-600">|</span>
            <span className="text-[#E5B94C]">Frame {currentFrame}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSnapEnabled((s) => !s)}
            aria-pressed={snapEnabled}
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium border flex items-center gap-1.5 ${
              snapEnabled
                ? 'bg-[#172442] border-[#D4AF37]/40 text-[#F4D57A]'
                : 'bg-[#080E1A] border-slate-800 text-slate-400'
            }`}
          >
            <Magnet className="w-3.5 h-3.5" />
            <span>Snap 0.5s</span>
          </button>

          <div className="flex items-center gap-1 bg-[#080E1A] border border-slate-800 rounded-md px-2 py-1">
            <button
              type="button"
              onClick={() => setPxPerSec((z) => Math.max(10, z - 6))}
              aria-label="Zoom out timeline"
              className="text-slate-400 hover:text-slate-100"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <input
              type="range"
              aria-label="Timeline zoom"
              min={10}
              max={70}
              value={pxPerSec}
              onChange={(e) => setPxPerSec(Number(e.target.value))}
              className="w-20 accent-[#D4AF37]"
            />
            <button
              type="button"
              onClick={() => setPxPerSec((z) => Math.min(70, z + 6))}
              aria-label="Zoom in timeline"
              className="text-slate-400 hover:text-slate-100"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowAutoBuilder((v) => !v)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 border ${
              showAutoBuilder
                ? 'bg-[#D4AF37] text-[#080E1A] border-[#D4AF37]'
                : 'bg-[#131E38] text-[#F4D57A] border-[#D4AF37]/40'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Auto Episode Builder</span>
          </button>
        </div>
      </div>

      {/* Main Split: Auto Episode Builder (collapsible) + Multi-Track Timeline + Clip Inspector */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {/* Auto Episode Builder Drawer */}
        {showAutoBuilder && (
          <aside className="w-full lg:w-[275px] shrink-0 bg-[#0B1325] border-b lg:border-b-0 lg:border-r border-slate-800/80 p-4 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-display font-bold text-[#F4D57A] uppercase tracking-wider">
                Auto Episode Builder
              </h3>
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Deterministically builds Intro, Quiz Prompts, Countdowns, Reveals, Explanations, Transitions, CTA, Outro, VO scripts &amp; SFX.
            </p>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              {(
                [
                  { key: 'introSec', label: 'Intro (s)' },
                  { key: 'questionSec', label: 'Question (s)' },
                  { key: 'countdownSec', label: 'Default CD (s)' },
                  { key: 'revealSec', label: 'Reveal (s)' },
                  { key: 'explanationSec', label: 'Explain (s)' },
                  { key: 'transitionSec', label: 'Transition (s)' },
                  { key: 'ctaSec', label: 'Score/CTA (s)' },
                  { key: 'outroSec', label: 'Outro (s)' },
                ] as const
              ).map((item) => (
                <div key={item.key}>
                  <label
                    htmlFor={`auto-${item.key}`}
                    className="block text-[11px] text-slate-400 mb-1"
                  >
                    {item.label}
                  </label>
                  <input
                    id={`auto-${item.key}`}
                    type="number"
                    min={0}
                    max={30}
                    step={0.5}
                    value={timingDraft[item.key]}
                    onChange={(e) =>
                      setTimingDraft((prev) => ({
                        ...prev,
                        [item.key]: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="w-full px-2.5 py-1.5 rounded bg-[#080E1A] border border-slate-800 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              ))}
            </div>

            <div className="p-3 rounded-lg bg-[#080E1A] border border-slate-800 text-xs space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span>Active Questions</span>
                <span className="font-mono-tabular text-slate-100">
                  {activeProject.quizQuestions.filter((q) => q.prompt.trim().length > 0).length}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Estimated Runtime</span>
                <span className="font-mono-tabular font-semibold text-[#E5B94C]">
                  {Math.floor(estimatedAutoRuntime / 60)}m {estimatedAutoRuntime % 60}s
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#080E1A] border border-slate-800 space-y-2">
              <div className="text-[11px] font-semibold text-slate-300">
                Project Default Transition
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <select
                  aria-label="Default Transition Type"
                  value={activeProject.defaultTransition?.type ?? 'fade'}
                  onChange={(e) =>
                    updateActiveProject((prev) => ({
                      ...prev,
                      defaultTransition: {
                        type: e.target.value as TransitionType,
                        durationSec: prev.defaultTransition?.durationSec ?? 0.4,
                      },
                    }))
                  }
                  className="px-2 py-1.5 rounded bg-[#0F182D] border border-slate-800 text-[11px] text-slate-100"
                >
                  {TRANSITION_TYPES.map((tr) => (
                    <option key={tr.id} value={tr.id}>
                      {tr.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  aria-label="Default Transition Duration (s)"
                  min={0.1}
                  max={2}
                  step={0.1}
                  value={activeProject.defaultTransition?.durationSec ?? 0.4}
                  onChange={(e) =>
                    updateActiveProject((prev) => ({
                      ...prev,
                      defaultTransition: {
                        type: prev.defaultTransition?.type ?? 'fade',
                        durationSec: Math.max(0.1, Math.min(2, Number(e.target.value) || 0.4)),
                      },
                    }))
                  }
                  className="px-2 py-1.5 rounded bg-[#0F182D] border border-slate-800 text-[11px] font-mono-tabular text-slate-100"
                />
              </div>
            </div>

            <button
              type="button"
              data-testid="auto-build-episode-btn"
              onClick={handleAutoBuildEpisode}
              className="w-full py-2.5 px-3 rounded-lg bg-[#D4AF37] hover:bg-[#E2BE48] text-[#080E1A] text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AUTO BUILD EPISODE</span>
            </button>
          </aside>
        )}

        {/* Center Multi-Track Canvas */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-auto relative">
            <div className="flex min-w-max">
              {/* Track Headers Column */}
              <div className="w-[190px] shrink-0 sticky left-0 z-20 bg-[#0C1426] border-r border-slate-800">
                <div className="h-8 border-b border-slate-800 px-3 flex items-center text-[11px] font-mono-tabular text-slate-400">
                  TRACKS ({clips.length} clips)
                </div>
                {tracks.map((track) => (
                  <div
                    key={track.id}
                    className="h-14 border-b border-slate-800/70 px-3 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-slate-200 truncate">
                        {track.label}
                      </div>
                      <div className="text-[10px] font-mono-tabular text-slate-500">
                        {clips.filter((c) => c.trackId === track.id).length} clips
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleAddClip(track.id)}
                        title={`Add clip to ${track.label}`}
                        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-[#D4AF37]"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTrackToggle(track.id, 'muted')}
                        title={track.muted ? 'Unmute track' : 'Mute track'}
                        className={`p-1 rounded ${
                          track.muted ? 'text-red-400 bg-red-950/50' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {track.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTrackToggle(track.id, 'locked')}
                        title={track.locked ? 'Unlock track' : 'Lock track'}
                        className={`p-1 rounded ${
                          track.locked ? 'text-amber-400 bg-amber-950/50' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {track.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Scrollable Clip Lanes */}
              <div
                className="relative bg-[#070D19]"
                style={{ width: `${timelineWidthPx}px` }}
              >
                {/* Time Ruler */}
                <div
                  ref={rulerRef}
                  onClick={handleRulerSeek}
                  className="h-8 border-b border-slate-800 bg-[#0A1120] relative cursor-pointer select-none"
                >
                  {rulerMarks.map((sec) => (
                    <div
                      key={sec}
                      className="absolute top-0 bottom-0 border-l border-slate-700/70 pl-1 text-[10px] font-mono-tabular text-slate-400 flex items-center"
                      style={{ left: `${sec * pxPerSec}px` }}
                    >
                      {sec}s
                    </div>
                  ))}
                </div>

                {/* Track Rows */}
                {tracks.map((track) => {
                  const trackClips = clips.filter((c) => c.trackId === track.id);
                  return (
                    <div
                      key={track.id}
                      className={`h-14 border-b border-slate-800/70 relative ${
                        track.muted ? 'opacity-50' : ''
                      }`}
                    >
                      {trackClips.map((clip) => {
                        const leftPx = clip.startSec * pxPerSec;
                        const widthPx = Math.max(28, clip.durationSec * pxPerSec);
                        const isSelected = clip.id === selectedClipId;
                        return (
                          <div
                            key={clip.id}
                            data-testid={`timeline-clip-${clip.id}`}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setSelectedClipId(clip.id);
                              if (track.locked) return;
                              dragStateRef.current = {
                                mode: 'move',
                                clipId: clip.id,
                                startClientX: e.clientX,
                                initialStartSec: clip.startSec,
                                initialDurationSec: clip.durationSec,
                              };
                            }}
                            className={`absolute top-1.5 bottom-1.5 rounded-md border px-2 py-1 flex flex-col justify-between select-none overflow-hidden transition-shadow ${
                              CLIP_COLORS[track.id]
                            } ${
                              isSelected
                                ? 'ring-2 ring-[#D4AF37] shadow-lg z-10'
                                : 'hover:brightness-110'
                            } ${track.locked ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}
                            style={{ left: `${leftPx}px`, width: `${widthPx}px` }}
                            title={`${clip.name} · ${clip.startSec}s (${clip.durationSec}s)`}
                          >
                            <div className="flex items-center justify-between gap-1 min-w-0">
                              <span className="text-[11px] font-semibold truncate">
                                {clip.name}
                              </span>
                              {clip.status === 'missing-audio' && (
                                <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                              )}
                            </div>
                            <div className="text-[10px] font-mono-tabular opacity-75 truncate">
                              {clip.startSec}s · {clip.durationSec}s · {clip.type}
                            </div>

                            {/* Right Resize Handle */}
                            {!track.locked && (
                              <div
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  setSelectedClipId(clip.id);
                                  dragStateRef.current = {
                                    mode: 'resize',
                                    clipId: clip.id,
                                    startClientX: e.clientX,
                                    initialStartSec: clip.startSec,
                                    initialDurationSec: clip.durationSec,
                                  };
                                }}
                                title="Drag to resize clip duration"
                                className="absolute top-0 right-0 bottom-0 w-2 cursor-ew-resize hover:bg-[#D4AF37]/50"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {/* Global Playhead Vertical Line */}
                <div
                  className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-[#D4AF37] z-30"
                  style={{ left: `${playheadSec * pxPerSec}px` }}
                >
                  <div className="w-3 h-3 -ml-[5px] bg-[#D4AF37] rotate-45 -mt-1" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Clip Inspector */}
        <aside className="w-full lg:w-[290px] shrink-0 bg-[#0C1426] border-t lg:border-t-0 lg:border-l border-slate-800/80 p-4 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <h3 className="text-xs font-display font-bold text-slate-200 uppercase tracking-wider">
              Clip Inspector
            </h3>
            {selectedClip && (
              <span className="text-[11px] font-mono-tabular text-[#E5B94C]">
                {selectedClip.trackId.toUpperCase()}
              </span>
            )}
          </div>

          {!selectedClip ? (
            <div className="text-xs text-slate-400 py-8 text-center">
              Click any clip on the timeline to inspect, split, duplicate, or adjust timing.
            </div>
          ) : (
            <div className="space-y-3.5">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Clip Name</label>
                <input
                  type="text"
                  value={selectedClip.name}
                  onChange={(e) => handleUpdateClip(selectedClip.id, { name: e.target.value })}
                  className="w-full px-3 py-1.5 rounded bg-[#080E1A] border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Start (s)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={selectedClip.startSec}
                    onChange={(e) =>
                      handleUpdateClip(selectedClip.id, {
                        startSec: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="w-full px-2.5 py-1.5 rounded bg-[#080E1A] border border-slate-800 text-xs font-mono-tabular text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Duration (s)</label>
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={selectedClip.durationSec}
                    onChange={(e) =>
                      handleUpdateClip(selectedClip.id, {
                        durationSec: Math.max(0.5, Number(e.target.value) || 0.5),
                      })
                    }
                    className="w-full px-2.5 py-1.5 rounded bg-[#080E1A] border border-slate-800 text-xs font-mono-tabular text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Clip Type</label>
                  <select
                    value={selectedClip.type}
                    onChange={(e) =>
                      handleUpdateClip(selectedClip.id, {
                        type: e.target.value as TimelineClipType,
                      })
                    }
                    className="w-full px-2 py-1.5 rounded bg-[#080E1A] border border-slate-800 text-xs text-slate-100"
                  >
                    {CLIP_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Status</label>
                  <select
                    value={selectedClip.status}
                    onChange={(e) =>
                      handleUpdateClip(selectedClip.id, {
                        status: e.target.value as TimelineClipStatus,
                      })
                    }
                    className="w-full px-2 py-1.5 rounded bg-[#080E1A] border border-slate-800 text-xs text-slate-100"
                  >
                    <option value="ready">Ready</option>
                    <option value="draft">Draft</option>
                    <option value="missing-audio">Missing Audio</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Transition</label>
                  <select
                    aria-label="Clip Transition Type"
                    value={
                      selectedClip.transitionType ??
                      activeProject.defaultTransition?.type ??
                      'fade'
                    }
                    onChange={(e) =>
                      handleUpdateClip(selectedClip.id, {
                        transitionType: e.target.value as TransitionType,
                      })
                    }
                    className="w-full px-2 py-1.5 rounded bg-[#080E1A] border border-slate-800 text-xs text-slate-100"
                  >
                    {TRANSITION_TYPES.map((tr) => (
                      <option key={tr.id} value={tr.id}>
                        {tr.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Trans. Dur (s)</label>
                  <input
                    type="number"
                    aria-label="Clip Transition Duration"
                    min={0.1}
                    max={2}
                    step={0.1}
                    value={
                      selectedClip.transitionDurationSec ??
                      activeProject.defaultTransition?.durationSec ??
                      0.4
                    }
                    onChange={(e) =>
                      handleUpdateClip(selectedClip.id, {
                        transitionDurationSec: Math.max(
                          0.1,
                          Math.min(2, Number(e.target.value) || 0.4)
                        ),
                      })
                    }
                    className="w-full px-2.5 py-1.5 rounded bg-[#080E1A] border border-slate-800 text-xs font-mono-tabular text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={selectedClip.notes ?? ''}
                  onChange={(e) => handleUpdateClip(selectedClip.id, { notes: e.target.value })}
                  placeholder="Scene direction or render note..."
                  className="w-full px-2.5 py-1.5 rounded bg-[#080E1A] border border-slate-800 text-xs text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => handleSplitClip(selectedClip)}
                  className="px-2.5 py-1.5 rounded bg-[#131E38] hover:bg-[#1B2B4F] border border-slate-700/80 text-xs text-slate-200 flex items-center justify-center gap-1"
                >
                  <Scissors className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Split</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDuplicateClip(selectedClip)}
                  className="px-2.5 py-1.5 rounded bg-[#131E38] hover:bg-[#1B2B4F] border border-slate-700/80 text-xs text-slate-200 flex items-center justify-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Duplicate</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleDeleteClip(selectedClip.id)}
                className="w-full px-3 py-1.5 rounded bg-red-950/60 hover:bg-red-900/70 border border-red-500/40 text-xs font-medium text-red-200 flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Clip</span>
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
