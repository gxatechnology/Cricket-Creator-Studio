import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4ArrayBufferTarget } from 'mp4-muxer';
import { Muxer as WebmMuxer, ArrayBufferTarget as WebmArrayBufferTarget } from 'webm-muxer';
import type { CricketProject } from '../types/studio';
import type { OutputContainerFormat, RenderSettings } from './rendererTypes';

export interface SelectedCodecConfig {
  container: OutputContainerFormat;
  videoCodecString: string;
  muxVideoCodec: 'avc' | 'vp9' | 'V_VP9' | 'V_VP8';
  audioCodecString: string | null;
  muxAudioCodec: 'aac' | 'opus' | 'A_OPUS' | null;
  mimeType: string;
  codecLabel: string;
}

const AVC_CANDIDATES = [
  'avc1.64002a', // High Profile Level 4.2 (1080p)
  'avc1.4d002a', // Main Profile Level 4.2
  'avc1.420028', // Baseline Level 4.0
  'avc1.42001f', // Baseline Level 3.1 (720p/480p)
];

const VP9_CANDIDATES = ['vp09.00.10.08', 'vp8'];

export async function probeBestCodecConfig(
  settings: RenderSettings
): Promise<SelectedCodecConfig | null> {
  if (typeof VideoEncoder === 'undefined') {
    return null;
  }

  // Attempt primary MP4 / H.264 target first when MP4 is selected
  if (settings.format === 'mp4') {
    for (const avc of AVC_CANDIDATES) {
      try {
        const res = await VideoEncoder.isConfigSupported({
          codec: avc,
          width: settings.width,
          height: settings.height,
          bitrate: settings.videoBitrateBps,
          framerate: settings.fps,
        });
        if (res.supported) {
          let audioCodecString: string | null = null;
          let muxAudioCodec: 'aac' | 'opus' | null = null;

          if (settings.audioEnabled && typeof AudioEncoder !== 'undefined') {
            try {
              const aac = await AudioEncoder.isConfigSupported({
                codec: 'mp4a.40.2',
                sampleRate: 48000,
                numberOfChannels: 2,
                bitrate: settings.audioBitrateBps,
              });
              if (aac.supported) {
                audioCodecString = 'mp4a.40.2';
                muxAudioCodec = 'aac';
              }
            } catch {
              // Fall through to Opus in MP4
            }

            if (!audioCodecString) {
              try {
                const opus = await AudioEncoder.isConfigSupported({
                  codec: 'opus',
                  sampleRate: 48000,
                  numberOfChannels: 2,
                  bitrate: settings.audioBitrateBps,
                });
                if (opus.supported) {
                  audioCodecString = 'opus';
                  muxAudioCodec = 'opus';
                }
              } catch {
                // Continue video-only if no audio encoder
              }
            }
          }

          return {
            container: 'mp4',
            videoCodecString: avc,
            muxVideoCodec: 'avc',
            audioCodecString,
            muxAudioCodec,
            mimeType: 'video/mp4',
            codecLabel: audioCodecString
              ? `H.264 (${avc}) + ${muxAudioCodec?.toUpperCase()}`
              : `H.264 (${avc}) Video`,
          };
        }
      } catch {
        // Try next candidate
      }
    }
  }

  // WebM fallback (explicit WebM choice or platform without H.264 WebCodecs)
  for (const vp of VP9_CANDIDATES) {
    try {
      const res = await VideoEncoder.isConfigSupported({
        codec: vp,
        width: settings.width,
        height: settings.height,
        bitrate: settings.videoBitrateBps,
        framerate: settings.fps,
      });
      if (res.supported) {
        let audioCodecString: string | null = null;
        let muxAudioCodec: 'A_OPUS' | null = null;
        if (settings.audioEnabled && typeof AudioEncoder !== 'undefined') {
          try {
            const opus = await AudioEncoder.isConfigSupported({
              codec: 'opus',
              sampleRate: 48000,
              numberOfChannels: 2,
              bitrate: settings.audioBitrateBps,
            });
            if (opus.supported) {
              audioCodecString = 'opus';
              muxAudioCodec = 'A_OPUS';
            }
          } catch {
            // No audio encoder
          }
        }
        const isVp8 = vp === 'vp8';
        return {
          container: 'webm',
          videoCodecString: vp,
          muxVideoCodec: isVp8 ? 'V_VP8' : 'V_VP9',
          audioCodecString,
          muxAudioCodec,
          mimeType: 'video/webm',
          codecLabel: audioCodecString
            ? `${isVp8 ? 'VP8' : 'VP9'} + Opus`
            : `${isVp8 ? 'VP8' : 'VP9'} Video`,
        };
      }
    } catch {
      // Try next
    }
  }

  return null;
}

