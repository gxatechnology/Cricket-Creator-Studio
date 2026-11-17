import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Film,
  Image as ImageIcon,
  Layers,
  ListChecks,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Subtitles,
  Trash2,
  Volume2,
  XCircle,
} from 'lucide-react';
import { useStudio } from '../../context/StudioContext';
import {
  QUALITY_PRESETS,
  RESOLUTION_PRESETS,
  buildRenderSettings,
  estimateExportFileSizeBytes,
  formatBytes,
  type OutputContainerFormat,
  type OutputResolutionPresetId,
  type QualityPresetId,
  type RenderSettings,
  type RenderStage,
} from '../../render/rendererTypes';
import {
  evaluateRenderGate,
  renderThumbnailBlobFromProject,
} from '../../render/exportController';
import { computeSequenceDuration, formatTimecode } from '../../engine/timeline';
import { generateSrtFromProject } from '../../engine/captions';
import {
  buildFullDeliveryZip,
  buildProjectPackageZip,
  buildYouTubeDeliveryFiles,
} from '../../engine/packaging';

const STAGE_STEPS: { id: RenderStage; label: string }[] = [
  { id: 'preparing-assets', label: 'Assets' },
  { id: 'processing-audio', label: 'Audio Mix' },
  { id: 'rendering-frames', label: 'Frames' },
  { id: 'encoding-video', label: 'Encode' },
  { id: 'finalizing-file', label: 'Mux File' },
];

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function slugifyTitle(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'cricket-episode'
  );
}

