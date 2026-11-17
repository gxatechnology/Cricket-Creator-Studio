import type { AspectRatio } from '../types/studio';

export type OutputContainerFormat = 'mp4' | 'webm';

export type QualityPresetId = 'draft' | 'standard' | 'high' | 'shorts-hq';

export type OutputResolutionPresetId =
  | 'youtube-1080p'
  | 'shorts-1080x1920'
  | 'square-1080'
  | 'draft-720p'
  | 'preview-480p';

export type RenderStage =
  | 'preparing-assets'
  | 'processing-audio'
  | 'rendering-frames'
  | 'encoding-video'
  | 'finalizing-file';

export type RenderJobStatus =
  | 'queued'
  | 'rendering'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface RenderSettings {
  outputPresetId: OutputResolutionPresetId;
  qualityPresetId: QualityPresetId;
  aspectRatio: AspectRatio;
  width: number;
  height: number;
  fps: 30 | 60;
  format: OutputContainerFormat;
  videoBitrateBps: number;
  audioBitrateBps: number;
  audioEnabled: boolean;
  normalizeAudio: boolean;
  outputName: string;
}

export interface RenderJob {
  id: string;
  projectId: string;
  projectTitle: string;
  label: string;
  settings: RenderSettings;
  status: RenderJobStatus;
  createdAt: string;
  completedAt?: string;
  progressPercent: number;
  stage?: RenderStage;
  result?: RenderResult;
  error?: RenderError;
}

export type PipelineMode =
  | 'ffmpeg-aac-concat'
  | 'webcodecs-aac'
  | 'webcodecs-opus'
  | 'webcodecs-webm';

export interface RenderProgress {
  stage: RenderStage;
  stageLabel: string;
  percent: number;
  currentFrame: number;
  totalFrames: number;
  elapsedMs: number;
  estimatedRemainingMs: number | null;
  currentSceneName: string;
  encodingFps?: number;
  segmentLabel?: string;
}

export interface SegmentRenderTiming {
  segmentIndex: number;
  startFrame: number;
  endFrame: number;
  frameCount: number;
  startSec: number;
  endSec: number;
  renderDurationMs: number;
  encodingFps: number;
}

export interface RenderResult {
  blob: Blob;
  objectUrl: string;
  filename: string;
  mimeType: string;
  codecLabel: string;
  container: OutputContainerFormat;
  width: number;
  height: number;
  fps: 30 | 60;
  durationSec: number;
  totalFrames?: number;
  fileSizeBytes: number;
  hasAudio: boolean;
  audioWarnings: string[];
  renderDurationMs: number;
  averageEncodingFps?: number;
  peakMemoryBytes?: number;
  segmentCount?: number;
  segmentRetries?: number;
  segmentTimings?: SegmentRenderTiming[];
  pipelineMode?: PipelineMode;
  videoCodec?: string;
  audioCodec?: string;
}

export interface RenderError {
  code:
    | 'CANCELLED'
    | 'READINESS_BLOCKED'
    | 'ASSET_MISSING'
    | 'AUDIO_DECODE_FAILED'
    | 'UNSUPPORTED_CODEC'
    | 'OUT_OF_MEMORY'
    | 'WORKER_CRASHED'
    | 'ENCODE_FAILED';
  message: string;
  detail?: string;
}

export interface AssetPreflightEntry {
  id: string;
  name: string;
  kind: 'image' | 'audio' | 'logo';
  ready: boolean;
  reason?: string;
}

export interface AssetPreflightReport {
  totalRequired: number;
  readyCount: number;
  allReady: boolean;
  missingNames: string[];
  entries: AssetPreflightEntry[];
}

export interface TtsVoiceSettings {
  rate: number;
  pitch: number;
  lang: string;
  voiceName?: string;
}

export interface TtsSynthesisResult {
  supported: boolean;
  providerId: string;
  audioBlob?: Blob;
  estimatedDurationSec: number;
  note: string;
}

export interface TtsProvider {
  id: string;
  name: string;
  requiresCredentials: boolean;
  generateSpeech(
    text: string,
    voice: string,
    settings: TtsVoiceSettings
  ): Promise<TtsSynthesisResult>;
}

export interface ResolutionPresetMeta {
  id: OutputResolutionPresetId;
  label: string;
  aspectRatio: AspectRatio;
  width: number;
  height: number;
  description: string;
}

