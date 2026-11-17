import type { CricketProject } from '../types/studio';
import { resolveAssetBlob } from '../engine/assetBlobStore';
import { evaluateProjectReadiness, ReadinessCheckItem } from '../engine/readinessChecker';
import { DEFAULT_TIMELINE_TRACKS, computeSequenceDuration } from '../engine/timeline';
import {
  estimateMixNormalizationScale,
  prepareDecodedAudioAssets,
  runAssetPreflight,
  synthesizeProjectAudioSegment,
} from './audioRenderer';
import {
  assembleMp4FromRawSegments,
  probeBestCodecConfig,
  probeServerRenderCapabilities,
  type RawChunkSegmentPayload,
} from './ffmpegRenderer';
import type {
  AssetPreflightReport,
  PipelineMode,
  RenderError,
  RenderProgress,
  RenderResult,
  RenderSettings,
  SegmentRenderTiming,
} from './rendererTypes';
import { validateRenderSettings } from './rendererTypes';
import {
  planRenderSegments,
  resolveWorkerConcurrency,
  type RenderSegmentPlan,
} from './segmentPlanner';
import type { WorkerOutboundMessage, WorkerSegmentMessage } from './renderWorker';
import {
  clearActiveRenderCheckpoint,
  saveActiveRenderCheckpoint,
  type ServerRenderJobRecord,
} from './jobPersistence';
import { getRenderApiHeaders } from './renderApiHelper';

export interface RenderGateResult {
  allowed: boolean;
  statusLabel: 'READY TO EXPORT' | 'FIX REQUIRED ITEMS';
  scorePercent: number;
  blockers: ReadinessCheckItem[];
  warnings: ReadinessCheckItem[];
  allChecks: ReadinessCheckItem[];
}

export function evaluateRenderGate(project: CricketProject): RenderGateResult {
  const report = evaluateProjectReadiness(project);
  const blockers: ReadinessCheckItem[] = report.checks.filter(
    (c) => c.severity === 'error'
  );
  const warnings: ReadinessCheckItem[] = report.checks.filter(
    (c) => c.severity === 'warning'
  );

  // Additional hard-gate checks for renderer integrity
  if (!project.fieldDesign || !Array.isArray(project.fieldDesign.fielders) || project.fieldDesign.fielders.length === 0) {
    blockers.push({
      id: 'missing-field-state',
      label: 'Missing field state',
      detail: 'Cricket field design must contain at least 1 fielder.',
      severity: 'error',
      pointsEarned: 0,
      pointsMax: 10,
    });
  }

  const activeQuizClips = (project.timelineClips ?? []).filter(
    (c) => typeof c.questionIndex === 'number'
  );
  for (const qc of activeQuizClips) {
    const q = project.quizQuestions[qc.questionIndex!];
    if (!q || !q.prompt.trim() || q.correctIndex < 0 || q.correctIndex > 3) {
      blockers.push({
        id: `quiz-blocker-${qc.id}`,
        label: `Question ${(qc.questionIndex ?? 0) + 1} incomplete`,
        detail: 'Timeline quiz clip references a question missing prompt or valid correct answer.',
        severity: 'error',
        pointsEarned: 0,
        pointsMax: 10,
      });
      break;
    }
  }

  return {
    allowed: blockers.length === 0,
    statusLabel: blockers.length === 0 ? 'READY TO EXPORT' : 'FIX REQUIRED ITEMS',
    scorePercent: report.scorePercent,
    blockers,
    warnings,
    allChecks: report.checks,
  };
}

export interface ExportExecutionHandle {
  promise: Promise<RenderResult>;
  cancel: () => void;
}

function readJsHeapBytes(): number {
  const perf = performance as unknown as {
    memory?: { usedJSHeapSize?: number };
  };
  return typeof perf?.memory?.usedJSHeapSize === 'number'
    ? perf.memory.usedJSHeapSize
    : 0;
}

async function resolveBrandLogoBlob(project: CricketProject): Promise<Blob | null> {
  if (!project.brandKit?.logoAssetId) return null;
  const logoRec = project.assets.find((a) => a.id === project.brandKit.logoAssetId);
  if (!logoRec) return null;
  return resolveAssetBlob(logoRec);
}

