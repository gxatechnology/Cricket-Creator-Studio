import type { CricketProject } from '../types/studio';
import { computeSequenceDuration, createTimelineEvaluator } from '../engine/timeline';
import { renderFrame } from './frameRenderer';
import { clearRendererCaches } from './canvasRenderer';
import {
  createMuxerForConfig,
  probeBestCodecConfig,
  type RawAudioChunkPacket,
  type RawVideoChunkPacket,
} from './ffmpegRenderer';
import type { RenderProgress, RenderSettings } from './rendererTypes';
import type { RenderSegmentPlan } from './segmentPlanner';

export interface WorkerStartMessage {
  type: 'start';
  project: CricketProject;
  settings: RenderSettings;
  logoBitmap?: ImageBitmap | null;
  logoBlob?: Blob | null;
  audioLeft?: Float32Array;
  audioRight?: Float32Array;
  audioSampleRate?: number;
}

export interface WorkerSegmentMessage {
  type: 'render-segment';
  segment: RenderSegmentPlan;
  outputMode: 'muxed-segment' | 'raw-chunks';
  project: CricketProject;
  settings: RenderSettings;
  logoBlob?: Blob | null;
  audioLeft?: Float32Array;
  audioRight?: Float32Array;
  audioSampleRate?: number;
}

export interface WorkerCancelMessage {
  type: 'cancel';
}

export type WorkerInboundMessage =
  | WorkerStartMessage
  | WorkerSegmentMessage
  | WorkerCancelMessage;

export type WorkerOutboundMessage =
  | { type: 'progress'; progress: RenderProgress }
  | {
      type: 'segment-progress';
      segmentIndex: number;
      framesDone: number;
      totalFrames: number;
      currentSceneName: string;
      encodingFps: number;
    }
  | {
      type: 'segment-complete';
      segmentIndex: number;
      durationSec: number;
      renderDurationMs: number;
      mimeType: string;
      codecLabel: string;
      container: 'mp4' | 'webm';
      buffer?: ArrayBuffer;
      videoChunks?: RawVideoChunkPacket[];
      audioChunks?: RawAudioChunkPacket[];
    }
  | {
      type: 'complete';
      buffer: ArrayBuffer;
      mimeType: string;
      codecLabel: string;
      container: 'mp4' | 'webm';
      durationSec: number;
      renderDurationMs: number;
    }
  | { type: 'cancelled' }
  | { type: 'error'; code: string; message: string; detail?: string; segmentIndex?: number };

let cancelled = false;
const workerSelf = self as unknown as {
  postMessage: (msg: WorkerOutboundMessage, transfer?: Transferable[]) => void;
  onmessage: ((event: MessageEvent<WorkerInboundMessage>) => void) | null;
};

function safeCloseEncoder(enc: VideoEncoder | AudioEncoder | null) {
  if (!enc) return;
  try {
    if (enc.state !== 'closed') {
      enc.close();
    }
  } catch {
    // Ignore close errors during abort/cleanup
  }
}