export function createMuxerForConfig(
  codecCfg: SelectedCodecConfig,
  settings: RenderSettings
) {
  if (codecCfg.container === 'mp4') {
    const target = new Mp4ArrayBufferTarget();
    const muxer = new Mp4Muxer({
      target,
      video: {
        codec: 'avc',
        width: settings.width,
        height: settings.height,
        frameRate: settings.fps,
      },
      audio: codecCfg.muxAudioCodec
        ? {
            codec: codecCfg.muxAudioCodec as 'aac' | 'opus',
            numberOfChannels: 2,
            sampleRate: 48000,
          }
        : undefined,
      fastStart: 'in-memory',
      firstTimestampBehavior: 'offset',
    });
    return {
      container: 'mp4' as const,
      addVideoChunk: (chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata) =>
        muxer.addVideoChunk(chunk, meta),
      addAudioChunk: (chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata) =>
        muxer.addAudioChunk(chunk, meta),
      finalizeBuffer: () => {
        muxer.finalize();
        return target.buffer;
      },
    };
  }

  const target = new WebmArrayBufferTarget();
  const muxer = new WebmMuxer({
    target,
    video: {
      codec: codecCfg.muxVideoCodec as 'V_VP9' | 'V_VP8',
      width: settings.width,
      height: settings.height,
      frameRate: settings.fps,
    },
    audio: codecCfg.muxAudioCodec
      ? {
          codec: 'A_OPUS',
          numberOfChannels: 2,
          sampleRate: 48000,
        }
      : undefined,
    firstTimestampBehavior: 'offset',
  });
  return {
    container: 'webm' as const,
    addVideoChunk: (chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata) =>
      muxer.addVideoChunk(chunk, meta),
    addAudioChunk: (chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata) =>
      muxer.addAudioChunk(chunk, meta),
    finalizeBuffer: () => {
      muxer.finalize();
      return target.buffer;
    },
  };
}

export interface ServerRenderCapabilities {
  ffmpegAvailable: boolean;
  ffprobeAvailable: boolean;
  aacSupported: boolean;
  h264CopySupported: boolean;
  ffmpegVersion: string | null;
}

export async function probeServerRenderCapabilities(): Promise<ServerRenderCapabilities> {
  if (typeof fetch === 'undefined') {
    return {
      ffmpegAvailable: false,
      ffprobeAvailable: false,
      aacSupported: false,
      h264CopySupported: false,
      ffmpegVersion: null,
    };
  }

  const ctrl = new AbortController();
  const timer = globalThis.setTimeout(() => ctrl.abort(), 2500);
  try {
    const res = await fetch('/api/render/capabilities', { signal: ctrl.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = (await res.json()) as Partial<ServerRenderCapabilities>;
    return {
      ffmpegAvailable: Boolean(data.ffmpegAvailable),
      ffprobeAvailable: Boolean(data.ffprobeAvailable),
      aacSupported: Boolean(data.aacSupported),
      h264CopySupported: Boolean(data.h264CopySupported),
      ffmpegVersion: typeof data.ffmpegVersion === 'string' ? data.ffmpegVersion : null,
    };
  } catch {
    return {
      ffmpegAvailable: false,
      ffprobeAvailable: false,
      aacSupported: false,
      h264CopySupported: false,
      ffmpegVersion: null,
    };
  } finally {
    globalThis.clearTimeout(timer);
  }
}

export interface RawVideoChunkPacket {
  data: ArrayBuffer;
  type: 'key' | 'delta';
  timestampUs: number;
  durationUs: number;
  decoderConfig?: VideoDecoderConfig;
}

export interface RawAudioChunkPacket {
  data: ArrayBuffer;
  type: 'key' | 'delta';
  timestampUs: number;
  durationUs: number;
  decoderConfig?: AudioDecoderConfig;
}

export interface RawChunkSegmentPayload {
  segmentIndex: number;
  startSec: number;
  videoChunks: RawVideoChunkPacket[];
  audioChunks: RawAudioChunkPacket[];
}

export function assembleMp4FromRawSegments(
  segments: RawChunkSegmentPayload[],
  codecCfg: SelectedCodecConfig,
  settings: RenderSettings
): ArrayBuffer {
  const ordered = [...segments].sort((a, b) => a.segmentIndex - b.segmentIndex);
  const target = new Mp4ArrayBufferTarget();
  const muxer = new Mp4Muxer({
    target,
    video: {
      codec: 'avc',
      width: settings.width,
      height: settings.height,
      frameRate: settings.fps,
    },
    audio: codecCfg.muxAudioCodec
      ? {
          codec: codecCfg.muxAudioCodec as 'aac' | 'opus',
          numberOfChannels: 2,
          sampleRate: 48000,
        }
      : undefined,
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });

  let sentVideoDecoderConfig = false;
  let sentAudioDecoderConfig = false;

  for (const seg of ordered) {
    const offsetUs = Math.round(seg.startSec * 1_000_000);
    for (const vc of seg.videoChunks) {
      const meta: EncodedVideoChunkMetadata | undefined =
        !sentVideoDecoderConfig && vc.decoderConfig
          ? { decoderConfig: vc.decoderConfig }
          : undefined;
      if (meta) sentVideoDecoderConfig = true;
      muxer.addVideoChunkRaw(
        new Uint8Array(vc.data),
        vc.type,
        offsetUs + vc.timestampUs,
        vc.durationUs,
        meta
      );
    }

    if (codecCfg.muxAudioCodec) {
      for (const ac of seg.audioChunks) {
        const meta: EncodedAudioChunkMetadata | undefined =
          !sentAudioDecoderConfig && ac.decoderConfig
            ? { decoderConfig: ac.decoderConfig }
            : undefined;
        if (meta) sentAudioDecoderConfig = true;
        muxer.addAudioChunkRaw(
          new Uint8Array(ac.data),
          ac.type,
          offsetUs + ac.timestampUs,
          ac.durationUs,
          meta
        );
      }
    }
  }

  muxer.finalize();
  return target.buffer;
}

/**
 * Future Server / Cloud FFmpeg Renderer integration payload builder.
 * Serializes the exact deterministic project & render settings without changing project state semantics.
 */
export interface CloudRenderJobPayload {
  apiVersion: 1;
  project: CricketProject;
  renderSettings: RenderSettings;
  requestedAt: string;
}

export function buildCloudRenderJobPayload(
  project: CricketProject,
  settings: RenderSettings
): CloudRenderJobPayload {
  return {
    apiVersion: 1,
    project,
    renderSettings: settings,
    requestedAt: new Date().toISOString(),
  };
}
