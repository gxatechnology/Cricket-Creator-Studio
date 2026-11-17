import type { RenderSettings } from './rendererTypes';
import { getRenderApiHeaders } from './renderApiHelper';

export const ACTIVE_RENDER_CHECKPOINT_KEY =
  'cricket_creator_studio_active_render_job_v1';

export interface PersistedClientRenderCheckpoint {
  jobId: string;
  projectId: string;
  projectTitle: string;
  settings: RenderSettings;
  createdAt: string;
}

export interface ServerSegmentCheckpoint {
  jobId: string;
  segmentIndex: number;
  startFrame: number;
  endFrame: number;
  frameCount: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  resolution: { width: number; height: number };
  fps: number;
  codecConfig: { videoCodec: string; audioCodec: string };
  filePath: string;
  verificationStatus: 'pending' | 'verified' | 'invalid' | 'failed';
  renderDurationMs: number | null;
  fileSizeBytes: number | null;
  actualFrames: number | null;
  actualDurationSec: number | null;
  error: string | null;
  updatedAt: string;
}

export interface ServerJobLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface ServerRenderJobRecord {
  jobId: string;
  projectId: string;
  projectTitle: string;
  status:
    | 'queued'
    | 'rendering'
    | 'interrupted'
    | 'finalizing'
    | 'completed'
    | 'cancelled'
    | 'failed';
  createdAt: string;
  updatedAt: string;
  lastHeartbeatAt: string;
  resolution: { width: number; height: number };
  fps: 30 | 60;
  codecConfig: {
    container: 'mp4' | 'webm';
    videoCodec: string;
    audioCodec: string;
    videoBitrateBps: number;
    audioBitrateBps: number;
    audioEnabled: boolean;
  };
  totalFrames: number;
  totalSegments: number;
  verifiedSegments: number;
  progressPercent: number;
  outputFilename: string;
  renderDurationMs: number;
  error: string | null;
  segments: ServerSegmentCheckpoint[];
  logs: ServerJobLogEntry[];
}

export function saveActiveRenderCheckpoint(
  checkpoint: PersistedClientRenderCheckpoint
): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(ACTIVE_RENDER_CHECKPOINT_KEY, JSON.stringify(checkpoint));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadActiveRenderCheckpoint(): PersistedClientRenderCheckpoint | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(ACTIVE_RENDER_CHECKPOINT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedClientRenderCheckpoint;
    if (!parsed?.jobId || !parsed?.settings) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearActiveRenderCheckpoint(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(ACTIVE_RENDER_CHECKPOINT_KEY);
  } catch {
    // Ignore
  }
}

export async function fetchServerRenderJob(
  jobId: string
): Promise<ServerRenderJobRecord | null> {
  if (typeof fetch === 'undefined') return null;
  try {
    const res = await fetch(`/api/render/jobs/${encodeURIComponent(jobId)}`, {
      headers: getRenderApiHeaders(),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { job?: ServerRenderJobRecord };
    return data.job ?? null;
  } catch {
    return null;
  }
}

export async function listServerRenderJobs(): Promise<ServerRenderJobRecord[]> {
  if (typeof fetch === 'undefined') return [];
  try {
    const res = await fetch('/api/render/jobs', {
      headers: getRenderApiHeaders(),
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { jobs?: ServerRenderJobRecord[] };
    return Array.isArray(data.jobs) ? data.jobs : [];
  } catch {
    return [];
  }
}

export async function cancelServerRenderJob(jobId: string): Promise<boolean> {
  if (typeof fetch === 'undefined') return false;
  try {
    const res = await fetch(`/api/render/jobs/${encodeURIComponent(jobId)}/cancel`, {
      method: 'POST',
      headers: getRenderApiHeaders(),
    });
    return res.ok;
  } catch {
    return false;
  }
}