export function ExportCenterModule() {
  const {
    activeProject,
    updateActiveProject,
    workspace,
    renderQueue,
    isRendering,
    activeRenderProgress,
    latestRenderResult,
    renderError,
    lastPreflight,
    executeSingleRender,
    enqueueExportJob,
    enqueueAllFormats,
    startNextQueuedJob,
    cancelActiveRender,
    retryQueueJob,
    removeQueueJob,
    refreshPreflight,
    loadRendererQaProject,
    loadClientDemoProject,
    clearRenderError,
    setActiveModule,
    recoverableJob,
    resumeRecoveredJob,
    discardRecoveredJob,
  } = useStudio();

  const defaultResId: OutputResolutionPresetId =
    activeProject.settings.aspectRatio === '9:16'
      ? 'shorts-1080x1920'
      : activeProject.settings.aspectRatio === '1:1'
      ? 'square-1080'
      : 'youtube-1080p';

  const defaultQualityId: QualityPresetId =
    activeProject.settings.aspectRatio === '9:16' ? 'shorts-hq' : 'standard';

  const [settings, setSettings] = useState<RenderSettings>(() =>
    buildRenderSettings(
      defaultResId,
      defaultQualityId,
      activeProject.settings.fps === 60 ? 60 : 30,
      'mp4',
      slugifyTitle(activeProject.title)
    )
  );
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [deliveryBusy, setDeliveryBusy] = useState<string | null>(null);
  const [deliveryNote, setDeliveryNote] = useState<string | null>(null);

  // Sync output base filename and aspect-ratio default when switching projects
  useEffect(() => {
    const nextResId: OutputResolutionPresetId =
      activeProject.settings.aspectRatio === '9:16'
        ? 'shorts-1080x1920'
        : activeProject.settings.aspectRatio === '1:1'
        ? 'square-1080'
        : 'youtube-1080p';
    const nextQualId: QualityPresetId =
      activeProject.settings.aspectRatio === '9:16' ? 'shorts-hq' : 'standard';

    setSettings((prev) => ({
      ...buildRenderSettings(
        nextResId,
        nextQualId,
        activeProject.settings.fps === 60 ? 60 : 30,
        prev.format,
        slugifyTitle(activeProject.title)
      ),
      audioEnabled: prev.audioEnabled,
      normalizeAudio: prev.normalizeAudio,
    }));
  }, [activeProject.id, activeProject.title, activeProject.settings.aspectRatio, activeProject.settings.fps]);

  useEffect(() => {
    void refreshPreflight();
  }, [activeProject.id, refreshPreflight]);

  const gate = useMemo(() => evaluateRenderGate(activeProject), [activeProject]);
  const durationSec = useMemo(
    () => Math.max(1, computeSequenceDuration(activeProject, 'timeline')),
    [activeProject]
  );
  const estimatedBytes = useMemo(
    () => estimateExportFileSizeBytes(durationSec, settings),
    [durationSec, settings]
  );

  const selectResolutionPreset = (presetId: OutputResolutionPresetId) => {
    const meta = RESOLUTION_PRESETS.find((r) => r.id === presetId) ?? RESOLUTION_PRESETS[0];
    setSettings((prev) => ({
      ...prev,
      outputPresetId: meta.id,
      aspectRatio: meta.aspectRatio,
      width: meta.width,
      height: meta.height,
    }));
  };

  const selectQualityPreset = (qualityId: QualityPresetId) => {
    const qual = QUALITY_PRESETS.find((q) => q.id === qualityId) ?? QUALITY_PRESETS[1];
    setSettings((prev) => ({
      ...prev,
      qualityPresetId: qual.id,
      videoBitrateBps: qual.videoBitrateBps,
      audioBitrateBps: qual.audioBitrateBps,
    }));
  };

  const handleExportVideo = async () => {
    setDeliveryNote(null);
    await executeSingleRender(settings);
  };

  const handleExportPreview = async () => {
    setDeliveryNote(null);
    const previewDims =
      settings.aspectRatio === '9:16'
        ? { width: 480, height: 854 }
        : settings.aspectRatio === '1:1'
        ? { width: 640, height: 640 }
        : { width: 854, height: 480 };
    await executeSingleRender({
      ...settings,
      outputPresetId: 'preview-480p',
      qualityPresetId: 'draft',
      width: previewDims.width,
      height: previewDims.height,
      videoBitrateBps: 2_000_000,
      audioBitrateBps: 96_000,
      outputName: `${slugifyTitle(activeProject.title)}-preview`,
    });
  };

  const handleShortsQuickSwitch = () => {
    updateActiveProject((prev) => ({
      ...prev,
      settings: { ...prev.settings, aspectRatio: '9:16' },
    }));
    selectResolutionPreset('shorts-1080x1920');
    selectQualityPreset('shorts-hq');
    setActiveModule('preview');
  };

  const handleDownloadSrt = () => {
    const srt = generateSrtFromProject(activeProject);
    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
    triggerBlobDownload(blob, `${slugifyTitle(activeProject.title)}.srt`);
    setDeliveryNote('Exported subtitles (.srt) from Voiceover Prep timings.');
  };

  const handleDownloadThumbnail = async () => {
    setDeliveryBusy('thumbnail');
    try {
      const thumbBlob = await renderThumbnailBlobFromProject(activeProject);
      if (thumbBlob) {
        triggerBlobDownload(thumbBlob, `${slugifyTitle(activeProject.title)}-thumbnail.png`);
        setDeliveryNote('Exported 1280×720 broadcast thumbnail (.png).');
      }
    } finally {
      setDeliveryBusy(null);
    }
  };

  const handleDownloadYouTubeTxt = () => {
    const files = buildYouTubeDeliveryFiles(activeProject);
    const combined = Object.entries(files)
      .map(([name, content]) => `=== ${name.toUpperCase()} ===\n${content}\n`)
      .join('\n');
    const blob = new Blob([combined], { type: 'text/plain;charset=utf-8' });
    triggerBlobDownload(blob, `${slugifyTitle(activeProject.title)}-youtube-pack.txt`);
    setDeliveryNote('Exported YouTube title, description, tags, hashtags & chapters (.txt).');
  };

  const handleDownloadProjectZip = async () => {
    setDeliveryBusy('project-zip');
    try {
      const pkg = await buildProjectPackageZip(activeProject);
      triggerBlobDownload(pkg.blob, pkg.filename);
      setDeliveryNote(`Exported project archive (${pkg.filename}).`);
    } finally {
      setDeliveryBusy(null);
    }
  };

  const handleExportAllBundle = async () => {
    if (!latestRenderResult) return;
    setDeliveryBusy('export-all');
    try {
      const thumbBlob = await renderThumbnailBlobFromProject(activeProject);
      const bundle = await buildFullDeliveryZip(activeProject, {
        videoBlob: latestRenderResult.blob,
        videoFilename: latestRenderResult.filename,
        thumbnailBlob: thumbBlob ?? undefined,
      });
      triggerBlobDownload(bundle.blob, bundle.filename);
      setDeliveryNote(
        `Exported full delivery bundle (${bundle.filename}) including video, thumbnail, .srt & YouTube pack.`
      );
    } finally {
      setDeliveryBusy(null);
    }
  };

  const queuedCount = renderQueue.filter((j) => j.status === 'queued').length;
  const exportHistory = workspace.exportHistory ?? [];

  return (
    <div className="p-5 max-w-[1440px] mx-auto space-y-5">
      {/* Top Broadcast Export Header & Summary Cards */}
      <section className="rounded-xl bg-[#0C1426] border border-slate-800/80 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <Film className="w-5 h-5 text-[#D4AF37]" />
              <h2 className="font-display font-bold text-lg text-slate-100">
                Export & Render Center
              </h2>
              <span
                data-testid="renderer-gate-badge"
                className={`px-2.5 py-0.5 rounded text-[11px] font-mono-tabular font-bold border ${
                  gate.allowed
                    ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                    : 'bg-red-950/70 border-red-500/40 text-red-300'
                }`}
              >
                {gate.statusLabel}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Deterministic WebCodecs frame-by-frame video encoder driven directly by your active project timeline.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="load-client-demo-btn"
              onClick={() => loadClientDemoProject(settings.aspectRatio)}
              className="px-3 py-1.5 rounded-lg bg-[#D4AF37] hover:bg-[#E2BE48] text-xs font-bold text-[#080E1A] flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Load 60s Client Demo</span>
            </button>
            <button
              type="button"
              data-testid="load-qa-scene-btn"
              onClick={() => loadRendererQaProject('16:9')}
              className="px-3 py-1.5 rounded-lg bg-[#131E38] hover:bg-[#1B2B4F] border border-[#D4AF37]/40 text-xs font-semibold text-[#F4D57A] flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Load QA Scene (24s)</span>
            </button>
            <button
              type="button"
              onClick={handleShortsQuickSwitch}
              className="px-3 py-1.5 rounded-lg bg-[#131E38] hover:bg-[#1B2B4F] border border-slate-700/80 text-xs font-medium text-slate-200 flex items-center gap-1.5"
            >
              <Smartphone className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Shorts Preview</span>
            </button>
            <button
              type="button"
              onClick={() => void refreshPreflight()}
              className="px-3 py-1.5 rounded-lg bg-[#131E38] hover:bg-[#1B2B4F] border border-slate-700/80 text-xs font-medium text-slate-200 flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
              <span>Check Project</span>
            </button>
          </div>
        </div>

        {/* 8-Point Export Telemetry Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2.5">
          <div className="p-2.5 rounded-lg bg-[#080E1A] border border-slate-800/90">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Project</div>
            <div className="text-xs font-semibold text-slate-100 truncate mt-0.5" title={activeProject.title}>
              {activeProject.title}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-[#080E1A] border border-slate-800/90">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Output Type</div>
            <div className="text-xs font-semibold text-slate-100 capitalize mt-0.5">
              {activeProject.production.contentType.replace(/-/g, ' ')}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-[#080E1A] border border-slate-800/90">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Aspect Ratio</div>
            <div className="text-xs font-mono-tabular font-bold text-[#E5B94C] mt-0.5">
              {settings.aspectRatio}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-[#080E1A] border border-slate-800/90">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Resolution</div>
            <div className="text-xs font-mono-tabular font-bold text-slate-100 mt-0.5">
              {settings.width}×{settings.height}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-[#080E1A] border border-slate-800/90">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Frame Rate</div>
            <div className="text-xs font-mono-tabular font-bold text-slate-100 mt-0.5">
              {settings.fps} FPS
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-[#080E1A] border border-slate-800/90">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Audio Mix</div>
            <div className="text-xs font-semibold text-slate-100 mt-0.5">
              {settings.audioEnabled
                ? settings.normalizeAudio
                  ? 'Stereo · Norm'
                  : 'Stereo · Raw'
                : 'Muted'}
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-[#080E1A] border border-slate-800/90">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Est. Duration</div>
            <div className="text-xs font-mono-tabular font-bold text-slate-100 mt-0.5">
              {formatTimecode(durationSec, settings.fps)} ({durationSec.toFixed(1)}s)
            </div>
          </div>
          <div className="p-2.5 rounded-lg bg-[#080E1A] border border-slate-800/90">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Est. Size</div>
            <div className="text-xs font-mono-tabular font-bold text-sky-300 mt-0.5">
              {formatBytes(estimatedBytes)}
            </div>
          </div>
        </div>
      </section>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* LEFT: Export Settings & Primary Controls */}
        <div className="xl:col-span-5 space-y-4">
          <section className="rounded-xl bg-[#0C1426] border border-slate-800/80 p-4 space-y-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2.5">
                1. Output Format & Resolution
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {RESOLUTION_PRESETS.map((res) => {
                  const selected = settings.outputPresetId === res.id;
                  return (
                    <button
                      key={res.id}
                      type="button"
                      data-testid={`res-preset-${res.id}`}
                      onClick={() => selectResolutionPreset(res.id)}
                      className={`p-2.5 rounded-lg border text-left transition-colors ${
                        selected
                          ? 'bg-[#172544] border-[#D4AF37] text-slate-100'
                          : 'bg-[#080E1A] border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold">{res.label}</span>
                        <span className="text-[10px] font-mono-tabular text-[#E5B94C]">
                          {res.aspectRatio}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono-tabular text-slate-400 mt-0.5">
                        {res.width}×{res.height}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2.5">
                2. Render Quality Preset
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {QUALITY_PRESETS.map((q) => {
                  const selected = settings.qualityPresetId === q.id;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => selectQualityPreset(q.id)}
                      className={`p-2.5 rounded-lg border text-left transition-colors ${
                        selected
                          ? 'bg-[#172544] border-[#D4AF37] text-slate-100'
                          : 'bg-[#080E1A] border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold">{q.label}</span>
                        <span className="text-[10px] font-mono-tabular text-sky-300">
                          {q.badge}
                        </span>
                      </div>
                      <div className="text-[10.5px] text-slate-400 mt-0.5">{q.summary}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <div className="text-xs font-semibold text-slate-300 mb-1.5">Frame Rate</div>
                <div className="flex gap-1.5">
                  {([30, 60] as const).map((fpsOpt) => (
                    <button
                      key={fpsOpt}
                      type="button"
                      onClick={() => setSettings((prev) => ({ ...prev, fps: fpsOpt }))}
                      className={`flex-1 py-2 rounded-lg border text-xs font-mono-tabular font-bold ${
                        settings.fps === fpsOpt
                          ? 'bg-[#D4AF37] border-[#D4AF37] text-[#080E1A]'
                          : 'bg-[#080E1A] border-slate-800 text-slate-300'
                      }`}
                    >
                      {fpsOpt} FPS
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-300 mb-1.5">Audio Bus</div>
                <div className="flex flex-col gap-1.5">
                  <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.audioEnabled}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, audioEnabled: e.target.checked }))
                      }
                      className="accent-[#D4AF37]"
                    />
                    <Volume2 className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>Include Audio</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!settings.audioEnabled}
                      checked={settings.normalizeAudio}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, normalizeAudio: e.target.checked }))
                      }
                      className="accent-[#D4AF37]"
                    />
                    <span>Normalize (-1 dBFS)</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Collapsible Advanced Settings */}
            <div className="border-t border-slate-800/80 pt-3">
              <button
                type="button"
                onClick={() => setAdvancedOpen((o) => !o)}
                className="w-full flex items-center justify-between text-xs font-semibold text-slate-300 hover:text-slate-100"
              >
                <span>Advanced Encoding Settings</span>
                {advancedOpen ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {advancedOpen && (
                <div className="mt-3 space-y-3 bg-[#080E1A] p-3 rounded-lg border border-slate-800/80">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Container Format
                      </label>
                      <select
                        value={settings.format}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            format: e.target.value as OutputContainerFormat,
                          }))
                        }
                        className="w-full px-2.5 py-1.5 rounded bg-[#0C1426] border border-slate-700 text-xs text-slate-100"
                      >
                        <option value="mp4">MP4 (H.264)</option>
                        <option value="webm">WebM (VP9)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Output File Name
                      </label>
                      <input
                        type="text"
                        value={settings.outputName}
                        onChange={(e) =>
                          setSettings((prev) => ({ ...prev, outputName: e.target.value }))
                        }
                        className="w-full px-2.5 py-1.5 rounded bg-[#0C1426] border border-slate-700 text-xs text-slate-100 font-mono-tabular"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Video Bitrate (kbps)
                      </label>
                      <input
                        type="number"
                        min={500}
                        max={30000}
                        step={500}
                        value={Math.round(settings.videoBitrateBps / 1000)}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            videoBitrateBps: Math.max(300, Number(e.target.value) || 2500) * 1000,
                          }))
                        }
                        className="w-full px-2.5 py-1.5 rounded bg-[#0C1426] border border-slate-700 text-xs text-slate-100 font-mono-tabular"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Audio Bitrate (kbps)
                      </label>
                      <input
                        type="number"
                        min={64}
                        max={320}
                        step={32}
                        value={Math.round(settings.audioBitrateBps / 1000)}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            audioBitrateBps: Math.max(48, Number(e.target.value) || 128) * 1000,
                          }))
                        }
                        className="w-full px-2.5 py-1.5 rounded bg-[#0C1426] border border-slate-700 text-xs text-slate-100 font-mono-tabular"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Primary Render Action Buttons */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                data-testid="export-video-btn"
                disabled={!gate.allowed || isRendering}
                onClick={() => void handleExportVideo()}
                className="w-full py-3 px-4 rounded-lg bg-[#D4AF37] hover:bg-[#E2BE48] disabled:opacity-45 disabled:cursor-not-allowed text-[#080E1A] text-sm font-bold flex items-center justify-center gap-2 transition-colors"
              >
                {isRendering ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Rendering Video...</span>
                  </>
                ) : (
                  <>
                    <Film className="w-4 h-4" />
                    <span>EXPORT VIDEO ({settings.width}×{settings.height})</span>
                  </>
                )}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  data-testid="export-preview-btn"
                  disabled={!gate.allowed || isRendering}
                  onClick={() => void handleExportPreview()}
                  className="py-2 px-3 rounded-lg bg-[#131E38] hover:bg-[#1B2B4F] disabled:opacity-45 border border-slate-700/80 text-xs font-semibold text-slate-100 flex items-center justify-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>EXPORT PREVIEW</span>
                </button>
                <button
                  type="button"
                  onClick={() => enqueueExportJob(settings)}
                  className="py-2 px-3 rounded-lg bg-[#131E38] hover:bg-[#1B2B4F] border border-slate-700/80 text-xs font-semibold text-slate-100 flex items-center justify-center gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5 text-sky-400" />
                  <span>Add to Queue</span>
                </button>
              </div>
            </div>
          </section>

          {/* Readiness Gate & Asset Preflight */}
          <section className="rounded-xl bg-[#0C1426] border border-slate-800/80 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-[#D4AF37]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Render Readiness & Asset Preflight
                </h3>
              </div>
              <span className="text-xs font-mono-tabular font-bold text-[#E5B94C]">
                {gate.scorePercent}% Ready
              </span>
            </div>

            {gate.blockers.length > 0 && (
              <div className="space-y-1.5">
                {gate.blockers.map((b) => (
                  <div
                    key={b.id}
                    className="p-2.5 rounded-lg bg-red-950/40 border border-red-500/40 flex items-start gap-2 text-xs"
                  >
                    <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-red-200">{b.label}</div>
                      <div className="text-red-300/80 text-[11px]">{b.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {gate.warnings.length > 0 && (
              <div className="space-y-1.5">
                {gate.warnings.slice(0, 3).map((w) => (
                  <div
                    key={w.id}
                    className="p-2 rounded-lg bg-amber-950/30 border border-amber-500/30 flex items-start gap-2 text-xs"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-amber-200/90 text-[11px]">
                      <span className="font-semibold">{w.label}:</span> {w.detail}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="p-2.5 rounded-lg bg-[#080E1A] border border-slate-800/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <CheckCircle2
                  className={`w-4 h-4 ${
                    lastPreflight?.allReady !== false ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                />
                <span>
                  IndexedDB Asset Preflight:{' '}
                  <strong className="font-mono-tabular text-slate-100">
                    {lastPreflight
                      ? `${lastPreflight.readyCount}/${lastPreflight.totalRequired} ready`
                      : 'Verified'}
                  </strong>
                </span>
              </div>
              <span className="text-[11px] font-mono-tabular text-slate-400">
                {activeProject.timelineClips.length} clips
              </span>
            </div>
          </section>
        </div>

        {/* RIGHT: Progress, Exported Player & Delivery, Queue & History */}
        <div className="xl:col-span-7 space-y-4">
          {/* Durable Checkpoint Recovery Banner */}
          {recoverableJob && !isRendering && (
            <div
              data-testid="recovery-checkpoint-banner"
              className="rounded-xl bg-[#141D33] border border-[#D4AF37]/55 p-4 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="space-y-0.5">
                <div className="text-xs font-bold uppercase tracking-wider text-[#F4D57A] font-mono-tabular">
                  Recoverable Render Checkpoint ({recoverableJob.serverJob.status.toUpperCase()})
                </div>
                <div className="text-sm font-medium text-slate-100">
                  {recoverableJob.serverJob.projectTitle} ·{' '}
                  {recoverableJob.serverJob.verifiedSegments}/
                  {recoverableJob.serverJob.totalSegments} segments verified (
                  {recoverableJob.serverJob.progressPercent}%)
                </div>
                <div className="text-[11px] font-mono-tabular text-slate-400">
                  Job {recoverableJob.serverJob.jobId} ·{' '}
                  {recoverableJob.serverJob.resolution.width}×
                  {recoverableJob.serverJob.resolution.height} @{' '}
                  {recoverableJob.serverJob.fps} FPS
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="resume-render-btn"
                  onClick={() => void resumeRecoveredJob()}
                  className="px-3.5 py-2 rounded-lg bg-[#D4AF37] hover:bg-[#E2BE48] text-[#080E1A] text-xs font-bold"
                >
                  Resume Render
                </button>
                <button
                  type="button"
                  data-testid="discard-checkpoint-btn"
                  onClick={() => void discardRecoveredJob()}
                  className="px-3 py-2 rounded-lg bg-[#080E1A] hover:bg-slate-900 border border-slate-700 text-xs font-medium text-slate-300"
                >
                  Discard
                </button>
              </div>
            </div>
          )}

          {/* Render Error Banner */}
          {renderError && (
            <div
              data-testid="render-error-banner"
              className="rounded-xl bg-red-950/50 border border-red-500/50 p-4 flex items-start justify-between gap-3"
            >
              <div className="flex items-start gap-2.5">
                <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-red-200 uppercase font-mono-tabular">
                    {renderError.code}
                  </div>
                  <div className="text-sm font-medium text-red-100 mt-0.5">
                    {renderError.message}
                  </div>
                  {renderError.detail && (
                    <div className="text-xs text-red-300/80 mt-1">{renderError.detail}</div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={clearRenderError}
                className="px-2.5 py-1 rounded bg-red-900/60 hover:bg-red-800/70 text-xs text-red-100"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Active Render Progress Monitor */}
          {(isRendering || activeRenderProgress) && (
            <section
              data-testid="render-progress-panel"
              className="rounded-xl bg-[#0C1426] border border-[#D4AF37]/40 p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-[#F4D57A] uppercase tracking-wider">
                    {activeRenderProgress?.stageLabel || 'Initializing Render Pipeline'}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono-tabular mt-0.5">
                    Scene: {activeRenderProgress?.currentSceneName || 'Preparing'} · Frame{' '}
                    {activeRenderProgress?.currentFrame ?? 0}/
                    {activeRenderProgress?.totalFrames ?? 0}
                    {activeRenderProgress?.encodingFps
                      ? ` · ${activeRenderProgress.encodingFps} enc fps`
                      : ''}
                    {activeRenderProgress?.segmentLabel
                      ? ` · ${activeRenderProgress.segmentLabel}`
                      : ''}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right font-mono-tabular">
                    <div className="text-base font-bold text-slate-100">
                      {activeRenderProgress?.percent ?? 0}%
                    </div>
                    {activeRenderProgress?.estimatedRemainingMs != null && isRendering && (
                      <div className="text-[10px] text-slate-400">
                        ETA {Math.ceil(activeRenderProgress.estimatedRemainingMs / 1000)}s
                      </div>
                    )}
                  </div>
                  {isRendering && (
                    <button
                      type="button"
                      data-testid="cancel-render-btn"
                      onClick={cancelActiveRender}
                      className="px-3 py-1.5 rounded-lg bg-red-950/70 hover:bg-red-900/80 border border-red-500/40 text-xs font-semibold text-red-200"
                    >
                      Cancel Render
                    </button>
                  )}
                </div>
              </div>

              <div className="h-2.5 w-full rounded-full bg-[#080E1A] overflow-hidden border border-slate-800">
                <div
                  data-testid="render-progress-bar"
                  className="h-full bg-gradient-to-r from-[#D4AF37] to-emerald-400 transition-all duration-150"
                  style={{ width: `${activeRenderProgress?.percent ?? 0}%` }}
                />
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {STAGE_STEPS.map((st, idx) => {
                  const activeIdx = STAGE_STEPS.findIndex(
                    (x) => x.id === activeRenderProgress?.stage
                  );
                  const done = activeIdx > idx || activeRenderProgress?.percent === 100;
                  const current = activeIdx === idx && isRendering;
                  return (
                    <div
                      key={st.id}
                      className={`px-2 py-1 rounded text-center text-[10px] font-mono-tabular border ${
                        done
                          ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                          : current
                          ? 'bg-[#1A2B4C] border-[#D4AF37]/60 text-[#F4D57A]'
                          : 'bg-[#080E1A] border-slate-800 text-slate-500'
                      }`}
                    >
                      {st.label}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Completed Output Video Player & Delivery Pack */}
          {latestRenderResult && (
            <section
              data-testid="completed-export-panel"
              data-render-metrics={JSON.stringify({
                filename: latestRenderResult.filename,
                width: latestRenderResult.width,
                height: latestRenderResult.height,
                fps: latestRenderResult.fps,
                durationSec: latestRenderResult.durationSec,
                totalFrames: latestRenderResult.totalFrames ?? Math.round(latestRenderResult.durationSec * latestRenderResult.fps),
                fileSizeBytes: latestRenderResult.fileSizeBytes,
                hasAudio: latestRenderResult.hasAudio,
                audioWarnings: latestRenderResult.audioWarnings,
                renderDurationMs: latestRenderResult.renderDurationMs,
                averageEncodingFps: latestRenderResult.averageEncodingFps ?? null,
                peakMemoryBytes: latestRenderResult.peakMemoryBytes ?? null,
                segmentCount: latestRenderResult.segmentCount ?? 1,
                segmentRetries: latestRenderResult.segmentRetries ?? 0,
                segmentTimings: latestRenderResult.segmentTimings ?? [],
                pipelineMode: latestRenderResult.pipelineMode ?? null,
                videoCodec: latestRenderResult.videoCodec ?? null,
                audioCodec: latestRenderResult.audioCodec ?? null,
              })}
              className="rounded-xl bg-[#0C1426] border border-emerald-500/35 p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-display font-bold text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Rendered Master Ready: {latestRenderResult.filename}</span>
                  </h3>
                  <div className="text-[11px] font-mono-tabular text-slate-400 mt-0.5">
                    {latestRenderResult.width}×{latestRenderResult.height} ·{' '}
                    {latestRenderResult.fps} FPS · {latestRenderResult.durationSec.toFixed(1)}s ·{' '}
                    {formatBytes(latestRenderResult.fileSizeBytes)} ·{' '}
                    {latestRenderResult.codecLabel} ·{' '}
                    {(latestRenderResult.renderDurationMs / 1000).toFixed(1)}s render time
                    {latestRenderResult.averageEncodingFps
                      ? ` (${latestRenderResult.averageEncodingFps} avg fps)`
                      : ''}
                    {latestRenderResult.segmentCount && latestRenderResult.segmentCount > 1
                      ? ` · ${latestRenderResult.segmentCount} segs`
                      : ''}
                    {latestRenderResult.peakMemoryBytes
                      ? ` · Peak JS Heap ${formatBytes(latestRenderResult.peakMemoryBytes)}`
                      : ''}
                  </div>
                </div>
                <a
                  data-testid="download-video-link"
                  href={latestRenderResult.objectUrl}
                  download={latestRenderResult.filename}
                  className="px-3.5 py-2 rounded-lg bg-[#D4AF37] hover:bg-[#E2BE48] text-[#080E1A] text-xs font-bold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .{latestRenderResult.container}</span>
                </a>
              </div>

              <div className="rounded-lg bg-black border border-slate-800 overflow-hidden flex items-center justify-center max-h-[340px]">
                <video
                  key={latestRenderResult.objectUrl}
                  data-testid="exported-video-player"
                  controls
                  playsInline
                  preload="metadata"
                  src={latestRenderResult.objectUrl}
                  className="max-h-[336px] w-auto max-w-full"
                />
              </div>

              {latestRenderResult.audioWarnings.length > 0 && (
                <div className="p-2.5 rounded-lg bg-amber-950/35 border border-amber-500/30 text-[11px] text-amber-200">
                  Audio notice: {latestRenderResult.audioWarnings.join(' · ')}
                </div>
              )}

              {/* Full Creator Delivery Bar */}
              <div className="pt-1 border-t border-slate-800/80 space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Creator Delivery Package
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-testid="export-all-btn"
                    disabled={deliveryBusy !== null}
                    onClick={() => void handleExportAllBundle()}
                    className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#06120D] text-xs font-bold flex items-center gap-1.5"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>
                      {deliveryBusy === 'export-all' ? 'Bundling ZIP...' : 'EXPORT ALL (.ZIP)'}
                    </span>
                  </button>
                  <button
                    type="button"
                    data-testid="export-srt-btn"
                    onClick={handleDownloadSrt}
                    className="px-3 py-2 rounded-lg bg-[#131E38] hover:bg-[#1B2B4F] border border-slate-700/80 text-xs font-medium text-slate-100 flex items-center gap-1.5"
                  >
                    <Subtitles className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>Export .SRT</span>
                  </button>
                  <button
                    type="button"
                    disabled={deliveryBusy !== null}
                    onClick={() => void handleDownloadThumbnail()}
                    className="px-3 py-2 rounded-lg bg-[#131E38] hover:bg-[#1B2B4F] border border-slate-700/80 text-xs font-medium text-slate-100 flex items-center gap-1.5"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                    <span>Thumbnail (.png)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadYouTubeTxt}
                    className="px-3 py-2 rounded-lg bg-[#131E38] hover:bg-[#1B2B4F] border border-slate-700/80 text-xs font-medium text-slate-100 flex items-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-400" />
                    <span>YouTube (.txt)</span>
                  </button>
                  <button
                    type="button"
                    disabled={deliveryBusy !== null}
                    onClick={() => void handleDownloadProjectZip()}
                    className="px-3 py-2 rounded-lg bg-[#131E38] hover:bg-[#1B2B4F] border border-slate-700/80 text-xs font-medium text-slate-100 flex items-center gap-1.5"
                  >
                    <Archive className="w-3.5 h-3.5 text-slate-300" />
                    <span>Project (.zip)</span>
                  </button>
                </div>
                {deliveryNote && (
                  <div className="text-xs text-emerald-300 font-medium">{deliveryNote}</div>
                )}
              </div>
            </section>
          )}

          {/* Render Queue */}
          <section className="rounded-xl bg-[#0C1426] border border-slate-800/80 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Batch Render Queue ({renderQueue.length})
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Queue Landscape, Shorts, and Square cuts sequentially from one deterministic project.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  data-testid="queue-16x9-btn"
                  onClick={() =>
                    enqueueExportJob(
                      buildRenderSettings(
                        'youtube-1080p',
                        'standard',
                        settings.fps,
                        settings.format,
                        `${slugifyTitle(activeProject.title)}-16x9`
                      ),
                      'Landscape 1920×1080 (16:9)'
                    )
                  }
                  className="px-2.5 py-1.5 rounded bg-[#080E1A] hover:bg-[#131E38] border border-slate-800 text-[11px] font-medium text-slate-200"
                >
                  + 16:9
                </button>
                <button
                  type="button"
                  data-testid="queue-9x16-btn"
                  onClick={() =>
                    enqueueExportJob(
                      buildRenderSettings(
                        'shorts-1080x1920',
                        'shorts-hq',
                        settings.fps,
                        settings.format,
                        `${slugifyTitle(activeProject.title)}-9x16`
                      ),
                      'Shorts 1080×1920 (9:16)'
                    )
                  }
                  className="px-2.5 py-1.5 rounded bg-[#080E1A] hover:bg-[#131E38] border border-slate-800 text-[11px] font-medium text-slate-200"
                >
                  + 9:16
                </button>
                <button
                  type="button"
                  onClick={() =>
                    enqueueExportJob(
                      buildRenderSettings(
                        'square-1080',
                        'standard',
                        settings.fps,
                        settings.format,
                        `${slugifyTitle(activeProject.title)}-1x1`
                      ),
                      'Square 1080×1080 (1:1)'
                    )
                  }
                  className="px-2.5 py-1.5 rounded bg-[#080E1A] hover:bg-[#131E38] border border-slate-800 text-[11px] font-medium text-slate-200"
                >
                  + 1:1
                </button>
                <button
                  type="button"
                  onClick={() => enqueueAllFormats(settings.fps, settings.format)}
                  className="px-2.5 py-1.5 rounded bg-[#131E38] hover:bg-[#1B2B4F] border border-[#D4AF37]/35 text-[11px] font-semibold text-[#F4D57A]"
                >
                  Queue All 3
                </button>
                <button
                  type="button"
                  data-testid="start-queue-btn"
                  disabled={queuedCount === 0 || isRendering || !gate.allowed}
                  onClick={() => void startNextQueuedJob()}
                  className="px-3 py-1.5 rounded bg-[#D4AF37] hover:bg-[#E2BE48] disabled:opacity-40 text-[#080E1A] text-[11px] font-bold flex items-center gap-1"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Start Queue ({queuedCount})</span>
                </button>
              </div>
            </div>

            {renderQueue.length === 0 ? (
              <div className="p-4 rounded-lg bg-[#080E1A] border border-slate-800/80 text-xs text-slate-400 text-center">
                No queued render jobs yet. Queue 16:9, 9:16, or all 3 formats for batch rendering.
              </div>
            ) : (
              <div className="space-y-2">
                {renderQueue.map((job) => (
                  <div
                    key={job.id}
                    data-testid={`queue-job-${job.id}`}
                    className="p-2.5 rounded-lg bg-[#080E1A] border border-slate-800 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-100 truncate">
                          {job.label}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono-tabular uppercase font-bold ${
                            job.status === 'completed'
                              ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/30'
                              : job.status === 'rendering'
                              ? 'bg-amber-950/70 text-amber-300 border border-amber-500/30'
                              : job.status === 'failed'
                              ? 'bg-red-950/70 text-red-300 border border-red-500/30'
                              : job.status === 'cancelled'
                              ? 'bg-slate-800 text-slate-300'
                              : 'bg-sky-950/70 text-sky-300 border border-sky-500/30'
                          }`}
                        >
                          {job.status}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono-tabular text-slate-400 mt-0.5">
                        {job.projectTitle} · {job.settings.width}×{job.settings.height} ·{' '}
                        {job.settings.fps}fps · {job.progressPercent}%
                        {job.result ? ` · ${formatBytes(job.result.fileSizeBytes)}` : ''}
                        {job.error ? ` · ${job.error.message}` : ''}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {job.result && (
                        <a
                          href={job.result.objectUrl}
                          download={job.result.filename}
                          className="px-2.5 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/40 text-[11px] font-semibold text-emerald-200 flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          <span>Save</span>
                        </a>
                      )}
                      {(job.status === 'failed' || job.status === 'cancelled') && (
                        <button
                          type="button"
                          onClick={() => retryQueueJob(job.id)}
                          className="px-2 py-1 rounded bg-[#131E38] hover:bg-[#1B2B4F] border border-slate-700 text-[11px] text-slate-200 flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Retry</span>
                        </button>
                      )}
                      {job.status !== 'rendering' && (
                        <button
                          type="button"
                          onClick={() => removeQueueJob(job.id)}
                          aria-label={`Remove ${job.label}`}
                          className="p-1.5 rounded bg-[#131E38] hover:bg-red-950/60 border border-slate-800 text-slate-400 hover:text-red-300"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Persistent Export History Table */}
          <section className="rounded-xl bg-[#0C1426] border border-slate-800/80 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Export History ({exportHistory.length})
              </h3>
              <span className="text-[11px] text-slate-400">Persisted in studio workspace</span>
            </div>

            {exportHistory.length === 0 ? (
              <div className="p-4 rounded-lg bg-[#080E1A] border border-slate-800/80 text-xs text-slate-400 text-center">
                No completed exports recorded yet. Render a video to log its resolution, format, size, and duration.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10.5px] uppercase tracking-wider text-slate-400">
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Project</th>
                      <th className="py-2 pr-3">Resolution</th>
                      <th className="py-2 pr-3">Aspect</th>
                      <th className="py-2 pr-3">Duration</th>
                      <th className="py-2 pr-3">Format</th>
                      <th className="py-2 pr-3">Size</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {exportHistory.map((entry) => (
                      <tr key={entry.id} className="text-slate-200">
                        <td className="py-2 pr-3 font-mono-tabular text-[11px] text-slate-400 whitespace-nowrap">
                          {new Date(entry.exportedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-2 pr-3 font-medium max-w-[180px] truncate">
                          {entry.projectTitle}
                        </td>
                        <td className="py-2 pr-3 font-mono-tabular whitespace-nowrap">
                          {entry.resolution}
                        </td>
                        <td className="py-2 pr-3 font-mono-tabular text-[#E5B94C] whitespace-nowrap">
                          {entry.aspectRatio}
                        </td>
                        <td className="py-2 pr-3 font-mono-tabular whitespace-nowrap">
                          {entry.durationSec.toFixed(1)}s
                        </td>
                        <td className="py-2 pr-3 font-mono-tabular uppercase whitespace-nowrap">
                          {entry.format}
                        </td>
                        <td className="py-2 pr-3 font-mono-tabular whitespace-nowrap">
                          {formatBytes(entry.fileSizeBytes)}
                        </td>
                        <td className="py-2 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono-tabular uppercase font-bold ${
                              entry.status === 'completed'
                                ? 'bg-emerald-950/70 text-emerald-300'
                                : entry.status === 'cancelled'
                                ? 'bg-slate-800 text-slate-300'
                                : 'bg-red-950/70 text-red-300'
                            }`}
                          >
                            {entry.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
