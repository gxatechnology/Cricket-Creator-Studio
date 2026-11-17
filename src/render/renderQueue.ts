import type { CricketProject } from '../types/studio';
import type {
  QualityPresetId,
  RenderError,
  RenderJob,
  RenderProgress,
  RenderResult,
  RenderSettings,
} from './rendererTypes';
import {
  QUALITY_PRESETS,
  buildRenderSettings,
} from './rendererTypes';

export function createRenderJob(
  project: CricketProject,
  settings: RenderSettings,
  label?: string
): RenderJob {
  const qual =
    QUALITY_PRESETS.find((q) => q.id === settings.qualityPresetId)?.label ?? 'STANDARD';
  return {
    id: `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    projectId: project.id,
    projectTitle: project.title,
    label:
      label ??
      `${settings.aspectRatio} · ${settings.width}×${settings.height} · ${qual} (${settings.fps}fps)`,
    settings: { ...settings },
    status: 'queued',
    createdAt: new Date().toISOString(),
    progressPercent: 0,
  };
}

export function enqueueRenderJob(queue: RenderJob[], job: RenderJob): RenderJob[] {
  return [...queue, job];
}

export function enqueueMultiFormatSuite(
  queue: RenderJob[],
  project: CricketProject,
  fps: 30 | 60 = 30,
  format: 'mp4' | 'webm' = 'mp4',
  qualityForLandscape: QualityPresetId = 'standard'
): RenderJob[] {
  const slug =
    project.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'cricket-episode';

  const landscape = createRenderJob(
    project,
    buildRenderSettings(
      'youtube-1080p',
      qualityForLandscape,
      fps,
      format,
      `${slug}-16x9`
    ),
    `Landscape Version (1920×1080 · 16:9)`
  );
  const shorts = createRenderJob(
    project,
    buildRenderSettings('shorts-1080x1920', 'shorts-hq', fps, format, `${slug}-9x16`),
    `Shorts Version (1080×1920 · 9:16)`
  );
  const square = createRenderJob(
    project,
    buildRenderSettings('square-1080', 'standard', fps, format, `${slug}-1x1`),
    `Square Version (1080×1080 · 1:1)`
  );
  return [...queue, landscape, shorts, square];
}

export function markJobRendering(
  queue: RenderJob[],
  jobId: string,
  progress: RenderProgress
): RenderJob[] {
  return queue.map((j) =>
    j.id === jobId
      ? {
          ...j,
          status: 'rendering',
          progressPercent: progress.percent,
          stage: progress.stage,
          error: undefined,
        }
      : j
  );
}

export function markJobCompleted(
  queue: RenderJob[],
  jobId: string,
  result: RenderResult
): RenderJob[] {
  return queue.map((j) =>
    j.id === jobId
      ? {
          ...j,
          status: 'completed',
          progressPercent: 100,
          stage: 'finalizing-file',
          completedAt: new Date().toISOString(),
          result,
          error: undefined,
        }
      : j
  );
}

export function markJobFailed(
  queue: RenderJob[],
  jobId: string,
  error: RenderError
): RenderJob[] {
  return queue.map((j) =>
    j.id === jobId
      ? {
          ...j,
          status: error.code === 'CANCELLED' ? 'cancelled' : 'failed',
          error,
        }
      : j
  );
}

export function retryRenderJob(queue: RenderJob[], jobId: string): RenderJob[] {
  return queue.map((j) =>
    j.id === jobId
      ? {
          ...j,
          status: 'queued',
          progressPercent: 0,
          stage: undefined,
          error: undefined,
          result: undefined,
        }
      : j
  );
}

export function removeRenderJob(queue: RenderJob[], jobId: string): RenderJob[] {
  return queue.filter((j) => j.id !== jobId);
}
