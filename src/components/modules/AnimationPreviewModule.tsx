import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Film,
  Grid3X3,
  Maximize2,
  Minimize2,
  Monitor,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Smartphone,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useStudio } from '../../context/StudioContext';
import type { AspectRatio, PreviewSequenceMode } from '../../types/studio';
import {
  computeFieldSequenceDuration,
  computeQuizTimeline,
  computeSequenceDuration,
  evaluateSequenceAtTime,
  formatTimecode,
  sortClips,
} from '../../engine/timeline';
import { CricketFieldSvg } from '../CricketFieldSvg';

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;
const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 1.5, 2] as const;

export function AnimationPreviewModule() {
  const { activeProject, updateActiveProject, setActiveModule } = useStudio();
  const aspectRatio = activeProject.settings.aspectRatio;
  const fps = activeProject.settings.fps;
  const showSafeZones = activeProject.settings.showSafeZones;
  const isMuted = activeProject.audioMix.masterMuted;
  const brand = activeProject.brandKit;
  const brandOverlay = activeProject.brandOverlay ?? {
    logoScale: 1,
    watermarkOpacity: 0.75,
    watermarkScale: 1,
    showWatermark: true,
    showChannelHandle: true,
  };
  const captionSettings = activeProject.captionSettings ?? {
    enabled: true,
    style: 'broadcast',
    fontSize: 28,
    showBackground: true,
    textOutline: true,
  };

  const [sequenceMode, setSequenceMode] = useState<PreviewSequenceMode>('timeline');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<(typeof PLAYBACK_SPEEDS)[number]>(1);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [showGrid, setShowGrid] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const stageWrapRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);

  const totalDurationSec = useMemo(
    () => computeSequenceDuration(activeProject, sequenceMode),
    [activeProject, sequenceMode]
  );

  const fieldDurationSec = useMemo(
    () => computeFieldSequenceDuration(activeProject),
    [activeProject]
  );

  const quizSegments = useMemo(
    () =>
      computeQuizTimeline(
        activeProject.quizQuestions,
        sequenceMode === 'combined' ? fieldDurationSec : 0
      ),
    [activeProject.quizQuestions, sequenceMode, fieldDurationSec]
  );

  const timelineSceneStarts = useMemo(() => {
    const clips = sortClips(
      activeProject.timelineClips.filter(
        (c) => c.trackId === 'video' || c.trackId === 'field'
      )
    );
    return Array.from(new Set(clips.map((c) => c.startSec))).sort((a, b) => a - b);
  }, [activeProject.timelineClips]);

  // Clamp currentTimeSec when mode or project changes
  useEffect(() => {
    setCurrentTimeSec((prev) => Math.min(prev, totalDurationSec));
  }, [totalDurationSec]);

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      lastFrameTimeRef.current = null;
      return;
    }

    const tick = (now: number) => {
      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = now;
      }
      const deltaSec = ((now - lastFrameTimeRef.current) / 1000) * playbackSpeed;
      lastFrameTimeRef.current = now;

      setCurrentTimeSec((prev) => {
        const next = prev + deltaSec;
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
  }, [isPlaying, playbackSpeed, totalDurationSec]);

  // Keyboard shortcuts: Space (Play/Pause), ArrowLeft/Right (1 frame), Shift+Arrow (1s)
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
        setCurrentTimeSec((prev) => Math.max(0, prev - step));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setIsPlaying(false);
        const step = e.shiftKey ? 1 : 1 / fps;
        setCurrentTimeSec((prev) => Math.min(totalDurationSec, prev + step));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fps, totalDurationSec]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const scene = useMemo(
    () => evaluateSequenceAtTime(activeProject, sequenceMode, currentTimeSec),
    [activeProject, sequenceMode, currentTimeSec]
  );

  const stepFrame = (direction: -1 | 1) => {
    setIsPlaying(false);
    const frameDelta = 1 / fps;
    setCurrentTimeSec((prev) =>
      Math.max(0, Math.min(totalDurationSec, prev + direction * frameDelta))
    );
  };

  const stepScene = (direction: -1 | 1) => {
    setIsPlaying(false);
    if (timelineSceneStarts.length === 0) return;
    if (direction === 1) {
      const next = timelineSceneStarts.find((t) => t > currentTimeSec + 0.05);
      if (next !== undefined) setCurrentTimeSec(next);
    } else {
      const prevStarts = timelineSceneStarts.filter((t) => t < currentTimeSec - 0.15);
      if (prevStarts.length > 0) setCurrentTimeSec(prevStarts[prevStarts.length - 1]);
      else setCurrentTimeSec(0);
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      if (currentTimeSec >= totalDurationSec - 0.02) {
        setCurrentTimeSec(0);
      }
      setIsPlaying(true);
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement && stageWrapRef.current) {
        await stageWrapRef.current.requestFullscreen();
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      setIsFullscreen((v) => !v);
    }
  };

  const setAspectRatio = (nextRatio: AspectRatio) => {
    updateActiveProject((prev) => ({
      ...prev,
      settings: { ...prev.settings, aspectRatio: nextRatio },
    }));
  };

  const isPortrait = aspectRatio === '9:16';
  const isSquare = aspectRatio === '1:1';
  const currentFrame = Math.round(currentTimeSec * fps);

  return (
    <div ref={stageWrapRef} className="h-full flex flex-col bg-[#080E1A] overflow-hidden">
      {/* Stage Controls Toolbar */}
      <div className="px-5 py-3 border-b border-slate-800/80 bg-[#0C1426] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-[#080E1A] p-0.5 rounded-md border border-slate-800">
            {(
              [
                { id: 'timeline', label: 'Master Timeline' },
                { id: 'combined', label: 'Combined' },
                { id: 'field', label: 'Field' },
                { id: 'quiz', label: 'Quiz' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setSequenceMode(m.id);
                  setCurrentTimeSec(0);
                }}
                className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                  sequenceMode === m.id
                    ? 'bg-[#172442] text-[#F4D57A]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="flex items-center bg-[#080E1A] p-0.5 rounded-md border border-slate-800">
            <button
              type="button"
              onClick={() => setAspectRatio('16:9')}
              aria-pressed={aspectRatio === '16:9'}
              className={`px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1 whitespace-nowrap ${
                aspectRatio === '16:9'
                  ? 'bg-[#D4AF37] text-[#080E1A] font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>16:9</span>
            </button>
            <button
              type="button"
              onClick={() => setAspectRatio('9:16')}
              aria-pressed={aspectRatio === '9:16'}
              className={`px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1 whitespace-nowrap ${
                aspectRatio === '9:16'
                  ? 'bg-[#D4AF37] text-[#080E1A] font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>9:16</span>
            </button>
            <button
              type="button"
              onClick={() => setAspectRatio('1:1')}
              aria-pressed={aspectRatio === '1:1'}
              className={`px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1 whitespace-nowrap ${
                aspectRatio === '1:1'
                  ? 'bg-[#D4AF37] text-[#080E1A] font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Square className="w-3.5 h-3.5" />
              <span>1:1</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              updateActiveProject((prev) => ({
                ...prev,
                settings: {
                  ...prev.settings,
                  showSafeZones: !prev.settings.showSafeZones,
                },
              }))
            }
            aria-pressed={showSafeZones}
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium border whitespace-nowrap ${
              showSafeZones
                ? 'bg-[#172442] border-[#D4AF37]/40 text-[#F4D57A]'
                : 'bg-[#080E1A] border-slate-800 text-slate-400'
            }`}
          >
            Safe Area
          </button>

          <button
            type="button"
            onClick={() => setShowGrid((g) => !g)}
            aria-pressed={showGrid}
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium border flex items-center gap-1 whitespace-nowrap ${
              showGrid
                ? 'bg-[#172442] border-[#D4AF37]/40 text-[#F4D57A]'
                : 'bg-[#080E1A] border-slate-800 text-slate-400'
            }`}
          >
            <Grid3X3 className="w-3.5 h-3.5" />
            <span>Grid</span>
          </button>

          <button
            type="button"
            onClick={() =>
              updateActiveProject((prev) => ({
                ...prev,
                audioMix: { ...prev.audioMix, masterMuted: !prev.audioMix.masterMuted },
              }))
            }
            aria-pressed={isMuted}
            title={isMuted ? 'Unmute audio' : 'Mute audio'}
            className={`p-1.5 rounded-md border ${
              isMuted
                ? 'bg-red-950/60 border-red-500/40 text-red-300'
                : 'bg-[#080E1A] border-slate-800 text-slate-300'
            }`}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            title="Toggle Fullscreen Preview"
            className="p-1.5 rounded-md bg-[#080E1A] border border-slate-800 text-slate-300 hover:text-white"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveModule('export')}
            className="px-3 py-1.5 rounded-md bg-[#D4AF37] hover:bg-[#E2BE48] text-[#080E1A] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
          >
            <Film className="w-3.5 h-3.5" />
            <span>Export Video</span>
          </button>

          {sequenceMode !== 'field' && (
            <div className="flex items-center gap-1.5">
              <label htmlFor="preview-jump-q" className="text-xs text-slate-400">
                Jump
              </label>
              <select
                id="preview-jump-q"
                value={scene.quizState?.questionNumber ?? 0}
                onChange={(e) => {
                  const qNum = Number(e.target.value);
                  if (qNum === 0) {
                    setCurrentTimeSec(0);
                    return;
                  }
                  if (sequenceMode === 'timeline') {
                    const clip = activeProject.timelineClips.find(
                      (c) => c.questionIndex === qNum - 1
                    );
                    if (clip) {
                      setIsPlaying(false);
                      setCurrentTimeSec(clip.startSec);
                    }
                    return;
                  }
                  const seg = quizSegments[qNum - 1];
                  if (seg) {
                    setIsPlaying(false);
                    setCurrentTimeSec(seg.startSec);
                  }
                }}
                className="px-2 py-1.5 rounded-md bg-[#080E1A] border border-slate-700/80 text-xs font-mono-tabular text-slate-100"
              >
                <option value={0}>Start / Intro</option>
                {activeProject.quizQuestions
                  .filter((q) => q.prompt.trim().length > 0)
                  .map((q) => (
                    <option key={q.id} value={q.index + 1}>
                      Q{q.index + 1}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main Broadcast Stage Viewport */}
      <div className="flex-1 min-h-0 p-6 flex items-center justify-center overflow-auto bg-[#060B15]">
        <div
          data-testid="preview-stage"
          data-aspect-ratio={aspectRatio}
          data-active-stage={scene.activeStage}
          className={`relative rounded-xl overflow-hidden border border-slate-700/80 shadow-2xl transition-all ${
            isPortrait
              ? 'h-full max-h-[600px] aspect-[9/16]'
              : isSquare
              ? 'h-full max-h-[560px] aspect-square'
              : 'w-full max-w-[920px] aspect-video'
          }`}
          style={{ backgroundColor: brand.backgroundColor }}
        >
          {/* Optional Rule-of-Thirds Broadcast Grid */}
          {showGrid && (
            <div className="pointer-events-none absolute inset-0 z-30 grid grid-cols-3 grid-rows-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="border border-slate-400/15" />
              ))}
            </div>
          )}

          {/* Title-Safe & Action-Safe Broadcast Guides */}
          {showSafeZones && (
            <div className="pointer-events-none absolute inset-0 z-30">
              <div className="absolute inset-[5%] border border-dashed border-sky-400/25 rounded" />
              <div className="absolute inset-[10%] border border-dotted border-[#D4AF37]/25 rounded" />
            </div>
          )}

          {/* Brand Watermark */}
          {brandOverlay.showWatermark && brand.watermarkText && (
            <div
              className="pointer-events-none absolute top-4 right-5 z-20 text-[11px] font-mono-tabular font-semibold"
              style={{
                color: brand.accentColor,
                opacity: brandOverlay.watermarkOpacity,
              }}
            >
              {brand.watermarkText}
            </div>
          )}

          {/* Stage Render: Intro / CTA / Outro */}
          {(scene.activeStage === 'intro' ||
            scene.activeStage === 'cta' ||
            scene.activeStage === 'outro') && (
            <div
              className="w-full h-full flex flex-col items-center justify-center text-center p-8 gap-4"
              style={{ backgroundColor: brand.primaryColor }}
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-display font-bold shadow-lg"
                style={{
                  backgroundColor: brand.accentColor,
                  color: brand.backgroundColor,
                }}
              >
                {brand.logoTextFallback}
              </div>
              <div
                className="text-xs font-mono-tabular uppercase tracking-widest"
                style={{ color: brand.accentColor }}
              >
                {scene.activeStage === 'intro'
                  ? `${brand.channelName} · Episode ${activeProject.production.episodeNumber}`
                  : scene.activeStage === 'cta'
                  ? 'Final Score & Challenge'
                  : 'Thanks for Watching'}
              </div>
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-white max-w-xl leading-tight">
                {scene.activeStage === 'intro'
                  ? activeProject.title
                  : scene.activeStage === 'cta'
                  ? brand.ctaText
                  : `${brand.channelName} · ${brand.youtubeHandle}`}
              </h2>
              <p className="text-xs text-slate-300 max-w-md">{activeProject.subtitle}</p>
            </div>
          )}

          {/* Stage Render: Field Tactical Sequence */}
          {scene.activeStage === 'field' && (
            <div
              className={`w-full h-full flex ${
                isPortrait ? 'flex-col justify-between p-4' : 'flex-row items-center p-6 gap-6'
              }`}
            >
              <div
                className={`${
                  isPortrait ? 'w-full aspect-square' : 'h-full aspect-square'
                } mx-auto rounded-lg overflow-hidden border border-slate-700/70 bg-[#081312] shrink-0`}
              >
                <CricketFieldSvg
                  fieldDesign={scene.activeFieldDesign}
                  ballEvaluation={scene.ballEval}
                  className="w-full h-full"
                />
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-between gap-3">
                <div className="space-y-1.5">
                  <div
                    className="text-[11px] font-mono-tabular"
                    style={{ color: brand.accentColor }}
                  >
                    {activeProject.settings.seriesName}
                  </div>
                  <h2
                    className={`font-display font-bold text-slate-100 leading-tight ${
                      isPortrait ? 'text-base' : 'text-xl'
                    }`}
                  >
                    {activeProject.title}
                  </h2>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {scene.activeFieldDesign.activePresetName}
                  </p>
                </div>

                <div className="bg-[#0F1B33]/90 border border-slate-700/70 rounded-lg p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-[10px] text-slate-400">Delivery</div>
                      <div className="font-semibold text-slate-100">
                        {scene.activeFieldDesign.ballPath.deliveryType}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">Speed</div>
                      <div
                        className="font-mono-tabular font-semibold"
                        style={{ color: brand.accentColor }}
                      >
                        {scene.activeFieldDesign.ballPath.speedKmh} km/h
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">Shot Outcome</div>
                      <div className="font-semibold text-slate-100">
                        {scene.activeFieldDesign.ballPath.shotType}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">Phase</div>
                      <div className="font-mono-tabular font-semibold text-sky-300 capitalize">
                        {scene.ballEval.phase}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] font-mono-tabular text-slate-400 flex items-center justify-between border-t border-slate-800 pt-2">
                  <span>{brand.youtubeHandle}</span>
                  <span>
                    {scene.activeFieldDesign.batterHand === 'right' ? 'RHB' : 'LHB'} Setup
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Stage Render: Quiz Broadcast Sequence */}
          {scene.activeStage === 'quiz' && scene.quizState && (
            <div className="relative w-full h-full flex flex-col justify-between p-7 bg-[#091224]">
              {scene.quizState.question.includeFieldOverlay && (
                <>
                  <div className="pointer-events-none absolute inset-0 opacity-20 flex items-center justify-center">
                    <CricketFieldSvg
                      fieldDesign={scene.activeFieldDesign}
                      ballProgress={1}
                      className="h-[88%] aspect-square"
                    />
                  </div>
                  <div className="pointer-events-none absolute inset-0 bg-[#070E1C]/55" />
                </>
              )}

              <div className="relative z-10 flex items-center justify-between gap-3 pb-3 border-b border-slate-700/70">
                <div className="text-xs font-mono-tabular text-slate-300">
                  Question {scene.quizState.questionNumber} / {scene.quizState.totalQuestions}
                  <span className="mx-1.5 text-slate-600">·</span>
                  <span style={{ color: brand.accentColor }}>
                    {scene.quizState.question.category}
                  </span>
                </div>
                <div
                  className="text-sm font-mono-tabular font-bold"
                  style={{ color: brand.accentColor }}
                >
                  {scene.quizState.phase === 'reveal' ||
                  scene.quizState.phase === 'explanation'
                    ? 'ANSWER REVEALED'
                    : `${scene.quizState.remainingSec}s`}
                </div>
              </div>

              <div className="relative z-10 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden my-2">
                <div
                  className={`h-full transition-none ${
                    scene.quizState.phase === 'reveal' ||
                    scene.quizState.phase === 'explanation'
                      ? 'bg-emerald-400'
                      : 'bg-[#D4AF37]'
                  }`}
                  style={{
                    width: `${
                      scene.quizState.phase === 'reveal' ||
                      scene.quizState.phase === 'explanation'
                        ? 100
                        : Math.round((1 - scene.quizState.countdownProgress) * 100)
                    }%`,
                  }}
                />
              </div>

              <div
                className={`relative z-10 flex-1 flex flex-col justify-center ${
                  isPortrait ? 'gap-3' : 'gap-4 px-4'
                }`}
              >
                <h2
                  className={`font-display font-bold text-slate-100 leading-snug ${
                    isPortrait ? 'text-sm' : 'text-lg'
                  }`}
                >
                  {scene.quizState.question.prompt ||
                    `Question ${scene.quizState.questionNumber}`}
                </h2>

                <div
                  className={`grid gap-2.5 ${
                    isPortrait ? 'grid-cols-1' : 'grid-cols-2'
                  }`}
                >
                  {([0, 1, 2, 3] as const).map((idx) => {
                    const isReveal =
                      scene.quizState?.phase === 'reveal' ||
                      scene.quizState?.phase === 'explanation';
                    const isCorrect =
                      scene.quizState?.question.correctIndex === idx;
                    return (
                      <div
                        key={idx}
                        className={`px-3.5 py-2.5 rounded-lg border flex items-center gap-2.5 ${
                          isReveal && isCorrect
                            ? 'bg-emerald-950/85 border-emerald-400 text-emerald-50'
                            : isReveal
                            ? 'bg-[#0E182D]/70 border-slate-800 text-slate-400'
                            : 'bg-[#111E38]/95 border-slate-700/80 text-slate-100'
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded flex items-center justify-center text-xs font-mono-tabular font-bold shrink-0 ${
                            isReveal && isCorrect
                              ? 'bg-emerald-400 text-[#06120D]'
                              : 'bg-[#080E1A] text-[#E5B94C]'
                          }`}
                        >
                          {OPTION_LETTERS[idx]}
                        </span>
                        <span className="text-xs font-medium leading-snug">
                          {scene.quizState?.question.options[idx] ||
                            `Option ${OPTION_LETTERS[idx]}`}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {(scene.quizState.phase === 'reveal' ||
                  scene.quizState.phase === 'explanation') &&
                  scene.quizState.question.explanation && (
                    <div className="p-3 rounded-lg bg-[#0E1B34]/95 border border-[#D4AF37]/40 text-xs text-slate-200 leading-relaxed">
                      {scene.quizState.question.explanation}
                    </div>
                  )}
              </div>

              <div className="relative z-10 flex items-center justify-between text-[11px] font-mono-tabular text-slate-400 pt-2 border-t border-slate-800/80">
                <span>{activeProject.settings.seriesName}</span>
                <span>{brand.youtubeHandle}</span>
              </div>
            </div>
          )}

          {/* Active Broadcast Graphic Overlays */}
          {scene.activeGraphics.map((g) => (
            <div
              key={g.id}
              className="pointer-events-none absolute z-20 px-3 py-1.5 rounded-md border bg-[#0A1324]/90 shadow-md max-w-[60%]"
              style={{
                left: `${g.position.x}%`,
                top: `${g.position.y}%`,
                transform: 'translate(-10%, -50%)',
                borderColor: g.accentColor,
              }}
            >
              <div className="flex items-center justify-between gap-3 text-[10px] font-mono-tabular">
                <span style={{ color: g.accentColor }} className="font-bold">
                  {g.teamName}
                </span>
                <span className="text-white font-bold">{g.valueText}</span>
              </div>
              <div className="text-[11px] font-bold text-slate-100 truncate">{g.title}</div>
            </div>
          ))}

          {/* Active Burned-In Caption Overlay */}
          {captionSettings.enabled && scene.activeCaption && (
            <div
              data-testid="preview-caption-overlay"
              className={`pointer-events-none absolute left-1/2 -translate-x-1/2 z-25 px-4 max-w-[88%] text-center ${
                isPortrait ? 'bottom-16' : 'bottom-9'
              }`}
            >
              <div
                className={`inline-block px-3.5 py-1.5 rounded-lg leading-snug ${
                  captionSettings.showBackground
                    ? captionSettings.style === 'bold-shorts'
                      ? 'bg-[#080E1A]/95 border border-[#D4AF37]/40'
                      : captionSettings.style === 'broadcast'
                      ? 'bg-[#080E1A]/85 border border-[#D4AF37]/50'
                      : 'bg-[#080E1A]/75'
                    : ''
                }`}
                style={{
                  fontSize: `${Math.max(12, Math.round(captionSettings.fontSize * (isPortrait ? 0.52 : 0.56)))}px`,
                  fontWeight: captionSettings.style === 'bold-shorts' ? 800 : 700,
                  color: captionSettings.style === 'bold-shorts' ? '#FACC15' : '#F8FAFC',
                  textShadow: captionSettings.textOutline
                    ? '0 1px 4px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,0.9)'
                    : undefined,
                }}
              >
                {scene.activeCaption}
              </div>
            </div>
          )}

          {/* Deterministic Clip Transition Overlay */}
          {scene.activeTransition && scene.activeTransition.type !== 'cut' && (() => {
            const p = Math.max(0, Math.min(1, scene.activeTransition.progress));
            const inv = 1 - p;
            if (inv <= 0.01) return null;
            const tType = scene.activeTransition.type;
            if (tType === 'fade' || tType === 'crossfade') {
              return (
                <div
                  data-testid="preview-transition-overlay"
                  className="pointer-events-none absolute inset-0 z-30"
                  style={{ backgroundColor: brand.backgroundColor, opacity: inv * 0.88 }}
                />
              );
            }
            if (tType === 'slide-left') {
              return (
                <div
                  data-testid="preview-transition-overlay"
                  className="pointer-events-none absolute inset-y-0 left-0 z-30 bg-[#080E1A]"
                  style={{
                    width: `${Math.round(inv * 100)}%`,
                    borderRight: `4px solid ${brand.accentColor}`,
                  }}
                />
              );
            }
            if (tType === 'slide-right') {
              return (
                <div
                  data-testid="preview-transition-overlay"
                  className="pointer-events-none absolute inset-y-0 right-0 z-30 bg-[#080E1A]"
                  style={{
                    width: `${Math.round(inv * 100)}%`,
                    borderLeft: `4px solid ${brand.accentColor}`,
                  }}
                />
              );
            }
            if (tType === 'zoom') {
              return (
                <div
                  data-testid="preview-transition-overlay"
                  className="pointer-events-none absolute inset-3 z-30 rounded-lg"
                  style={{
                    border: `${Math.max(4, Math.round(24 * inv))}px solid ${brand.accentColor}`,
                    opacity: inv * 0.7,
                  }}
                />
              );
            }
            return (
              <div
                data-testid="preview-transition-overlay"
                className="pointer-events-none absolute inset-y-0 z-30"
                style={{
                  left: `${Math.round(p * 100)}%`,
                  width: '8%',
                  backgroundColor: brand.accentColor,
                  opacity: 0.8,
                  transform: 'skewX(-12deg)',
                }}
              />
            );
          })()}
        </div>
      </div>

      {/* Deterministic Transport & Timeline Scrubber */}
      <div className="px-5 py-3.5 border-t border-slate-800/80 bg-[#0C1426] space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={togglePlay}
              className="px-4 py-1.5 rounded-md bg-[#D4AF37] hover:bg-[#E2BE48] text-[#080E1A] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Play</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => stepScene(-1)}
              aria-label="Previous scene"
              title="Previous scene"
              className="p-1.5 rounded-md bg-[#131E38] hover:bg-[#1B2A4D] border border-slate-700/80 text-slate-200"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => stepFrame(-1)}
              aria-label="Step back one frame"
              className="p-1.5 rounded-md bg-[#131E38] hover:bg-[#1B2A4D] border border-slate-700/80 text-slate-200"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => stepFrame(1)}
              aria-label="Step forward one frame"
              className="p-1.5 rounded-md bg-[#131E38] hover:bg-[#1B2A4D] border border-slate-700/80 text-slate-200"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => stepScene(1)}
              aria-label="Next scene"
              title="Next scene"
              className="p-1.5 rounded-md bg-[#131E38] hover:bg-[#1B2A4D] border border-slate-700/80 text-slate-200"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => {
                setIsPlaying(false);
                setCurrentTimeSec(0);
              }}
              aria-label="Rewind to start"
              className="p-1.5 rounded-md bg-[#131E38] hover:bg-[#1B2A4D] border border-slate-700/80 text-slate-200"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-[#080E1A] p-0.5 rounded border border-slate-800">
              {PLAYBACK_SPEEDS.map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`px-2 py-1 rounded text-[11px] font-mono-tabular ${
                    playbackSpeed === spd
                      ? 'bg-[#172442] text-[#F4D57A]'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            <div
              data-testid="preview-timecode"
              className="text-xs font-mono-tabular text-slate-200 bg-[#080E1A] px-3 py-1.5 rounded border border-slate-800 flex items-center gap-2"
            >
              <span>
                {formatTimecode(currentTimeSec, fps)} / {formatTimecode(totalDurationSec, fps)}
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-[#E5B94C]">F{currentFrame}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="preview-timeline-scrub" className="sr-only">
            Timeline Scrubber
          </label>
          <input
            id="preview-timeline-scrub"
            type="range"
            min={0}
            max={Math.max(1, Math.round(totalDurationSec * 100))}
            value={Math.round(currentTimeSec * 100)}
            onChange={(e) => {
              setIsPlaying(false);
              setCurrentTimeSec(Number(e.target.value) / 100);
            }}
            className="w-full accent-[#D4AF37]"
          />
        </div>
      </div>
    </div>
  );
}
