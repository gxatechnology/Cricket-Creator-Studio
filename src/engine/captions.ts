import type { CricketProject, TimelineClip, VoiceoverSegment } from '../types/studio';

export interface CaptionWindow {
  id: string;
  startSec: number;
  endSec: number;
  text: string;
}

export function resolveVoiceoverCaptionWindows(
  segments: VoiceoverSegment[],
  clips: TimelineClip[]
): CaptionWindow[] {
  const clipById = new Map<string, TimelineClip>();
  for (const c of clips) {
    clipById.set(c.id, c);
  }

  const windows: CaptionWindow[] = [];
  let cursor = 0;

  for (const seg of segments) {
    const rawText = (seg.captionText ?? seg.text ?? '').trim();
    if (!rawText) continue;

    let startSec: number;
    let endSec: number;

    if (
      typeof seg.startSec === 'number' &&
      typeof seg.endSec === 'number' &&
      seg.endSec > seg.startSec
    ) {
      startSec = Math.max(0, seg.startSec);
      endSec = seg.endSec;
    } else {
      const matched = seg.sceneClipId ? clipById.get(seg.sceneClipId) : undefined;
      if (matched) {
        startSec = matched.startSec;
        endSec = matched.startSec + matched.durationSec;
      } else {
        const dur = Math.max(1.5, seg.estimatedDurationSec || 3.5);
        startSec = cursor;
        endSec = cursor + dur;
      }
    }

    cursor = Math.max(cursor, endSec);
    windows.push({
      id: seg.id,
      startSec: Math.round(startSec * 100) / 100,
      endSec: Math.round(endSec * 100) / 100,
      text: rawText,
    });
  }

  return windows.sort((a, b) => a.startSec - b.startSec);
}

export function getActiveCaptionAtTime(
  windows: CaptionWindow[],
  timeSec: number
): string | null {
  for (const w of windows) {
    if (timeSec >= w.startSec && timeSec < w.endSec) {
      return w.text;
    }
  }
  return null;
}

export function formatSrtTimestamp(seconds: number): string {
  const safeMs = Math.max(0, Math.round(seconds * 1000));
  const hrs = Math.floor(safeMs / 3_600_000);
  const mins = Math.floor((safeMs % 3_600_000) / 60_000);
  const secs = Math.floor((safeMs % 60_000) / 1000);
  const ms = safeMs % 1000;
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const pad3 = (n: number) => String(n).padStart(3, '0');
  return `${pad2(hrs)}:${pad2(mins)}:${pad2(secs)},${pad3(ms)}`;
}

export function generateSrtFromProject(project: CricketProject): string {
  const windows = resolveVoiceoverCaptionWindows(
    project.voiceoverSegments ?? [],
    project.timelineClips ?? []
  );
  if (windows.length === 0) {
    return '1\n00:00:00,000 --> 00:00:03,000\nCricket Creator Studio Episode\n';
  }
  return windows
    .map(
      (w, idx) =>
        `${idx + 1}\n${formatSrtTimestamp(w.startSec)} --> ${formatSrtTimestamp(w.endSec)}\n${w.text}`
    )
    .join('\n\n')
    .concat('\n');
}
