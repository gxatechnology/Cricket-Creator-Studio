import express from 'express';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer as createViteServer } from 'vite';

const execFileAsync = promisify(execFile);

const PORT = Number(process.env.PORT || 3000);
const TEMP_ROOT = path.join(os.tmpdir(), 'cricket-studio-renders');
const FFMPEG_BIN = '/usr/bin/ffmpeg';
const FFPROBE_BIN = '/usr/bin/ffprobe';
const ACTIVE_HEARTBEAT_TTL_MS = 30_000;

export type ServerRenderJobStatus =
  | 'queued'
  | 'rendering'
  | 'interrupted'
  | 'finalizing'
  | 'completed'
  | 'cancelled'
  | 'failed';

export type SegmentVerificationStatus =
  | 'pending'
  | 'verified'
  | 'invalid'
  | 'failed';

export interface PersistedSegmentCheckpoint {
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
  codecConfig: {
    videoCodec: string;
    audioCodec: string;
  };
  filePath: string;
  verificationStatus: SegmentVerificationStatus;
  renderDurationMs: number | null;
  fileSizeBytes: number | null;
  actualFrames: number | null;
  actualDurationSec: number | null;
  error: string | null;
  updatedAt: string;
}

export interface PersistedJobLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface PersistedRenderJob {
  jobId: string;
  projectId: string;
  projectTitle: string;
  status: ServerRenderJobStatus;
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
  segments: PersistedSegmentCheckpoint[];
  logs: PersistedJobLogEntry[];
}

interface ServerJobRuntime {
  job: PersistedRenderJob;
  dir: string;
  writeChain: Promise<void>;
}

const activeJobs = new Map<string, ServerJobRuntime>();

let cachedCapabilities: {
  ffmpegAvailable: boolean;
  ffprobeAvailable: boolean;
  aacSupported: boolean;
  h264CopySupported: boolean;
  ffmpegVersion: string | null;
} | null = null;

function sanitizeJobId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '') || `ccs-${Date.now().toString(36)}`;
}

function appendJobLog(
  job: PersistedRenderJob,
  level: PersistedJobLogEntry['level'],
  message: string
) {
  job.logs.push({
    timestamp: new Date().toISOString(),
    level,
    message,
  });
  if (job.logs.length > 100) {
    job.logs.splice(0, job.logs.length - 100);
  }
}

function recomputeJobProgress(job: PersistedRenderJob) {
  const verified = job.segments.filter((s) => s.verificationStatus === 'verified').length;
  job.verifiedSegments = verified;
  const total = Math.max(1, job.totalSegments);
  if (job.status === 'completed') {
    job.progressPercent = 100;
  } else if (job.status === 'finalizing') {
    job.progressPercent = 96;
  } else {
    job.progressPercent = Math.min(94, Math.round((verified / total) * 92));
  }
  job.updatedAt = new Date().toISOString();
}

async function persistJobMetadata(runtime: ServerJobRuntime): Promise<void> {
  runtime.writeChain = runtime.writeChain.then(async () => {
    try {
      await fsp.mkdir(runtime.dir, { recursive: true });
      const targetPath = path.join(runtime.dir, 'job.json');
      const tmpPath = path.join(runtime.dir, `job.json.tmp-${Date.now()}`);
      await fsp.writeFile(tmpPath, JSON.stringify(runtime.job, null, 2), 'utf8');
      await fsp.rename(tmpPath, targetPath);
    } catch {
      // Ignore write error if dir was concurrently deleted during cancel
    }
  });
  await runtime.writeChain;
}

async function detectCapabilities() {
  if (cachedCapabilities) return cachedCapabilities;
  try {
    const { stdout: verOut } = await execFileAsync(FFMPEG_BIN, ['-version']);
    const { stdout: encOut } = await execFileAsync(FFMPEG_BIN, ['-encoders']);
    const hasFfprobe = fs.existsSync(FFPROBE_BIN);
    cachedCapabilities = {
      ffmpegAvailable: true,
      ffprobeAvailable: hasFfprobe,
      aacSupported: /\baac\b/.test(encOut),
      h264CopySupported: /libx264/.test(encOut),
      ffmpegVersion: verOut.split('\n')[0]?.trim() ?? 'ffmpeg',
    };
  } catch {
    cachedCapabilities = {
      ffmpegAvailable: false,
      ffprobeAvailable: false,
      aacSupported: false,
      h264CopySupported: false,
      ffmpegVersion: null,
    };
  }
  return cachedCapabilities;
}

