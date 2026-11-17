export interface RenderSegmentPlan {
  segmentIndex: number;
  totalSegments: number;
  startFrame: number;
  endFrame: number; // exclusive
  frameCount: number;
  startSec: number;
  endSec: number;
  durationSec: number;
}

export const DEFAULT_SEGMENT_DURATION_SEC = 20;

/**
 * Splits a deterministic video timeline into fixed-length segments aligned to exact frame boundaries.
 * Short exports (<= segmentDurationSec + 5s) remain a single segment to avoid unnecessary split overhead.
 */
export function planRenderSegments(
  durationSec: number,
  fps: 30 | 60,
  segmentDurationSec = DEFAULT_SEGMENT_DURATION_SEC
): RenderSegmentPlan[] {
  const safeDuration = Math.max(1, durationSec);
  const totalFrames = Math.max(1, Math.round(safeDuration * fps));
  const safeSegSec = Math.max(4, segmentDurationSec);

  if (safeDuration <= safeSegSec + 5) {
    return [
      {
        segmentIndex: 0,
        totalSegments: 1,
        startFrame: 0,
        endFrame: totalFrames,
        frameCount: totalFrames,
        startSec: 0,
        endSec: totalFrames / fps,
        durationSec: totalFrames / fps,
      },
    ];
  }

  const framesPerSegment = Math.max(fps * 2, Math.round(safeSegSec * fps));
  const segments: RenderSegmentPlan[] = [];
  let startFrame = 0;

  while (startFrame < totalFrames) {
    const remaining = totalFrames - startFrame;
    // Merge tiny trailing tail (< 3s) into current final segment so every segment has solid GOP/audio framing
    const take = remaining <= framesPerSegment + fps * 3 ? remaining : framesPerSegment;
    const endFrame = startFrame + take;
    const startSec = startFrame / fps;
    const endSec = endFrame / fps;
    segments.push({
      segmentIndex: segments.length,
      totalSegments: 0, // filled below
      startFrame,
      endFrame,
      frameCount: take,
      startSec,
      endSec,
      durationSec: endSec - startSec,
    });
    startFrame = endFrame;
  }

  const totalSegments = segments.length;
  for (const seg of segments) {
    seg.totalSegments = totalSegments;
  }
  return segments;
}

/**
 * Computes conservative worker pool size based on hardware concurrency and resolution.
 */
export function resolveWorkerConcurrency(
  segmentCount: number,
  width: number,
  height: number,
  hardwareConcurrency = 2
): number {
  if (segmentCount <= 1) return 1;
  const is1080OrHigher = width * height >= 1920 * 1080;
  const maxByCpu = Math.max(1, Math.min(is1080OrHigher ? 2 : 3, Math.floor(hardwareConcurrency / 2) || 1));
  return Math.min(segmentCount, maxByCpu);
}
