import type { AudioCategory, CricketProject, TimelineClip } from '../types/studio';
import { resolveAssetBlob } from '../engine/assetBlobStore';
import { DEFAULT_TIMELINE_TRACKS, resolveAudioClipGain } from '../engine/timeline';
import type {
  AssetPreflightEntry,
  AssetPreflightReport,
  RenderSettings,
} from './rendererTypes';

export interface MixedAudioResult {
  sampleRate: number;
  numberOfChannels: number;
  leftChannel: Float32Array;
  rightChannel: Float32Array;
  durationSec: number;
  peakBeforeNormalize: number;
  normalizedApplied: boolean;
  warnings: string[];
}

export async function runAssetPreflight(
  project: CricketProject
): Promise<AssetPreflightReport> {
  const entries: AssetPreflightEntry[] = [];

  if (project.brandKit?.logoAssetId) {
    const logoAsset = project.assets?.find(
      (a) => a.id === project.brandKit.logoAssetId
    );
    if (!logoAsset) {
      entries.push({
        id: project.brandKit.logoAssetId,
        name: `Logo (${project.brandKit.logoAssetId})`,
        kind: 'logo',
        ready: false,
        reason: 'Referenced brand logo asset record is missing.',
      });
    } else {
      const blob = await resolveAssetBlob(logoAsset);
      entries.push({
        id: logoAsset.id,
        name: logoAsset.name,
        kind: 'logo',
        ready: blob !== null,
        reason: blob ? undefined : 'Logo blob could not be resolved from storage.',
      });
    }
  }

  for (const asset of project.assets ?? []) {
    if (asset.id === project.brandKit?.logoAssetId) continue;
    const blob = await resolveAssetBlob(asset);
    entries.push({
      id: asset.id,
      name: asset.name,
      kind: 'image',
      ready: blob !== null,
      reason: blob ? undefined : 'Asset blob missing from storage.',
    });
  }

  const audioMap = new Map((project.audioAssets ?? []).map((a) => [a.id, a]));
  const checkedAudioIds = new Set<string>();
  for (const clip of project.timelineClips ?? []) {
    if (!clip.audioAssetId || checkedAudioIds.has(clip.audioAssetId)) continue;
    checkedAudioIds.add(clip.audioAssetId);
    const audioAsset = audioMap.get(clip.audioAssetId);
    if (!audioAsset) {
      entries.push({
        id: clip.audioAssetId,
        name: `${clip.name} (${clip.audioAssetId})`,
        kind: 'audio',
        ready: false,
        reason: 'Timeline clip references a missing audio asset.',
      });
    } else {
      const blob = await resolveAssetBlob(audioAsset);
      entries.push({
        id: audioAsset.id,
        name: audioAsset.name,
        kind: 'audio',
        ready: blob !== null,
        reason: blob ? undefined : 'Audio file blob missing from IndexedDB.',
      });
    }
  }

  const missingNames = entries.filter((e) => !e.ready).map((e) => e.name);
  return {
    totalRequired: entries.length,
    readyCount: entries.length - missingNames.length,
    allReady: missingNames.length === 0,
    missingNames,
    entries,
  };
}

/**
 * Synthesizes procedural cricket broadcast audio buffers when a timeline SFX/music clip
 * does not have a user-uploaded AudioAsset attached, ensuring deterministic audio export.
 */