interface ProbeVerificationResult {
  valid: boolean;
  fileSizeBytes: number;
  actualFrames: number | null;
  actualDurationSec: number | null;
  videoCodec: string | null;
  error: string | null;
}

async function verifySegmentFileWithFfprobe(
  absPath: string,
  seg: PersistedSegmentCheckpoint
): Promise<ProbeVerificationResult> {
  try {
    const stat = await fsp.stat(absPath);
    if (!stat.isFile() || stat.size < 256) {
      return {
        valid: false,
        fileSizeBytes: stat.size || 0,
        actualFrames: null,
        actualDurationSec: null,
        videoCodec: null,
        error: 'Segment file missing or empty.',
      };
    }

    const { stdout } = await execFileAsync(FFPROBE_BIN, [
      '-v',
      'error',
      '-show_entries',
      'stream=codec_type,codec_name,width,height,nb_frames,duration',
      '-of',
      'json',
      absPath,
    ]);
    const parsed = JSON.parse(stdout) as {
      streams?: Array<{
        codec_type?: string;
        codec_name?: string;
        width?: number;
        height?: number;
        nb_frames?: string;
        duration?: string;
      }>;
    };

    const videoStream = parsed.streams?.find((s) => s.codec_type === 'video');
    if (!videoStream) {
      return {
        valid: false,
        fileSizeBytes: stat.size,
        actualFrames: null,
        actualDurationSec: null,
        videoCodec: null,
        error: 'No video stream found in segment MP4.',
      };
    }

    const actualFrames = videoStream.nb_frames ? Number(videoStream.nb_frames) : null;
    const actualDurationSec = videoStream.duration ? Number(videoStream.duration) : null;
    const widthMatch = Number(videoStream.width) === seg.resolution.width;
    const heightMatch = Number(videoStream.height) === seg.resolution.height;

    if (!widthMatch || !heightMatch) {
      return {
        valid: false,
        fileSizeBytes: stat.size,
        actualFrames,
        actualDurationSec,
        videoCodec: videoStream.codec_name ?? null,
        error: `Resolution mismatch: got ${videoStream.width}x${videoStream.height}, expected ${seg.resolution.width}x${seg.resolution.height}.`,
      };
    }

    if (actualFrames !== null && seg.frameCount > 0 && actualFrames !== seg.frameCount) {
      return {
        valid: false,
        fileSizeBytes: stat.size,
        actualFrames,
        actualDurationSec,
        videoCodec: videoStream.codec_name ?? null,
        error: `Frame count mismatch: got ${actualFrames}, expected ${seg.frameCount}.`,
      };
    }

    if (
      actualDurationSec !== null &&
      Number.isFinite(actualDurationSec) &&
      Math.abs(actualDurationSec - seg.durationSec) > 0.15
    ) {
      return {
        valid: false,
        fileSizeBytes: stat.size,
        actualFrames,
        actualDurationSec,
        videoCodec: videoStream.codec_name ?? null,
        error: `Duration mismatch: got ${actualDurationSec.toFixed(3)}s, expected ${seg.durationSec.toFixed(3)}s.`,
      };
    }

    return {
      valid: true,
      fileSizeBytes: stat.size,
      actualFrames,
      actualDurationSec,
      videoCodec: videoStream.codec_name ?? null,
      error: null,
    };
  } catch (err) {
    return {
      valid: false,
      fileSizeBytes: 0,
      actualFrames: null,
      actualDurationSec: null,
      videoCodec: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function loadPersistedJobsFromDisk(): Promise<void> {
  await fsp.mkdir(TEMP_ROOT, { recursive: true });
  const entries = await fsp.readdir(TEMP_ROOT, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(TEMP_ROOT, entry.name);
    const jobJsonPath = path.join(dir, 'job.json');
    try {
      const raw = await fsp.readFile(jobJsonPath, 'utf8');
      const job = JSON.parse(raw) as PersistedRenderJob;
      if (!job.jobId || !Array.isArray(job.segments)) continue;
      if (job.status === 'rendering' || job.status === 'finalizing') {
        job.status = 'interrupted';
        appendJobLog(
          job,
          'warn',
          'Server restarted while job was in progress. Checkpoint preserved for segment recovery.'
        );
      }
      const runtime: ServerJobRuntime = {
        job,
        dir,
        writeChain: Promise.resolve(),
      };
      activeJobs.set(job.jobId, runtime);
      await persistJobMetadata(runtime);
    } catch {
      // Ignore corrupt or legacy temp folder without job.json
    }
  }
}

async function cleanupJobDir(jobId: string) {
  const safeId = sanitizeJobId(jobId);
  const runtime = activeJobs.get(safeId);
  activeJobs.delete(safeId);
  const dir = runtime?.dir ?? path.join(TEMP_ROOT, safeId);
  try {
    await fsp.rm(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

function isJobActivelyRunning(job: PersistedRenderJob): boolean {
  if (job.status !== 'rendering' && job.status !== 'finalizing') {
    return false;
  }
  const lastBeat = Date.parse(job.lastHeartbeatAt || job.updatedAt);
  if (!Number.isFinite(lastBeat)) return false;
  return Date.now() - lastBeat < ACTIVE_HEARTBEAT_TTL_MS;
}

async function startServer() {
  await loadPersistedJobsFromDisk();
  const app = express();

  app.get('/api/render/capabilities', async (_req, res) => {
    const caps = await detectCapabilities();
    res.json(caps);
  });

  app.get('/api/render/jobs', (_req, res) => {
    const jobs = Array.from(activeJobs.values())
      .map((r) => r.job)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    res.json({ jobs });
  });

  app.get('/api/render/jobs/:jobId', (req, res) => {
    const safeId = sanitizeJobId(String(req.params.jobId));
    const runtime = activeJobs.get(safeId);
    if (!runtime) {
      res.status(404).json({ error: 'Render job not found.' });
      return;
    }
    res.json({ job: runtime.job });
  });

  app.post('/api/render/jobs', express.json(), async (req, res) => {
    const caps = await detectCapabilities();
    if (!caps.ffmpegAvailable || !caps.aacSupported) {
      res.status(503).json({ error: 'FFmpeg AAC pipeline unavailable on server.' });
      return;
    }

    const forceReplace = req.body?.forceReplace === true;
    for (const runtime of activeJobs.values()) {
      if (isJobActivelyRunning(runtime.job)) {
        if (!forceReplace) {
          res.status(409).json({
            error: `Render job ${runtime.job.jobId} (${runtime.job.projectTitle}) is currently active.`,
            activeJobId: runtime.job.jobId,
            activeJob: runtime.job,
          });
          return;
        }
      }
    }

    const rawId =
      typeof req.body?.jobId === 'string'
        ? req.body.jobId
        : `ccs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const safeId = sanitizeJobId(rawId);
    const dir = path.join(TEMP_ROOT, safeId);
    await fsp.rm(dir, { recursive: true, force: true });
    await fsp.mkdir(dir, { recursive: true });

    const now = new Date().toISOString();
    const resolution = {
      width: Number(req.body?.resolution?.width) || 1280,
      height: Number(req.body?.resolution?.height) || 720,
    };
    const fps = req.body?.fps === 60 ? 60 : 30;
    const codecConfig = {
      container: (req.body?.codecConfig?.container === 'webm' ? 'webm' : 'mp4') as
        | 'mp4'
        | 'webm',
      videoCodec: String(req.body?.codecConfig?.videoCodec || 'avc1.64002a'),
      audioCodec: String(req.body?.codecConfig?.audioCodec || 'mp4a.40.2'),
      videoBitrateBps: Number(req.body?.codecConfig?.videoBitrateBps) || 2_500_000,
      audioBitrateBps: Number(req.body?.codecConfig?.audioBitrateBps) || 128_000,
      audioEnabled: req.body?.codecConfig?.audioEnabled !== false,
    };

    const rawSegments = Array.isArray(req.body?.segments) ? req.body.segments : [];
    const segments: PersistedSegmentCheckpoint[] = rawSegments.map(
      (s: Record<string, unknown>, idx: number) => {
        const segIdx = typeof s.segmentIndex === 'number' ? s.segmentIndex : idx;
        const padded = String(segIdx).padStart(4, '0');
        const startFrame = Number(s.startFrame) || 0;
        const endFrame = Number(s.endFrame) || 0;
        const frameCount = Number(s.frameCount) || Math.max(0, endFrame - startFrame);
        const startSec = Number(s.startSec) || 0;
        const endSec = Number(s.endSec) || 0;
        const durationSec = Number(s.durationSec) || Math.max(0.05, endSec - startSec);
        return {
          jobId: safeId,
          segmentIndex: segIdx,
          startFrame,
          endFrame,
          frameCount,
          startSec,
          endSec,
          durationSec,
          resolution,
          fps,
          codecConfig: {
            videoCodec: codecConfig.videoCodec,
            audioCodec: codecConfig.audioCodec,
          },
          filePath: `seg-${padded}.mp4`,
          verificationStatus: 'pending',
          renderDurationMs: null,
          fileSizeBytes: null,
          actualFrames: null,
          actualDurationSec: null,
          error: null,
          updatedAt: now,
        };
      }
    );

    const job: PersistedRenderJob = {
      jobId: safeId,
      projectId: String(req.body?.projectId || 'unknown'),
      projectTitle: String(req.body?.projectTitle || 'Cricket Episode'),
      status: 'rendering',
      createdAt: now,
      updatedAt: now,
      lastHeartbeatAt: now,
      resolution,
      fps,
      codecConfig,
      totalFrames:
        Number(req.body?.totalFrames) ||
        segments.reduce((acc, s) => acc + s.frameCount, 0),
      totalSegments: segments.length,
      verifiedSegments: 0,
      progressPercent: 0,
      outputFilename: String(req.body?.outputFilename || 'cricket-episode.mp4'),
      renderDurationMs: 0,
      error: null,
      segments,
      logs: [
        {
          timestamp: now,
          level: 'info',
          message: `Initialized durable render job (${segments.length} segments, ${resolution.width}x${resolution.height} @ ${fps}fps).`,
        },
      ],
    };

    const runtime: ServerJobRuntime = {
      job,
      dir,
      writeChain: Promise.resolve(),
    };
    activeJobs.set(safeId, runtime);
    await persistJobMetadata(runtime);
    res.json({ jobId: safeId, job });
  });

  app.post(
    '/api/render/jobs/:jobId/segments/:index',
    express.raw({ type: 'application/octet-stream', limit: '256mb' }),
    async (req, res) => {
      const safeId = sanitizeJobId(String(req.params.jobId));
      const index = Number(req.params.index);
      const durationSec = Math.max(0.05, Number(req.query.durationSec) || 1);
      const renderDurationMs = req.query.renderDurationMs
        ? Math.max(1, Number(req.query.renderDurationMs))
        : null;
      const runtime = activeJobs.get(safeId);
      if (!runtime || !Number.isInteger(index) || index < 0) {
        res.status(404).json({ error: 'Render job not found or invalid segment index.' });
        return;
      }
      if (runtime.job.status === 'cancelled') {
        res.status(409).json({ error: 'Render job was cancelled.' });
        return;
      }
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        res.status(400).json({ error: 'Empty segment buffer.' });
        return;
      }

      const padded = String(index).padStart(4, '0');
      const relPath = `seg-${padded}.mp4`;
      const absPath = path.join(runtime.dir, relPath);
      const tmpSegPath = path.join(runtime.dir, `${relPath}.tmp-${Date.now()}`);
      await fsp.writeFile(tmpSegPath, req.body);
      await fsp.rename(tmpSegPath, absPath);

      let checkpoint = runtime.job.segments.find((s) => s.segmentIndex === index);
      if (!checkpoint) {
        checkpoint = {
          jobId: safeId,
          segmentIndex: index,
          startFrame: Number(req.query.startFrame) || 0,
          endFrame: Number(req.query.endFrame) || 0,
          frameCount: Number(req.query.frameCount) || 0,
          startSec: Number(req.query.startSec) || 0,
          endSec: Number(req.query.endSec) || durationSec,
          durationSec,
          resolution: runtime.job.resolution,
          fps: runtime.job.fps,
          codecConfig: {
            videoCodec: runtime.job.codecConfig.videoCodec,
            audioCodec: runtime.job.codecConfig.audioCodec,
          },
          filePath: relPath,
          verificationStatus: 'pending',
          renderDurationMs,
          fileSizeBytes: req.body.length,
          actualFrames: null,
          actualDurationSec: null,
          error: null,
          updatedAt: new Date().toISOString(),
        };
        runtime.job.segments.push(checkpoint);
        runtime.job.segments.sort((a, b) => a.segmentIndex - b.segmentIndex);
        runtime.job.totalSegments = Math.max(
          runtime.job.totalSegments,
          runtime.job.segments.length
        );
      }

      const probe = await verifySegmentFileWithFfprobe(absPath, checkpoint);
      const now = new Date().toISOString();
      checkpoint.filePath = relPath;
      checkpoint.renderDurationMs = renderDurationMs;
      checkpoint.fileSizeBytes = probe.fileSizeBytes || req.body.length;
      checkpoint.actualFrames = probe.actualFrames;
      checkpoint.actualDurationSec = probe.actualDurationSec;
      checkpoint.updatedAt = now;

      if (!probe.valid) {
        checkpoint.verificationStatus = 'invalid';
        checkpoint.error = probe.error;
        appendJobLog(
          runtime.job,
          'error',
          `Segment ${index} failed ffprobe verification: ${probe.error}`
        );
        runtime.job.lastHeartbeatAt = now;
        recomputeJobProgress(runtime.job);
        await persistJobMetadata(runtime);
        res.status(422).json({
          ok: false,
          verified: false,
          error: probe.error,
          checkpoint,
          job: runtime.job,
        });
        return;
      }

      checkpoint.verificationStatus = 'verified';
      checkpoint.error = null;
      runtime.job.status = 'rendering';
      runtime.job.lastHeartbeatAt = now;
      if (renderDurationMs) {
        runtime.job.renderDurationMs += renderDurationMs;
      }
      appendJobLog(
        runtime.job,
        'info',
        `Segment ${index + 1}/${runtime.job.totalSegments} verified (${probe.actualFrames ?? checkpoint.frameCount} frames, ${probe.fileSizeBytes} bytes).`
      );
      recomputeJobProgress(runtime.job);
      await persistJobMetadata(runtime);

      res.json({
        ok: true,
        verified: true,
        index,
        bytes: req.body.length,
        checkpoint,
        job: runtime.job,
      });
    }
  );

  app.post('/api/render/jobs/:jobId/resume', express.json(), async (req, res) => {
    const safeId = sanitizeJobId(String(req.params.jobId));
    const runtime = activeJobs.get(safeId);
    if (!runtime) {
      res.status(404).json({ error: 'Render job not found for resume.' });
      return;
    }
    if (runtime.job.status === 'cancelled') {
      res.status(409).json({ error: 'Cancelled render jobs cannot be resumed.' });
      return;
    }
    if (runtime.job.status === 'completed') {
      res.status(409).json({ error: 'Render job is already completed.' });
      return;
    }

    const forceReclaim = req.body?.forceReclaim === true;
    if (!forceReclaim && isJobActivelyRunning(runtime.job)) {
      res.status(409).json({
        error: 'Render job has an active worker heartbeat. Wait or pass forceReclaim to take over.',
      });
      return;
    }

    const verifiedSegmentIndices: number[] = [];
    const pendingSegmentIndices: number[] = [];

    for (const seg of runtime.job.segments) {
      const absPath = path.join(runtime.dir, seg.filePath);
      const probe = await verifySegmentFileWithFfprobe(absPath, seg);
      seg.updatedAt = new Date().toISOString();
      if (probe.valid) {
        seg.verificationStatus = 'verified';
        seg.fileSizeBytes = probe.fileSizeBytes;
        seg.actualFrames = probe.actualFrames;
        seg.actualDurationSec = probe.actualDurationSec;
        seg.error = null;
        verifiedSegmentIndices.push(seg.segmentIndex);
      } else {
        seg.verificationStatus = fs.existsSync(absPath) ? 'invalid' : 'pending';
        seg.fileSizeBytes = probe.fileSizeBytes || null;
        seg.actualFrames = null;
        seg.actualDurationSec = null;
        seg.error = fs.existsSync(absPath) ? probe.error : null;
        pendingSegmentIndices.push(seg.segmentIndex);
      }
    }

    const now = new Date().toISOString();
    runtime.job.status = 'rendering';
    runtime.job.error = null;
    runtime.job.lastHeartbeatAt = now;
    recomputeJobProgress(runtime.job);
    appendJobLog(
      runtime.job,
      'info',
      `Resumed job: reusing ${verifiedSegmentIndices.length} verified segment(s) [${verifiedSegmentIndices.join(', ')}]; ${pendingSegmentIndices.length} segment(s) pending.`
    );
    await persistJobMetadata(runtime);

    res.json({
      job: runtime.job,
      verifiedSegmentIndices,
      pendingSegmentIndices,
    });
  });

  app.post('/api/render/jobs/:jobId/cancel', async (req, res) => {
    const safeId = sanitizeJobId(String(req.params.jobId));
    const runtime = activeJobs.get(safeId);
    if (runtime) {
      runtime.job.status = 'cancelled';
      runtime.job.error = 'Render cancelled by creator.';
      appendJobLog(runtime.job, 'warn', 'Job cancelled; cleaning up temporary segment files.');
      await persistJobMetadata(runtime);
    }
    await cleanupJobDir(safeId);
    res.json({ ok: true, jobId: safeId, status: 'cancelled' });
  });

  app.post('/api/render/jobs/:jobId/finalize', express.json(), async (req, res) => {
    const safeId = sanitizeJobId(String(req.params.jobId));
    const runtime = activeJobs.get(safeId);
    if (!runtime || runtime.job.segments.length === 0) {
      res.status(404).json({ error: 'Render job or segments missing.' });
      return;
    }
    if (runtime.job.status === 'cancelled') {
      res.status(409).json({ error: 'Render job was cancelled.' });
      return;
    }

    const totalSegments = Number(req.body?.totalSegments) || runtime.job.totalSegments;
    const audioEnabled =
      req.body?.audioEnabled !== undefined
        ? req.body.audioEnabled !== false
        : runtime.job.codecConfig.audioEnabled;
    const audioBitrateBps = Math.max(
      48_000,
      Math.min(
        320_000,
        Number(req.body?.audioBitrateBps) || runtime.job.codecConfig.audioBitrateBps || 128_000
      )
    );

    const orderedIndices = Array.from({ length: totalSegments }, (_, i) => i);
    for (const idx of orderedIndices) {
      const seg = runtime.job.segments.find((s) => s.segmentIndex === idx);
      if (!seg) {
        res.status(400).json({ error: `Missing segment ${idx} of ${totalSegments}.` });
        return;
      }
      const absPath = path.join(runtime.dir, seg.filePath);
      if (seg.verificationStatus !== 'verified' || !fs.existsSync(absPath)) {
        const probe = await verifySegmentFileWithFfprobe(absPath, seg);
        if (!probe.valid) {
          seg.verificationStatus = 'invalid';
          seg.error = probe.error;
          await persistJobMetadata(runtime);
          res.status(400).json({
            error: `Segment ${idx} failed verification before finalize: ${probe.error}`,
          });
          return;
        }
        seg.verificationStatus = 'verified';
      }
    }

    runtime.job.status = 'finalizing';
    runtime.job.lastHeartbeatAt = new Date().toISOString();
    recomputeJobProgress(runtime.job);
    appendJobLog(runtime.job, 'info', `Starting final FFmpeg concatenation (${totalSegments} segments).`);
    await persistJobMetadata(runtime);

    try {
      const videoListLines: string[] = [];
      const wavPaths: string[] = [];

      for (const idx of orderedIndices) {
        const seg = runtime.job.segments.find((s) => s.segmentIndex === idx)!;
        const absSegPath = path.join(runtime.dir, seg.filePath);
        const padded = String(idx).padStart(4, '0');
        const escapedVideoPath = absSegPath.replace(/'/g, "'\\''");
        videoListLines.push(`file '${escapedVideoPath}'`);
        videoListLines.push(`duration ${seg.durationSec.toFixed(6)}`);

        if (audioEnabled) {
          const wavPath = path.join(runtime.dir, `a-${padded}.wav`);
          // Trim to exact segment duration so Opus/AAC frame padding never causes A/V drift across segments
          try {
            await execFileAsync(FFMPEG_BIN, [
              '-y',
              '-i',
              absSegPath,
              '-vn',
              '-af',
              `apad=whole_dur=${seg.durationSec.toFixed(6)},atrim=0:${seg.durationSec.toFixed(6)},asetpts=PTS-STARTPTS`,
              '-ar',
              '48000',
              '-ac',
              '2',
              '-c:a',
              'pcm_s16le',
              wavPath,
            ]);
          } catch {
            // If segment had no audio stream, synthesize exact silence so concat stays A/V synced
            await execFileAsync(FFMPEG_BIN, [
              '-y',
              '-f',
              'lavfi',
              '-i',
              `anullsrc=r=48000:cl=stereo:d=${seg.durationSec.toFixed(6)}`,
              '-c:a',
              'pcm_s16le',
              wavPath,
            ]);
          }
          wavPaths.push(wavPath);
        }
      }

      const outPath = path.join(runtime.dir, 'final.mp4');
      const videoListPath = path.join(runtime.dir, 'video-list.txt');
      await fsp.writeFile(videoListPath, videoListLines.join('\n'), 'utf8');

      if (audioEnabled && wavPaths.length > 0) {
        const wavListPath = path.join(runtime.dir, 'audio-list.txt');
        const listBody = wavPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
        await fsp.writeFile(wavListPath, listBody, 'utf8');

        await execFileAsync(FFMPEG_BIN, [
          '-y',
          '-f',
          'concat',
          '-safe',
          '0',
          '-i',
          videoListPath,
          '-f',
          'concat',
          '-safe',
          '0',
          '-i',
          wavListPath,
          '-map',
          '0:v:0',
          '-map',
          '1:a:0',
          '-c:v',
          'copy',
          '-c:a',
          'aac',
          '-b:a',
          `${Math.round(audioBitrateBps / 1000)}k`,
          '-ar',
          '48000',
          '-ac',
          '2',
          '-movflags',
          '+faststart',
          outPath,
        ]);
      } else {
        await execFileAsync(FFMPEG_BIN, [
          '-y',
          '-f',
          'concat',
          '-safe',
          '0',
          '-i',
          videoListPath,
          '-c:v',
          'copy',
          '-an',
          '-movflags',
          '+faststart',
          outPath,
        ]);
      }

      const stat = await fsp.stat(outPath);
      runtime.job.status = 'completed';
      recomputeJobProgress(runtime.job);
      appendJobLog(runtime.job, 'info', `Final MP4 muxed (${stat.size} bytes).`);
      await persistJobMetadata(runtime);

      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Length', String(stat.size));
      res.setHeader('X-Audio-Codec', audioEnabled ? 'aac' : 'none');

      const stream = fs.createReadStream(outPath);
      stream.on('close', () => {
        void cleanupJobDir(safeId);
      });
      stream.on('error', () => {
        void cleanupJobDir(safeId);
      });
      stream.pipe(res);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      runtime.job.status = 'failed';
      runtime.job.error = `FFmpeg finalize failed: ${message}`;
      appendJobLog(runtime.job, 'error', runtime.job.error);
      await persistJobMetadata(runtime);
      res.status(500).json({ error: runtime.job.error });
    }
  });

  app.delete('/api/render/jobs/:jobId', async (req, res) => {
    const safeId = sanitizeJobId(String(req.params.jobId));
    await cleanupJobDir(safeId);
    res.json({ ok: true });
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && fs.existsSync(path.resolve('dist'))) {
    app.use(express.static(path.resolve('dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Cricket Creator Studio server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