export const RESOLUTION_PRESETS: ResolutionPresetMeta[] = [
  {
    id: 'youtube-1080p',
    label: 'YouTube Landscape',
    aspectRatio: '16:9',
    width: 1920,
    height: 1080,
    description: 'Full HD 1920×1080 widescreen broadcast master',
  },
  {
    id: 'shorts-1080x1920',
    label: 'YouTube Shorts / Reels',
    aspectRatio: '9:16',
    width: 1080,
    height: 1920,
    description: 'Vertical 1080×1920 mobile-safe short format',
  },
  {
    id: 'square-1080',
    label: 'Square Social',
    aspectRatio: '1:1',
    width: 1080,
    height: 1080,
    description: 'Square 1080×1080 social feed cut',
  },
  {
    id: 'draft-720p',
    label: 'Preview Draft 720p',
    aspectRatio: '16:9',
    width: 1280,
    height: 720,
    description: 'Fast 720p HD render for client & timing review',
  },
  {
    id: 'preview-480p',
    label: 'Quick Draft 480p',
    aspectRatio: '16:9',
    width: 854,
    height: 480,
    description: 'Rapid 854×480 timing & animation verification',
  },
];

export interface QualityPresetMeta {
  id: QualityPresetId;
  label: string;
  badge: string;
  videoBitrateBps: number;
  audioBitrateBps: number;
  defaultResolutionId: OutputResolutionPresetId;
  summary: string;
}

export const QUALITY_PRESETS: QualityPresetMeta[] = [
  {
    id: 'draft',
    label: 'DRAFT',
    badge: '720p Fast',
    videoBitrateBps: 2_500_000,
    audioBitrateBps: 96_000,
    defaultResolutionId: 'draft-720p',
    summary: '720p · Lower bitrate · Fast render',
  },
  {
    id: 'standard',
    label: 'STANDARD',
    badge: '1080p Balanced',
    videoBitrateBps: 5_500_000,
    audioBitrateBps: 128_000,
    defaultResolutionId: 'youtube-1080p',
    summary: '1080p · Balanced broadcast bitrate',
  },
  {
    id: 'high',
    label: 'HIGH QUALITY',
    badge: '1080p Master',
    videoBitrateBps: 10_000_000,
    audioBitrateBps: 192_000,
    defaultResolutionId: 'youtube-1080p',
    summary: '1080p · Crisp high-bitrate master',
  },
  {
    id: 'shorts-hq',
    label: 'SHORTS HQ',
    badge: '1080×1920',
    videoBitrateBps: 7_500_000,
    audioBitrateBps: 160_000,
    defaultResolutionId: 'shorts-1080x1920',
    summary: '1080×1920 · Optimized vertical output',
  },
];

export function buildRenderSettings(
  outputPresetId: OutputResolutionPresetId,
  qualityPresetId: QualityPresetId,
  fps: 30 | 60 = 30,
  format: OutputContainerFormat = 'mp4',
  outputName = 'cricket-episode'
): RenderSettings {
  const resMeta =
    RESOLUTION_PRESETS.find((r) => r.id === outputPresetId) ?? RESOLUTION_PRESETS[0];
  const qualMeta =
    QUALITY_PRESETS.find((q) => q.id === qualityPresetId) ?? QUALITY_PRESETS[1];

  return {
    outputPresetId: resMeta.id,
    qualityPresetId: qualMeta.id,
    aspectRatio: resMeta.aspectRatio,
    width: resMeta.width,
    height: resMeta.height,
    fps,
    format,
    videoBitrateBps: qualMeta.videoBitrateBps,
    audioBitrateBps: qualMeta.audioBitrateBps,
    audioEnabled: true,
    normalizeAudio: true,
    outputName,
  };
}

export function validateRenderSettings(
  settings: RenderSettings
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!Number.isFinite(settings.width) || settings.width < 128 || settings.width % 2 !== 0) {
    errors.push('Video width must be an even integer >= 128.');
  }
  if (!Number.isFinite(settings.height) || settings.height < 128 || settings.height % 2 !== 0) {
    errors.push('Video height must be an even integer >= 128.');
  }
  if (settings.fps !== 30 && settings.fps !== 60) {
    errors.push('FPS must be 30 or 60.');
  }
  if (settings.videoBitrateBps < 300_000) {
    errors.push('Video bitrate must be at least 300 kbps.');
  }
  if (settings.audioBitrateBps < 48_000) {
    errors.push('Audio bitrate must be at least 48 kbps.');
  }
  if (!settings.outputName.trim()) {
    errors.push('Output file name cannot be empty.');
  }
  return { valid: errors.length === 0, errors };
}

export function estimateExportFileSizeBytes(
  durationSec: number,
  settings: RenderSettings
): number {
  const totalBitsPerSec =
    settings.videoBitrateBps + (settings.audioEnabled ? settings.audioBitrateBps : 0);
  return Math.max(1024, Math.round((Math.max(1, durationSec) * totalBitsPerSec) / 8));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}