function buildProceduralClipSamples(
  category: AudioCategory | undefined,
  durationSec: number,
  sampleRate: number
): Float32Array {
  const length = Math.max(1, Math.floor(durationSec * sampleRate));
  const out = new Float32Array(length);

  if (category === 'countdown-tick') {
    const tickCount = Math.max(1, Math.floor(durationSec));
    for (let sec = 0; sec < tickCount; sec++) {
      const startSample = Math.floor(sec * sampleRate);
      const tickLen = Math.min(Math.floor(0.085 * sampleRate), length - startSample);
      const freq = sec === tickCount - 1 ? 1180 : 880;
      for (let i = 0; i < tickLen; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 42);
        out[startSample + i] += Math.sin(2 * Math.PI * freq * t) * env * 0.45;
      }
    }
    return out;
  }

  if (category === 'answer-correct' || category === 'transition') {
    const notes = category === 'answer-correct' ? [523.25, 659.25, 783.99] : [440, 587.33];
    const step = 0.09;
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      let val = 0;
      notes.forEach((freq, idx) => {
        const dt = t - idx * step;
        if (dt >= 0) {
          val += Math.sin(2 * Math.PI * freq * dt) * Math.exp(-dt * 6.5) * 0.25;
        }
      });
      out[i] = val;
    }
    return out;
  }

  if (category === 'answer-wrong') {
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t * 5);
      out[i] =
        (Math.sin(2 * Math.PI * 220 * t) + 0.5 * Math.sin(2 * Math.PI * 165 * t)) *
        env *
        0.25;
    }
    return out;
  }

  if (category === 'bat-hit' || category === 'ball-hit' || category === 'wicket') {
    const baseFreq = category === 'wicket' ? 190 : 320;
    for (let i = 0; i < Math.min(length, Math.floor(0.28 * sampleRate)); i++) {
      const t = i / sampleRate;
      const env = Math.exp(-t * 28);
      // Deterministic pseudo-noise + woody transient
      const noise = Math.sin(i * 12.9898) * 0.35;
      out[i] = (Math.sin(2 * Math.PI * baseFreq * t) * 0.65 + noise) * env * 0.55;
    }
    return out;
  }

  if (category === 'whoosh') {
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const p = t / Math.max(0.1, durationSec);
      const env = Math.sin(Math.PI * p);
      const sweep = 180 + p * 420;
      out[i] = Math.sin(2 * Math.PI * sweep * t) * env * 0.16;
    }
    return out;
  }

  if (category === 'music' || category === 'crowd' || category === 'cheer') {
    // Warm subtle broadcast underscore chord (C-G-D fifths)
    const freqs = category === 'music' ? [130.81, 196.0, 293.66] : [164.81, 246.94];
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      let s = 0;
      for (const f of freqs) {
        s += Math.sin(2 * Math.PI * f * t) * 0.045;
      }
      out[i] = s * (0.85 + 0.15 * Math.sin(2 * Math.PI * 0.5 * t));
    }
    return out;
  }

  return out;
}

export type DecodedAudioMap = Map<
  string,
  { left: Float32Array; right: Float32Array; sampleRate: number }
>;

interface PreparedAudioClip {
  clip: TimelineClip;
  track: ReturnType<typeof DEFAULT_TIMELINE_TRACKS.find>;
  startSample: number;
  endSample: number;
  srcLeft: Float32Array;
  srcRight: Float32Array;
  srcLen: number;
}

function buildPreparedAudioClips(
  clips: TimelineClip[],
  tracks: CricketProject['timelineTracks'],
  mix: CricketProject['audioMix'],
  decodedBuffersByAssetId: DecodedAudioMap,
  durationSec: number,
  sampleRate: number
): { prepared: PreparedAudioClip[]; warnings: string[] } {
  const warnings: string[] = [];
  if (mix.masterMuted) {
    return {
      prepared: [],
      warnings: ['Master audio is muted; exporting silent audio track.'],
    };
  }

  const totalSamples = Math.max(sampleRate, Math.ceil(durationSec * sampleRate));
  const trackMap = new Map((tracks ?? DEFAULT_TIMELINE_TRACKS).map((t) => [t.id, t]));
  const audioClips = clips.filter(
    (c) => c.trackId === 'voiceover' || c.trackId === 'music' || c.trackId === 'sfx'
  );

  // Cache procedural buffers by category+duration so repeated SFX cues share read-only memory
  const proceduralCache = new Map<string, Float32Array>();
  const prepared: PreparedAudioClip[] = [];

  for (const clip of audioClips) {
    const track = trackMap.get(clip.trackId);
    if (clip.muted || track?.muted) continue;

    const startSample = Math.max(0, Math.floor(clip.startSec * sampleRate));
    if (startSample >= totalSamples) continue;

    const clipEndSec = clip.startSec + clip.durationSec;
    if (clipEndSec > durationSec + 0.25) {
      warnings.push(`Clip "${clip.name}" extends past timeline end and was trimmed.`);
    }

    const endSample = Math.min(totalSamples, Math.floor(clipEndSec * sampleRate));
    const clipSampleLen = endSample - startSample;
    if (clipSampleLen <= 0) continue;

    const uploaded = clip.audioAssetId
      ? decodedBuffersByAssetId.get(clip.audioAssetId)
      : undefined;

    if (clip.audioAssetId && !uploaded) {
      warnings.push(
        `Missing decoded audio for "${clip.name}"; using procedural broadcast cue.`
      );
    }

    let srcLeft: Float32Array;
    let srcRight: Float32Array;
    if (uploaded) {
      srcLeft = uploaded.left;
      srcRight = uploaded.right;
      if (srcLeft.length < clipSampleLen && !clip.loop) {
        warnings.push(`Audio "${clip.name}" is shorter than clip duration (${clip.durationSec}s).`);
      }
    } else {
      const cat = clip.audioCategory ?? (clip.trackId === 'music' ? 'music' : 'whoosh');
      const procDur = clip.loop ? Math.min(4, Math.max(0.5, clip.durationSec)) : clip.durationSec;
      const cacheKey = `${cat}|${procDur.toFixed(3)}|${sampleRate}`;
      let cached = proceduralCache.get(cacheKey);
      if (!cached) {
        cached = buildProceduralClipSamples(cat, procDur, sampleRate);
        proceduralCache.set(cacheKey, cached);
      }
      srcLeft = cached;
      srcRight = cached;
    }

    prepared.push({
      clip,
      track,
      startSample,
      endSample,
      srcLeft,
      srcRight,
      srcLen: srcLeft.length,
    });
  }

  return { prepared, warnings: Array.from(new Set(warnings)) };
}