workerSelf.onmessage = async (event: MessageEvent<WorkerInboundMessage>) => {
  if (event.data.type === 'cancel') {
    cancelled = true;
    return;
  }

  cancelled = false;
  const startedAt = performance.now();
  const msg = event.data;
  const isSegmentJob = msg.type === 'render-segment';
  const segment: RenderSegmentPlan = isSegmentJob
    ? msg.segment
    : (() => {
        const dur = Math.max(1, computeSequenceDuration(msg.project, 'timeline'));
        const total = Math.max(1, Math.round(dur * msg.settings.fps));
        return {
          segmentIndex: 0,
          totalSegments: 1,
          startFrame: 0,
          endFrame: total,
          frameCount: total,
          startSec: 0,
          endSec: dur,
          durationSec: dur,
        };
      })();
  const outputMode = isSegmentJob ? msg.outputMode : 'muxed-segment';

  let canvas: OffscreenCanvas | null = null;
  let videoEncoder: VideoEncoder | null = null;
  let audioEncoder: AudioEncoder | null = null;
  let decodedLogo: ImageBitmap | null =
    msg.type === 'start' ? (msg.logoBitmap ?? null) : null;

  try {
    if (typeof OffscreenCanvas === 'undefined') {
      workerSelf.postMessage({
        type: 'error',
        code: 'UNSUPPORTED_CODEC',
        message: 'OffscreenCanvas is not supported in this worker environment.',
        segmentIndex: segment.segmentIndex,
      } satisfies WorkerOutboundMessage);
      return;
    }

    const { project, settings, audioLeft, audioRight, audioSampleRate } = msg;

    const codecCfg = await probeBestCodecConfig(settings);
    if (!codecCfg) {
      workerSelf.postMessage({
        type: 'error',
        code: 'UNSUPPORTED_CODEC',
        message: 'WebCodecs H.264/VP9 hardware/software encoding is unavailable in this browser.',
        segmentIndex: segment.segmentIndex,
      } satisfies WorkerOutboundMessage);
      return;
    }

    if (!decodedLogo && msg.logoBlob && typeof createImageBitmap !== 'undefined') {
      decodedLogo = await createImageBitmap(msg.logoBlob);
    }

    const fps = settings.fps;
    const totalSegmentFrames = Math.max(1, segment.frameCount);

    canvas = new OffscreenCanvas(settings.width, settings.height);
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      workerSelf.postMessage({
        type: 'error',
        code: 'ENCODE_FAILED',
        message: 'Failed to create 2D OffscreenCanvas context.',
        segmentIndex: segment.segmentIndex,
      } satisfies WorkerOutboundMessage);
      return;
    }

    const timelineEval = createTimelineEvaluator(project, 'timeline');
    const useRawChunks = outputMode === 'raw-chunks';
    const muxer = useRawChunks ? null : createMuxerForConfig(codecCfg, settings);
    const rawVideoChunks: RawVideoChunkPacket[] = [];
    const rawAudioChunks: RawAudioChunkPacket[] = [];
    let encoderErrorMsg: string | null = null;
    const frameDurationUs = Math.round(1_000_000 / fps);

    videoEncoder = new VideoEncoder({
      output: (chunk, meta) => {
        if (muxer) {
          muxer.addVideoChunk(chunk, meta);
        } else {
          const buf = new ArrayBuffer(chunk.byteLength);
          chunk.copyTo(buf);
          rawVideoChunks.push({
            data: buf,
            type: chunk.type,
            timestampUs: chunk.timestamp,
            durationUs: chunk.duration ?? frameDurationUs,
            decoderConfig: meta?.decoderConfig,
          });
        }
      },
      error: (err) => {
        encoderErrorMsg = err.message;
      },
    });

    videoEncoder.configure({
      codec: codecCfg.videoCodecString,
      width: settings.width,
      height: settings.height,
      bitrate: settings.videoBitrateBps,
      framerate: fps,
      ...(codecCfg.container === 'mp4' ? { avc: { format: 'avc' as const } } : {}),
    });

    if (
      codecCfg.audioCodecString &&
      audioLeft &&
      audioRight &&
      audioLeft.length > 0 &&
      typeof AudioEncoder !== 'undefined'
    ) {
      audioEncoder = new AudioEncoder({
        output: (chunk, meta) => {
          if (muxer) {
            muxer.addAudioChunk(chunk, meta);
          } else {
            const buf = new ArrayBuffer(chunk.byteLength);
            chunk.copyTo(buf);
            rawAudioChunks.push({
              data: buf,
              type: chunk.type,
              timestampUs: chunk.timestamp,
              durationUs: chunk.duration ?? Math.round((1024 / (audioSampleRate ?? 48000)) * 1_000_000),
              decoderConfig: meta?.decoderConfig,
            });
          }
        },
        error: (err) => {
          encoderErrorMsg = err.message;
        },
      });
      audioEncoder.configure({
        codec: codecCfg.audioCodecString,
        sampleRate: audioSampleRate ?? 48000,
        numberOfChannels: 2,
        bitrate: settings.audioBitrateBps,
      });

      const sr = audioSampleRate ?? 48000;
      const chunkSamples = 1024;
      const totalSamples = audioLeft.length;
      const fullPlanarScratch = new Float32Array(chunkSamples * 2);

      for (let offset = 0; offset < totalSamples; offset += chunkSamples) {
        if (cancelled || encoderErrorMsg) break;
        const framesInChunk = Math.min(chunkSamples, totalSamples - offset);
        const planar =
          framesInChunk === chunkSamples
            ? fullPlanarScratch
            : new Float32Array(framesInChunk * 2);
        planar.set(audioLeft.subarray(offset, offset + framesInChunk), 0);
        planar.set(audioRight.subarray(offset, offset + framesInChunk), framesInChunk);

        const timestampUs = Math.round((offset / sr) * 1_000_000);
        const audioData = new AudioData({
          format: 'f32-planar',
          sampleRate: sr,
          numberOfFrames: framesInChunk,
          numberOfChannels: 2,
          timestamp: timestampUs,
          data: planar,
        });
        audioEncoder.encode(audioData);
        audioData.close();

        while (audioEncoder.encodeQueueSize > 32) {
          if (cancelled) break;
          await new Promise((r) => setTimeout(r, 2));
        }
      }
    }

    const progressInterval = Math.max(4, Math.floor(fps / 4));

    for (let localIdx = 0; localIdx < totalSegmentFrames; localIdx++) {
      if (cancelled) {
        workerSelf.postMessage({ type: 'cancelled' } satisfies WorkerOutboundMessage);
        return;
      }
      if (encoderErrorMsg) {
        throw new Error(encoderErrorMsg);
      }

      const globalFrameIdx = segment.startFrame + localIdx;
      const frameTime = globalFrameIdx / fps;
      const sceneState = timelineEval.evaluateAt(frameTime);
      renderFrame(project, frameTime, ctx, settings, { logoBitmap: decodedLogo }, sceneState);

      const timestampUs = Math.round(localIdx * (1_000_000 / fps));
      const videoFrame = new VideoFrame(canvas, {
        timestamp: timestampUs,
        duration: frameDurationUs,
      });

      const isKey = localIdx === 0 || localIdx % (fps * 2) === 0;
      videoEncoder.encode(videoFrame, { keyFrame: isKey });
      videoFrame.close();

      // Strict backpressure so uncompressed canvas/VideoFrame buffers stay bounded in RAM
      while (videoEncoder.encodeQueueSize > 6) {
        if (cancelled) break;
        await new Promise((r) => setTimeout(r, 2));
      }

      if (localIdx % progressInterval === 0 || localIdx === totalSegmentFrames - 1) {
        const elapsedMs = performance.now() - startedAt;
        const done = localIdx + 1;
        const encFps = Math.round((done / Math.max(1, elapsedMs)) * 1000 * 10) / 10;
        const sceneName =
          sceneState.activeSceneClip?.name ?? sceneState.activeStage.toUpperCase();

        if (isSegmentJob) {
          workerSelf.postMessage({
            type: 'segment-progress',
            segmentIndex: segment.segmentIndex,
            framesDone: done,
            totalFrames: totalSegmentFrames,
            currentSceneName: sceneName,
            encodingFps: encFps,
          } satisfies WorkerOutboundMessage);
        } else {
          const pct = Math.min(95, Math.round((done / totalSegmentFrames) * 90) + 5);
          const rate = done / Math.max(1, elapsedMs);
          const remainingFrames = totalSegmentFrames - done;
          const estRemainingMs = rate > 0 ? Math.round(remainingFrames / rate) : null;
          workerSelf.postMessage({
            type: 'progress',
            progress: {
              stage: pct > 88 ? 'encoding-video' : 'rendering-frames',
              stageLabel:
                pct > 88
                  ? 'Encoding Video Stream'
                  : `Rendering Frame ${done.toLocaleString()} / ${totalSegmentFrames.toLocaleString()}`,
              percent: pct,
              currentFrame: done,
              totalFrames: totalSegmentFrames,
              elapsedMs: Math.round(elapsedMs),
              estimatedRemainingMs: estRemainingMs,
              currentSceneName: sceneName,
              encodingFps: encFps,
            },
          } satisfies WorkerOutboundMessage);
        }
      }
    }

    if (cancelled) {
      workerSelf.postMessage({ type: 'cancelled' } satisfies WorkerOutboundMessage);
      return;
    }

    if (!isSegmentJob) {
      workerSelf.postMessage({
        type: 'progress',
        progress: {
          stage: 'finalizing-file',
          stageLabel: 'Finalizing Container & Muxing Audio',
          percent: 97,
          currentFrame: totalSegmentFrames,
          totalFrames: totalSegmentFrames,
          elapsedMs: Math.round(performance.now() - startedAt),
          estimatedRemainingMs: 250,
          currentSceneName: 'Muxing MP4 / WebM',
        },
      } satisfies WorkerOutboundMessage);
    }

    await videoEncoder.flush();
    safeCloseEncoder(videoEncoder);

    if (audioEncoder) {
      await audioEncoder.flush();
      safeCloseEncoder(audioEncoder);
    }

    const renderDurationMs = Math.round(performance.now() - startedAt);

    if (isSegmentJob) {
      if (muxer) {
        const buffer = muxer.finalizeBuffer();
        workerSelf.postMessage(
          {
            type: 'segment-complete',
            segmentIndex: segment.segmentIndex,
            durationSec: segment.durationSec,
            renderDurationMs,
            mimeType: codecCfg.mimeType,
            codecLabel: codecCfg.codecLabel,
            container: codecCfg.container,
            buffer,
          },
          [buffer]
        );
      } else {
        const transferables: Transferable[] = [
          ...rawVideoChunks.map((c) => c.data),
          ...rawAudioChunks.map((c) => c.data),
        ];
        workerSelf.postMessage(
          {
            type: 'segment-complete',
            segmentIndex: segment.segmentIndex,
            durationSec: segment.durationSec,
            renderDurationMs,
            mimeType: codecCfg.mimeType,
            codecLabel: codecCfg.codecLabel,
            container: codecCfg.container,
            videoChunks: rawVideoChunks,
            audioChunks: rawAudioChunks,
          },
          transferables
        );
      }
    } else {
      const buffer = muxer!.finalizeBuffer();
      workerSelf.postMessage(
        {
          type: 'complete',
          buffer,
          mimeType: codecCfg.mimeType,
          codecLabel: codecCfg.codecLabel,
          container: codecCfg.container,
          durationSec: segment.durationSec,
          renderDurationMs,
        },
        [buffer]
      );
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const isOom = /memory|allocation|oom/i.test(errMsg);
    workerSelf.postMessage({
      type: 'error',
      code: isOom ? 'OUT_OF_MEMORY' : 'ENCODE_FAILED',
      message: isOom
        ? 'Browser memory limit exceeded during render. Try 720p Draft or shorter scene.'
        : `Video encoding failed: ${errMsg}`,
      detail: errMsg,
      segmentIndex: segment.segmentIndex,
    } satisfies WorkerOutboundMessage);
  } finally {
    safeCloseEncoder(videoEncoder);
    safeCloseEncoder(audioEncoder);
    decodedLogo?.close();
    clearRendererCaches();
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
};