export function startVideoExport(
  project: CricketProject,
  settings: RenderSettings,
  callbacks: {
    onProgress?: (progress: RenderProgress) => void;
    onPreflight?: (preflight: AssetPreflightReport) => void;
    onJobCreated?: (jobId: string) => void;
    resumeJobId?: string;
  } = {}
): ExportExecutionHandle {
  const activeWorkers = new Set<Worker>();
  let fetchAbortCtrl: AbortController | null = null;
  let serverJobId: string | null = callbacks.resumeJobId ?? null;
  let cancelled = false;
  let settled = false;
  let rejectFn: ((err: RenderError) => void) | null = null;

  const cancelServerJob = (jobId: string | null) => {
    if (!jobId || typeof fetch === 'undefined') return;
    void fetch(`/api/render/jobs/${encodeURIComponent(jobId)}/cancel`, {
      method: 'POST',
      headers: getRenderApiHeaders(),
    }).catch(() => {});
  };

  const cancel = () => {
    if (cancelled) return;
    cancelled = true;
    for (const w of activeWorkers) {
      try {
        w.postMessage({ type: 'cancel' });
        w.terminate();
      } catch {
        // Ignore worker termination race
      }
    }
    activeWorkers.clear();
    fetchAbortCtrl?.abort();
    cancelServerJob(serverJobId);
    clearActiveRenderCheckpoint();
    if (!settled && rejectFn) {
      settled = true;
      rejectFn({
        code: 'CANCELLED',
        message: 'Render cancelled by creator.',
      });
    }
  };

  const promise = new Promise<RenderResult>(async (resolve, reject) => {
    rejectFn = reject;
    const failWith = (err: RenderError) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    const startedAt = performance.now();
    let peakMemoryBytes = readJsHeapBytes();
    const trackHeap = () => {
      const cur = readJsHeapBytes();
      if (cur > peakMemoryBytes) peakMemoryBytes = cur;
    };

    let decodedAudioMap: Awaited<ReturnType<typeof prepareDecodedAudioAssets>>['decodedMap'] | null =
      null;

    try {
      // 1. Validate render settings
      const validSettings = validateRenderSettings(settings);
      if (!validSettings.valid) {
        failWith({
          code: 'ENCODE_FAILED',
          message: validSettings.errors[0],
          detail: validSettings.errors.join(' '),
        });
        return;
      }

      // 2. Readiness gate
      const gate = evaluateRenderGate(project);
      if (!gate.allowed) {
        failWith({
          code: 'READINESS_BLOCKED',
          message: `Export blocked: ${gate.blockers[0]?.label || 'Required project items missing'}`,
          detail: gate.blockers.map((b) => b.detail).join(' '),
        });
        return;
      }

      const durationSec = Math.max(1, computeSequenceDuration(project, 'timeline'));
      const totalFrames = Math.max(1, Math.round(durationSec * settings.fps));

      callbacks.onProgress?.({
        stage: 'preparing-assets',
        stageLabel: 'Preparing Fonts & Asset Preflight',
        percent: 2,
        currentFrame: 0,
        totalFrames,
        elapsedMs: 0,
        estimatedRemainingMs: null,
        currentSceneName: 'Preflight',
      });

      // 3. Wait for fonts so typography matches preview
      if (typeof document !== 'undefined' && document.fonts?.ready) {
        await document.fonts.ready;
      }
      if (cancelled) return;

      // 4. Asset preflight
      const preflight = await runAssetPreflight(project);
      callbacks.onPreflight?.(preflight);
      if (!preflight.allReady) {
        failWith({
          code: 'ASSET_MISSING',
          message: `Missing required asset(s): ${preflight.missingNames.join(', ')}`,
          detail: 'Resolve missing files in Asset Library or Audio Workspace before encoding.',
        });
        return;
      }
      if (cancelled) return;

      // 5. Codec probe + server FFmpeg capability check
      const [codecProbe, serverCaps] = await Promise.all([
        probeBestCodecConfig(settings),
        settings.format === 'mp4'
          ? probeServerRenderCapabilities()
          : Promise.resolve({
              ffmpegAvailable: false,
              ffprobeAvailable: false,
              aacSupported: false,
              h264CopySupported: false,
              ffmpegVersion: null,
            }),
      ]);

      if (!codecProbe) {
        failWith({
          code: 'UNSUPPORTED_CODEC',
          message: 'WebCodecs H.264/VP9 encoding is not supported in this browser.',
          detail: 'Use a modern Chromium/Chrome/Edge browser with WebCodecs enabled.',
        });
        return;
      }

      const useServerFfmpegAac =
        codecProbe.container === 'mp4' &&
        settings.format === 'mp4' &&
        serverCaps.ffmpegAvailable &&
        serverCaps.aacSupported;

      // 6. Resolve brand logo Blob once (structured-cloneable across N segment workers)
      const logoBlob = await resolveBrandLogoBlob(project);
      if (cancelled) return;

      // 7. Decode uploaded audio assets once & estimate global peak normalization scale
      callbacks.onProgress?.({
        stage: 'processing-audio',
        stageLabel: 'Preparing Voiceover, Music & Auto SFX Mix',
        percent: 5,
        currentFrame: 0,
        totalFrames,
        elapsedMs: Math.round(performance.now() - startedAt),
        estimatedRemainingMs: null,
        currentSceneName: 'Audio Analysis',
      });

      const audioPrep = settings.audioEnabled
        ? await prepareDecodedAudioAssets(project, 48000)
        : { decodedMap: new Map(), warnings: [] };
      decodedAudioMap = audioPrep.decodedMap;
      if (cancelled) return;

      const normStats = settings.audioEnabled
        ? estimateMixNormalizationScale(
            project.timelineClips ?? [],
            project.timelineTracks ?? DEFAULT_TIMELINE_TRACKS,
            project.audioMix,
            decodedAudioMap,
            durationSec,
            48000,
            settings.normalizeAudio
          )
        : { scale: 1, peakBeforeNormalize: 0, normalizedApplied: false, warnings: [] };
      const allAudioWarnings = new Set<string>([
        ...audioPrep.warnings,
        ...normStats.warnings,
      ]);
      trackHeap();

      // 8. Plan frame-exact segments
      const segments: RenderSegmentPlan[] =
        codecProbe.container === 'webm'
          ? [
              {
                segmentIndex: 0,
                totalSegments: 1,
                startFrame: 0,
                endFrame: totalFrames,
                frameCount: totalFrames,
                startSec: 0,
                endSec: totalFrames / settings.fps,
                durationSec: totalFrames / settings.fps,
              },
            ]
          : planRenderSegments(durationSec, settings.fps);

      let concurrency = resolveWorkerConcurrency(
        segments.length,
        settings.width,
        settings.height,
        typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 2
      );

      const segmentFramesDone = new Array<number>(segments.length).fill(0);
      const segmentTimings = new Array<SegmentRenderTiming>(segments.length);
      const rawChunkSegments: RawChunkSegmentPayload[] = [];
      let segmentRetries = 0;
      let completedSegments = 0;
      let lastSceneName = 'Rendering';
      let lastReportedFps = 0;
      const verifiedSet = new Set<number>();

      // Initialize or resume durable server render job if FFmpeg AAC concat pipeline is active
      if (useServerFfmpegAac) {
        fetchAbortCtrl = new AbortController();
        if (callbacks.resumeJobId) {
          const resRes = await fetch(
            `/api/render/jobs/${encodeURIComponent(callbacks.resumeJobId)}/resume`,
            {
              method: 'POST',
              headers: getRenderApiHeaders({ 'Content-Type': 'application/json' }),
              body: JSON.stringify({ forceReclaim: true }),
              signal: fetchAbortCtrl.signal,
            }
          );
          if (!resRes.ok) {
            const errBody = await resRes.text().catch(() => '');
            throw new Error(`Failed to resume job (${resRes.status}): ${errBody}`);
          }
          const resJson = (await resRes.json()) as {
            job: ServerRenderJobRecord;
            verifiedSegmentIndices: number[];
            pendingSegmentIndices: number[];
          };
          serverJobId = resJson.job.jobId;
          for (const idx of resJson.verifiedSegmentIndices) {
            verifiedSet.add(idx);
            const seg = segments[idx];
            const cp = resJson.job.segments.find((s) => s.segmentIndex === idx);
            if (seg) {
              segmentFramesDone[idx] = seg.frameCount;
              completedSegments += 1;
              if (cp && cp.renderDurationMs) {
                segmentTimings[idx] = {
                  segmentIndex: idx,
                  startFrame: seg.startFrame,
                  endFrame: seg.endFrame,
                  frameCount: seg.frameCount,
                  startSec: seg.startSec,
                  endSec: seg.endSec,
                  renderDurationMs: cp.renderDurationMs,
                  encodingFps:
                    Math.round((seg.frameCount / (cp.renderDurationMs / 1000)) * 10) / 10,
                };
              }
            }
          }
        } else {
          const jobRes = await fetch('/api/render/jobs', {
            method: 'POST',
            headers: getRenderApiHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
              jobId: `ccs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
              projectId: project.id,
              projectTitle: project.title,
              resolution: { width: settings.width, height: settings.height },
              fps: settings.fps,
              codecConfig: {
                container: codecProbe.container,
                videoCodec: codecProbe.videoCodecString,
                audioCodec: settings.audioEnabled ? 'mp4a.40.2' : 'none',
                videoBitrateBps: settings.videoBitrateBps,
                audioBitrateBps: settings.audioBitrateBps,
                audioEnabled: settings.audioEnabled,
              },
              totalFrames,
              outputFilename: `${settings.outputName}.${codecProbe.container}`,
              segments,
            }),
            signal: fetchAbortCtrl.signal,
          });
          if (jobRes.status === 409) {
            const conflict = (await jobRes.json().catch(() => ({}))) as { error?: string };
            throw new Error(
              conflict.error || 'Another render job is currently active on the server.'
            );
          }
          if (!jobRes.ok) {
            throw new Error(`Failed to initialize server FFmpeg job (${jobRes.status})`);
          }
          const jobJson = (await jobRes.json()) as { jobId: string };
          serverJobId = jobJson.jobId;
        }

        saveActiveRenderCheckpoint({
          jobId: serverJobId,
          projectId: project.id,
          projectTitle: project.title,
          settings,
          createdAt: new Date().toISOString(),
        });
        callbacks.onJobCreated?.(serverJobId);
      }

      const directResultBox: {
        current: {
          buffer: ArrayBuffer;
          mimeType: string;
          codecLabel: string;
          container: 'mp4' | 'webm';
        } | null;
      } = { current: null };

      const emitAggregateProgress = (stageOverride?: RenderProgress['stage'], labelOverride?: string) => {
        trackHeap();
        const doneFrames = Math.min(
          totalFrames,
          segmentFramesDone.reduce((sum, n) => sum + n, 0)
        );
        const elapsedMs = Math.max(1, performance.now() - startedAt);
        const avgFps = Math.round((doneFrames / (elapsedMs / 1000)) * 10) / 10;
        if (avgFps > 0) lastReportedFps = avgFps;
        const rate = doneFrames / elapsedMs;
        const remaining = Math.max(0, totalFrames - doneFrames);
        const estMs = rate > 0 ? Math.round(remaining / rate) : null;
        const pct = Math.min(93, Math.round((doneFrames / totalFrames) * 86) + 6);

        callbacks.onProgress?.({
          stage: stageOverride ?? (pct > 84 ? 'encoding-video' : 'rendering-frames'),
          stageLabel:
            labelOverride ??
            `Rendering ${segments.length > 1 ? `Segment ${Math.min(segments.length, completedSegments + 1)}/${segments.length} · ` : ''}Frame ${doneFrames.toLocaleString()} / ${totalFrames.toLocaleString()}`,
          percent: pct,
          currentFrame: doneFrames,
          totalFrames,
          elapsedMs: Math.round(elapsedMs),
          estimatedRemainingMs: estMs,
          currentSceneName: lastSceneName,
          encodingFps: lastReportedFps,
          segmentLabel: `${completedSegments}/${segments.length} segments`,
        });
      };

      const renderSegmentOnce = (seg: RenderSegmentPlan): Promise<void> => {
        return new Promise((segResolve, segReject) => {
          if (cancelled) {
            segReject({ code: 'CANCELLED', message: 'Render cancelled by creator.' });
            return;
          }

          const segAudio = settings.audioEnabled
            ? synthesizeProjectAudioSegment(
                project,
                seg.startSec,
                seg.endSec,
                durationSec,
                settings,
                decodedAudioMap!,
                normStats.scale,
                48000
              )
            : null;
          if (segAudio) {
            for (const w of segAudio.warnings) allAudioWarnings.add(w);
          }

          const worker = new Worker(new URL('./renderWorker.ts', import.meta.url), {
            type: 'module',
          });
          activeWorkers.add(worker);

          const cleanupWorker = () => {
            activeWorkers.delete(worker);
            try {
              worker.terminate();
            } catch {
              // Ignore
            }
          };

          worker.onmessage = async (ev: MessageEvent<WorkerOutboundMessage>) => {
            const msg = ev.data;
            if (cancelled) {
              cleanupWorker();
              return;
            }
            if (msg.type === 'segment-progress') {
              segmentFramesDone[seg.segmentIndex] = msg.framesDone;
              lastSceneName = msg.currentSceneName;
              emitAggregateProgress();
            } else if (msg.type === 'cancelled') {
              cleanupWorker();
              segReject({ code: 'CANCELLED', message: 'Render cancelled by creator.' });
            } else if (msg.type === 'error') {
              cleanupWorker();
              segReject({
                code: (msg.code as RenderError['code']) || 'ENCODE_FAILED',
                message: msg.message,
                detail: msg.detail,
              } satisfies RenderError);
            } else if (msg.type === 'segment-complete') {
              cleanupWorker();
              segmentFramesDone[seg.segmentIndex] = seg.frameCount;
              const segDurMs = Math.max(1, Math.round(msg.renderDurationMs));
              segmentTimings[seg.segmentIndex] = {
                segmentIndex: seg.segmentIndex,
                startFrame: seg.startFrame,
                endFrame: seg.endFrame,
                frameCount: seg.frameCount,
                startSec: seg.startSec,
                endSec: seg.endSec,
                renderDurationMs: segDurMs,
                encodingFps: Math.round((seg.frameCount / (segDurMs / 1000)) * 10) / 10,
              };
              try {
                if (useServerFfmpegAac && serverJobId && msg.buffer) {
                  fetchAbortCtrl = new AbortController();
                  const upRes = await fetch(
                    `/api/render/jobs/${encodeURIComponent(serverJobId)}/segments/${seg.segmentIndex}?durationSec=${seg.durationSec.toFixed(6)}&renderDurationMs=${segDurMs}&startFrame=${seg.startFrame}&endFrame=${seg.endFrame}&frameCount=${seg.frameCount}`,
                    {
                      method: 'POST',
                      headers: getRenderApiHeaders({ 'Content-Type': 'application/octet-stream' }),
                      body: msg.buffer,
                      signal: fetchAbortCtrl.signal,
                    }
                  );
                  if (!upRes.ok) {
                    const errTxt = await upRes.text().catch(() => '');
                    throw new Error(
                      `Segment ${seg.segmentIndex} upload/verification failed (${upRes.status}): ${errTxt}`
                    );
                  }
                } else if (segments.length === 1 && msg.buffer) {
                  directResultBox.current = {
                    buffer: msg.buffer,
                    mimeType: msg.mimeType,
                    codecLabel: msg.codecLabel,
                    container: msg.container,
                  };
                } else if (msg.videoChunks) {
                  rawChunkSegments.push({
                    segmentIndex: seg.segmentIndex,
                    startSec: seg.startSec,
                    videoChunks: msg.videoChunks,
                    audioChunks: msg.audioChunks ?? [],
                  });
                }
                completedSegments += 1;
                emitAggregateProgress();
                segResolve();
              } catch (uploadErr) {
                const uMsg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
                segReject({
                  code: 'ENCODE_FAILED',
                  message: uMsg,
                } satisfies RenderError);
              }
            }
          };

          worker.onerror = (err) => {
            cleanupWorker();
            segReject({
              code: 'WORKER_CRASHED',
              message: `Segment ${seg.segmentIndex + 1} worker failed: ${err.message || 'Worker error'}`,
            } satisfies RenderError);
          };

          const outputMode =
            useServerFfmpegAac || segments.length === 1 ? 'muxed-segment' : 'raw-chunks';

          const segMsg: WorkerSegmentMessage = {
            type: 'render-segment',
            segment: seg,
            outputMode,
            project,
            settings,
            logoBlob,
            audioLeft: segAudio?.leftChannel,
            audioRight: segAudio?.rightChannel,
            audioSampleRate: segAudio?.sampleRate ?? 48000,
          };

          const transferables: Transferable[] = [];
          if (segAudio) {
            transferables.push(
              segAudio.leftChannel.buffer,
              segAudio.rightChannel.buffer
            );
          }
          worker.postMessage(segMsg, transferables);
        });
      };

      const pendingSegments = segments.filter((s) => !verifiedSet.has(s.segmentIndex));
      if (verifiedSet.size > 0) {
        emitAggregateProgress(
          'rendering-frames',
          `Resumed: Reusing ${verifiedSet.size}/${segments.length} verified segments`
        );
      }

      // Execute pending segment queue with worker pool & automatic retry recovery
      let nextSegCursor = 0;
      const runSegmentWithRetries = async (seg: RenderSegmentPlan): Promise<void> => {
        const maxAttempts = 3;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          if (cancelled) throw { code: 'CANCELLED', message: 'Render cancelled by creator.' };
          try {
            segmentFramesDone[seg.segmentIndex] = 0;
            await renderSegmentOnce(seg);
            return;
          } catch (err) {
            if (
              cancelled ||
              (err && typeof err === 'object' && 'code' in err && (err as RenderError).code === 'CANCELLED')
            ) {
              throw err;
            }
            if (attempt >= maxAttempts) {
              throw err;
            }
            // Drop concurrency to 1 and yield cleanly before retrying failed segment
            segmentRetries += 1;
            concurrency = 1;
            await new Promise((r) => setTimeout(r, 250));
          }
        }
      };

      let poolFatalError: unknown = null;
      const runWorkerSlot = async () => {
        while (!cancelled && !poolFatalError) {
          const idx = nextSegCursor;
          nextSegCursor += 1;
          if (idx >= pendingSegments.length) break;
          try {
            await runSegmentWithRetries(pendingSegments[idx]);
          } catch (err) {
            poolFatalError = err;
            break;
          }
        }
      };

      if (pendingSegments.length > 0) {
        const initialWorkers = Array.from(
          { length: Math.min(concurrency, pendingSegments.length) },
          () => runWorkerSlot()
        );
        await Promise.all(initialWorkers);
      }

      if (poolFatalError) {
        throw poolFatalError;
      }
      if (cancelled) return;

      // Release decoded audio assets immediately before final container muxing
      decodedAudioMap?.clear();
      decodedAudioMap = null;
      trackHeap();

      // 9. Finalize output container
      callbacks.onProgress?.({
        stage: 'finalizing-file',
        stageLabel: useServerFfmpegAac
          ? 'Muxing H.264 Video & AAC Audio Stream'
          : 'Finalizing Container & Faststart Index',
        percent: 96,
        currentFrame: totalFrames,
        totalFrames,
        elapsedMs: Math.round(performance.now() - startedAt),
        estimatedRemainingMs: 1200,
        currentSceneName: 'Finalizing MP4',
        encodingFps: lastReportedFps,
      });

      let finalBlob: Blob;
      let mimeType = codecProbe.mimeType;
      let container = codecProbe.container;
      let codecLabel = codecProbe.codecLabel;
      let pipelineMode: PipelineMode =
        codecProbe.container === 'webm'
          ? 'webcodecs-webm'
          : codecProbe.muxAudioCodec === 'aac'
          ? 'webcodecs-aac'
          : 'webcodecs-opus';
      let audioCodec =
        settings.audioEnabled && codecProbe.audioCodecString
          ? codecProbe.audioCodecString
          : 'none';

      if (useServerFfmpegAac && serverJobId) {
        fetchAbortCtrl = new AbortController();
        const finRes = await fetch(
          `/api/render/jobs/${encodeURIComponent(serverJobId)}/finalize`,
          {
            method: 'POST',
            headers: getRenderApiHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
              totalSegments: segments.length,
              audioEnabled: settings.audioEnabled,
              audioBitrateBps: settings.audioBitrateBps,
            }),
            signal: fetchAbortCtrl.signal,
          }
        );
        if (!finRes.ok) {
          const errText = await finRes.text();
          throw new Error(`FFmpeg finalize failed (${finRes.status}): ${errText}`);
        }
        finalBlob = await finRes.blob();
        serverJobId = null; // Finalize stream cleanup happens on server
        clearActiveRenderCheckpoint();
        mimeType = 'video/mp4';
        container = 'mp4';
        pipelineMode = 'ffmpeg-aac-concat';
        audioCodec = settings.audioEnabled ? 'mp4a.40.2' : 'none';
        codecLabel = settings.audioEnabled
          ? `H.264 (${codecProbe.videoCodecString}) + AAC`
          : `H.264 (${codecProbe.videoCodecString}) Video`;
      } else if (directResultBox.current) {
        finalBlob = new Blob([directResultBox.current.buffer], {
          type: directResultBox.current.mimeType,
        });
        directResultBox.current = null;
      } else {
        const finalBuf = assembleMp4FromRawSegments(rawChunkSegments, codecProbe, settings);
        rawChunkSegments.length = 0;
        finalBlob = new Blob([finalBuf], { type: codecProbe.mimeType });
      }

      if (cancelled) return;
      trackHeap();

      const objectUrl = URL.createObjectURL(finalBlob);
      const safeBase = settings.outputName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const ext = container === 'webm' ? 'webm' : 'mp4';
      const renderDurationMs = Math.max(1, Math.round(performance.now() - startedAt));
      const averageEncodingFps =
        Math.round((totalFrames / (renderDurationMs / 1000)) * 10) / 10;

      callbacks.onProgress?.({
        stage: 'finalizing-file',
        stageLabel: 'Export Complete',
        percent: 100,
        currentFrame: totalFrames,
        totalFrames,
        elapsedMs: renderDurationMs,
        estimatedRemainingMs: 0,
        currentSceneName: 'Completed',
        encodingFps: averageEncodingFps,
        segmentLabel: `${segments.length}/${segments.length} segments`,
      });

      if (!settled) {
        settled = true;
        resolve({
          blob: finalBlob,
          objectUrl,
          filename: `${safeBase || 'cricket-episode'}.${ext}`,
          mimeType,
          codecLabel,
          container,
          width: settings.width,
          height: settings.height,
          fps: settings.fps,
          durationSec,
          totalFrames,
          fileSizeBytes: finalBlob.size,
          hasAudio: audioCodec !== 'none' && settings.audioEnabled,
          audioWarnings: Array.from(allAudioWarnings),
          renderDurationMs,
          averageEncodingFps,
          peakMemoryBytes: peakMemoryBytes > 0 ? peakMemoryBytes : undefined,
          segmentCount: segments.length,
          segmentRetries,
          segmentTimings: segmentTimings.filter(Boolean),
          pipelineMode,
          videoCodec: codecProbe.videoCodecString,
          audioCodec,
        });
      }
    } catch (err) {
      if (cancelled) return;
      if (err && typeof err === 'object' && 'code' in err) {
        failWith(err as RenderError);
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      const isOom = /memory|allocation|oom/i.test(msg);
      failWith({
        code: isOom ? 'OUT_OF_MEMORY' : 'ENCODE_FAILED',
        message: isOom
          ? 'Browser memory limit exceeded during render. Try 720p Draft or shorter segments.'
          : `Export failed: ${msg}`,
        detail: msg,
      });
    } finally {
      decodedAudioMap?.clear();
      decodedAudioMap = null;
      for (const w of activeWorkers) {
        try {
          w.terminate();
        } catch {
          // Ignore
        }
      }
      activeWorkers.clear();
      // Only clean up server job directory on explicit cancel; preserve verified segments on failure/disconnect for resume.
      if (cancelled && serverJobId) {
        cancelServerJob(serverJobId);
        serverJobId = null;
      }
    }
  });

  return { promise, cancel };
}

export async function renderThumbnailBlobFromProject(
  project: CricketProject
): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const design = project.thumbnailDesign;
  ctx.fillStyle = design.bgColor || '#0A1326';
  ctx.fillRect(0, 0, 1280, 720);

  for (const el of design.elements) {
    ctx.save();
    const cx = el.x + (el.width * el.scale) / 2;
    const cy = el.y + (el.height * el.scale) / 2;
    ctx.translate(cx, cy);
    ctx.rotate((el.rotation * Math.PI) / 180);
    ctx.scale(el.scale, el.scale);
    ctx.translate(-el.width / 2, -el.height / 2);

    if (el.kind === 'background') {
      ctx.fillStyle = el.bgColor || design.bgColor;
      ctx.fillRect(0, 0, el.width, el.height);
    } else if (
      el.kind === 'badge' ||
      el.kind === 'stat-badge' ||
      el.kind === 'player-placeholder'
    ) {
      ctx.fillStyle = el.bgColor || '#172442';
      ctx.fillRect(0, 0, el.width, el.height);
      ctx.strokeStyle = design.accentColor;
      ctx.lineWidth = 4;
      ctx.strokeRect(0, 0, el.width, el.height);
      if (el.text) {
        ctx.fillStyle = el.color || '#FFFFFF';
        ctx.font = `800 ${el.fontSize || 32}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(el.text, el.width / 2, el.height / 2);
      }
    } else if (el.kind === 'text' && el.text) {
      const fontSize = el.fontSize || 64;
      ctx.fillStyle = el.color || '#FFFFFF';
      ctx.font = `900 ${fontSize}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(el.text, 0, 0, el.width);
    }
    ctx.restore();
  }

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
}