function renderPreparedClipsIntoWindow(
  prepared: PreparedAudioClip[],
  mix: CricketProject['audioMix'],
  windowStartSample: number,
  windowLength: number,
  sampleRate: number,
  outLeft: Float32Array,
  outRight: Float32Array
) {
  outLeft.fill(0, 0, windowLength);
  outRight.fill(0, 0, windowLength);
  const windowEndSample = windowStartSample + windowLength;

  for (const item of prepared) {
    if (item.endSample <= windowStartSample || item.startSample >= windowEndSample) {
      continue;
    }
    const overlapStart = Math.max(windowStartSample, item.startSample);
    const overlapEnd = Math.min(windowEndSample, item.endSample);
    const { clip, track, startSample, srcLeft, srcRight, srcLen } = item;

    for (let globalIdx = overlapStart; globalIdx < overlapEnd; globalIdx++) {
      const clipLocalSample = globalIdx - startSample;
      const srcIdx = clip.loop ? clipLocalSample % srcLen : clipLocalSample;
      if (srcIdx >= srcLen) break;

      const tSec = globalIdx / sampleRate;
      const gain = resolveAudioClipGain(clip, tSec, track, mix);
      if (gain <= 0) continue;

      const outIdx = globalIdx - windowStartSample;
      outLeft[outIdx] += srcLeft[srcIdx] * gain;
      outRight[outIdx] += srcRight[srcIdx] * gain;
    }
  }
}

/**
 * Pure deterministic sample-by-sample stereo mixer using resolveAudioClipGain()
 * and peak normalization. Safe to run in unit tests (Node) and browser renders.
 */
export function mixDecodedAudioTracks(
  clips: TimelineClip[],
  tracks: CricketProject['timelineTracks'],
  mix: CricketProject['audioMix'],
  decodedBuffersByAssetId: DecodedAudioMap,
  durationSec: number,
  sampleRate: number,
  normalizeAudio: boolean
): MixedAudioResult {
  const totalSamples = Math.max(sampleRate, Math.ceil(durationSec * sampleRate));
  const left = new Float32Array(totalSamples);
  const right = new Float32Array(totalSamples);

  const { prepared, warnings } = buildPreparedAudioClips(
    clips,
    tracks,
    mix,
    decodedBuffersByAssetId,
    durationSec,
    sampleRate
  );

  if (mix.masterMuted) {
    return {
      sampleRate,
      numberOfChannels: 2,
      leftChannel: left,
      rightChannel: right,
      durationSec,
      peakBeforeNormalize: 0,
      normalizedApplied: false,
      warnings,
    };
  }

  renderPreparedClipsIntoWindow(prepared, mix, 0, totalSamples, sampleRate, left, right);

  let peak = 0;
  for (let i = 0; i < totalSamples; i++) {
    const absL = Math.abs(left[i]);
    const absR = Math.abs(right[i]);
    if (absL > peak) peak = absL;
    if (absR > peak) peak = absR;
  }

  let normalizedApplied = false;
  if (peak > 0.0001) {
    if (normalizeAudio) {
      const targetPeak = 0.891;
      const scale = Math.min(4, targetPeak / peak);
      for (let i = 0; i < totalSamples; i++) {
        left[i] = Math.max(-0.98, Math.min(0.98, left[i] * scale));
        right[i] = Math.max(-0.98, Math.min(0.98, right[i] * scale));
      }
      normalizedApplied = true;
    } else if (peak > 0.98) {
      const limiterScale = 0.96 / peak;
      warnings.push('Audio mix exceeded 0 dBFS; soft limiter prevented clipping.');
      for (let i = 0; i < totalSamples; i++) {
        left[i] *= limiterScale;
        right[i] *= limiterScale;
      }
    }
  }

  return {
    sampleRate,
    numberOfChannels: 2,
    leftChannel: left,
    rightChannel: right,
    durationSec,
    peakBeforeNormalize: Math.round(peak * 1000) / 1000,
    normalizedApplied,
    warnings: Array.from(new Set(warnings)),
  };
}

/**
 * Estimates the exact global peak & gain scale across an arbitrarily long episode
 * using a fixed 4-second scratch buffer (~1.5 MB) instead of allocating full-episode PCM arrays.
 */
export function estimateMixNormalizationScale(
  clips: TimelineClip[],
  tracks: CricketProject['timelineTracks'],
  mix: CricketProject['audioMix'],
  decodedBuffersByAssetId: DecodedAudioMap,
  durationSec: number,
  sampleRate: number,
  normalizeAudio: boolean
): { scale: number; peakBeforeNormalize: number; normalizedApplied: boolean; warnings: string[] } {
  const { prepared, warnings } = buildPreparedAudioClips(
    clips,
    tracks,
    mix,
    decodedBuffersByAssetId,
    durationSec,
    sampleRate
  );

  if (mix.masterMuted || prepared.length === 0) {
    return { scale: 1, peakBeforeNormalize: 0, normalizedApplied: false, warnings };
  }

  const totalSamples = Math.max(sampleRate, Math.ceil(durationSec * sampleRate));
  const windowSamples = sampleRate * 4;
  const scratchL = new Float32Array(windowSamples);
  const scratchR = new Float32Array(windowSamples);
  let peak = 0;

  for (let start = 0; start < totalSamples; start += windowSamples) {
    const len = Math.min(windowSamples, totalSamples - start);
    renderPreparedClipsIntoWindow(prepared, mix, start, len, sampleRate, scratchL, scratchR);
    for (let i = 0; i < len; i++) {
      const aL = Math.abs(scratchL[i]);
      const aR = Math.abs(scratchR[i]);
      if (aL > peak) peak = aL;
      if (aR > peak) peak = aR;
    }
  }

  let scale = 1;
  let normalizedApplied = false;
  if (peak > 0.0001) {
    if (normalizeAudio) {
      scale = Math.min(4, 0.891 / peak);
      normalizedApplied = true;
    } else if (peak > 0.98) {
      scale = 0.96 / peak;
      warnings.push('Audio mix exceeded 0 dBFS; soft limiter prevented clipping.');
    }
  }

  return {
    scale,
    peakBeforeNormalize: Math.round(peak * 1000) / 1000,
    normalizedApplied,
    warnings: Array.from(new Set(warnings)),
  };
}

/**
 * Mixes ONLY the audio samples belonging to [startSec, endSec) while applying the global gain scale.
 * Keeps peak audio RAM proportional to one 20-second segment (~7.6 MB) instead of the entire video.
 */
export function mixAudioSegmentRange(
  clips: TimelineClip[],
  tracks: CricketProject['timelineTracks'],
  mix: CricketProject['audioMix'],
  decodedBuffersByAssetId: DecodedAudioMap,
  startSec: number,
  endSec: number,
  totalDurationSec: number,
  sampleRate: number,
  gainScale = 1
): { leftChannel: Float32Array; rightChannel: Float32Array; warnings: string[] } {
  const safeStartSec = Math.max(0, startSec);
  const safeEndSec = Math.max(safeStartSec + 0.01, endSec);
  const startSample = Math.round(safeStartSec * sampleRate);
  const endSample = Math.max(startSample + 1, Math.round(safeEndSec * sampleRate));
  const segLen = endSample - startSample;
  const left = new Float32Array(segLen);
  const right = new Float32Array(segLen);

  const { prepared, warnings } = buildPreparedAudioClips(
    clips,
    tracks,
    mix,
    decodedBuffersByAssetId,
    totalDurationSec,
    sampleRate
  );

  if (mix.masterMuted || prepared.length === 0) {
    return { leftChannel: left, rightChannel: right, warnings };
  }

  renderPreparedClipsIntoWindow(prepared, mix, startSample, segLen, sampleRate, left, right);

  if (gainScale !== 1) {
    for (let i = 0; i < segLen; i++) {
      left[i] = Math.max(-0.98, Math.min(0.98, left[i] * gainScale));
      right[i] = Math.max(-0.98, Math.min(0.98, right[i] * gainScale));
    }
  }

  return { leftChannel: left, rightChannel: right, warnings };
}

export async function prepareDecodedAudioAssets(
  project: CricketProject,
  sampleRate = 48000
): Promise<{ decodedMap: DecodedAudioMap; warnings: string[] }> {
  const decodedMap: DecodedAudioMap = new Map();
  const decodeWarnings: string[] = [];

  const audioAssets = project.audioAssets ?? [];
  if (audioAssets.length > 0 && typeof OfflineAudioContext !== 'undefined') {
    const decodeCtx = new OfflineAudioContext(2, sampleRate, sampleRate);
    for (const asset of audioAssets) {
      try {
        const blob = await resolveAssetBlob(asset);
        if (!blob) continue;
        const buf = await blob.arrayBuffer();
        const decoded = await decodeCtx.decodeAudioData(buf);
        const ch0 = decoded.getChannelData(0);
        const ch1 = decoded.numberOfChannels > 1 ? decoded.getChannelData(1) : ch0;

        if (decoded.sampleRate !== sampleRate) {
          const targetLen = Math.max(1, Math.ceil(decoded.duration * sampleRate));
          const resampler = new OfflineAudioContext(2, targetLen, sampleRate);
          const srcNode = resampler.createBufferSource();
          srcNode.buffer = decoded;
          srcNode.connect(resampler.destination);
          srcNode.start(0);
          const rendered = await resampler.startRendering();
          decodedMap.set(asset.id, {
            left: new Float32Array(rendered.getChannelData(0)),
            right: new Float32Array(rendered.getChannelData(1)),
            sampleRate,
          });
        } else {
          decodedMap.set(asset.id, {
            left: new Float32Array(ch0),
            right: new Float32Array(ch1),
            sampleRate,
          });
        }
      } catch {
        decodeWarnings.push(`Audio decode failed for "${asset.name}"; using fallback cue.`);
      }
    }
  }

  return { decodedMap, warnings: decodeWarnings };
}

export function synthesizeProjectAudioSegment(
  project: CricketProject,
  startSec: number,
  endSec: number,
  totalDurationSec: number,
  settings: Pick<RenderSettings, 'audioEnabled' | 'normalizeAudio'>,
  decodedMap: DecodedAudioMap,
  gainScale = 1,
  sampleRate = 48000
): MixedAudioResult {
  const segDurationSec = Math.max(0.01, endSec - startSec);
  if (!settings.audioEnabled) {
    const emptyLen = Math.max(1, Math.round(segDurationSec * sampleRate));
    return {
      sampleRate,
      numberOfChannels: 2,
      leftChannel: new Float32Array(emptyLen),
      rightChannel: new Float32Array(emptyLen),
      durationSec: segDurationSec,
      peakBeforeNormalize: 0,
      normalizedApplied: false,
      warnings: [],
    };
  }

  const seg = mixAudioSegmentRange(
    project.timelineClips ?? [],
    project.timelineTracks ?? DEFAULT_TIMELINE_TRACKS,
    project.audioMix,
    decodedMap,
    startSec,
    endSec,
    totalDurationSec,
    sampleRate,
    gainScale
  );

  return {
    sampleRate,
    numberOfChannels: 2,
    leftChannel: seg.leftChannel,
    rightChannel: seg.rightChannel,
    durationSec: segDurationSec,
    peakBeforeNormalize: 0,
    normalizedApplied: settings.normalizeAudio,
    warnings: seg.warnings,
  };
}

export async function synthesizeProjectAudioMix(
  project: CricketProject,
  durationSec: number,
  settings: Pick<RenderSettings, 'audioEnabled' | 'normalizeAudio'>
): Promise<MixedAudioResult> {
  const sampleRate = 48000;
  if (!settings.audioEnabled) {
    const emptyLen = Math.max(sampleRate, Math.ceil(durationSec * sampleRate));
    return {
      sampleRate,
      numberOfChannels: 2,
      leftChannel: new Float32Array(emptyLen),
      rightChannel: new Float32Array(emptyLen),
      durationSec,
      peakBeforeNormalize: 0,
      normalizedApplied: false,
      warnings: [],
    };
  }

  const { decodedMap, warnings: decodeWarnings } = await prepareDecodedAudioAssets(
    project,
    sampleRate
  );

  const mixed = mixDecodedAudioTracks(
    project.timelineClips ?? [],
    project.timelineTracks ?? DEFAULT_TIMELINE_TRACKS,
    project.audioMix,
    decodedMap,
    durationSec,
    sampleRate,
    settings.normalizeAudio
  );

  decodedMap.clear();

  return {
    ...mixed,
    warnings: Array.from(new Set([...decodeWarnings, ...mixed.warnings])),
  };
}
