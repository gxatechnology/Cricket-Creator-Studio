import type {
  AudioMixSettings,
  BroadcastGraphicOverlay,
  CricketProject,
  PreviewSequenceMode,
  QuizQuestion,
  TimelineClip,
  TimelineTrack,
  TimelineTrackId,
  TransitionType,
} from '../types/studio';
import { BallEvaluation, evaluateBallPathAtProgress } from './cricketField';
import { getActiveCaptionAtTime, resolveVoiceoverCaptionWindows } from './captions';

export const QUIZ_QUESTION_COUNT = 30;
export const MAX_QUIZ_QUESTIONS = 100;
export const FIELD_INTRO_HOLD_SEC = 1.2;
export const FIELD_OUTRO_HOLD_SEC = 1.2;
export const QUIZ_REVEAL_SEC = 3.5;
export const QUIZ_PROMPT_LEAD_IN_SEC = 1.0;

export const DEFAULT_TIMELINE_TRACKS: TimelineTrack[] = [
  { id: 'video', label: 'VIDEO / SCENES', muted: false, locked: false },
  { id: 'graphics', label: 'TEXT / GRAPHICS', muted: false, locked: false },
  { id: 'quiz', label: 'QUIZ', muted: false, locked: false },
  { id: 'field', label: 'FIELD ANIMATION', muted: false, locked: false },
  { id: 'voiceover', label: 'VOICEOVER', muted: false, locked: false },
  { id: 'music', label: 'MUSIC', muted: false, locked: false },
  { id: 'sfx', label: 'SFX', muted: false, locked: false },
];

export function isQuizQuestionComplete(q: QuizQuestion): boolean {
  const hasPrompt = q.prompt.trim().length > 0;
  const hasAllOptions = q.options.every((opt) => opt.trim().length > 0);
  const hasValidCountdown = Number.isFinite(q.countdownSec) && q.countdownSec >= 3;
  return hasPrompt && hasAllOptions && hasValidCountdown;
}

export function countCompleteQuestions(questions: QuizQuestion[]): number {
  return questions.filter(isQuizQuestionComplete).length;
}

export function snapTimeToGrid(timeSec: number, snapSec = 0.5): number {
  if (snapSec <= 0) return Math.max(0, Math.round(timeSec * 100) / 100);
  return Math.max(0, Math.round(timeSec / snapSec) * snapSec);
}

export function sortClips(clips: TimelineClip[]): TimelineClip[] {
  return [...clips].sort((a, b) => {
    if (a.startSec !== b.startSec) return a.startSec - b.startSec;
    return a.trackId.localeCompare(b.trackId);
  });
}

export function computeTimelineTotalDuration(clips: TimelineClip[]): number {
  if (clips.length === 0) return 0;
  let maxEnd = 0;
  for (const clip of clips) {
    const end = clip.startSec + clip.durationSec;
    if (end > maxEnd) maxEnd = end;
  }
  return Math.round(maxEnd * 10) / 10;
}

export function splitClipAtTime(
  clip: TimelineClip,
  splitTimeSec: number
): [TimelineClip, TimelineClip] | null {
  const minPart = 0.5;
  if (
    splitTimeSec <= clip.startSec + minPart ||
    splitTimeSec >= clip.startSec + clip.durationSec - minPart
  ) {
    return null;
  }
  const firstDur = Math.round((splitTimeSec - clip.startSec) * 10) / 10;
  const secondDur = Math.round((clip.durationSec - firstDur) * 10) / 10;
  const first: TimelineClip = {
    ...clip,
    durationSec: firstDur,
  };
  const second: TimelineClip = {
    ...clip,
    id: `${clip.id}-part-${Date.now().toString(36)}`,
    name: `${clip.name} (2)`,
    startSec: Math.round(splitTimeSec * 10) / 10,
    durationSec: secondDur,
  };
  return [first, second];
}

export function duplicateClip(clip: TimelineClip): TimelineClip {
  return {
    ...clip,
    id: `clip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: `${clip.name} Copy`,
    startSec: Math.round((clip.startSec + clip.durationSec) * 10) / 10,
  };
}

export function resolveAudioClipGain(
  clip: TimelineClip,
  timeSec: number,
  track: TimelineTrack | undefined,
  mix: AudioMixSettings
): number {
  if (mix.masterMuted || clip.muted || track?.muted) return 0;
  if (timeSec < clip.startSec || timeSec > clip.startSec + clip.durationSec) return 0;

  const baseVolume = clip.volume ?? 1;
  const categoryScale =
    clip.trackId === 'voiceover'
      ? mix.voiceVolume
      : clip.trackId === 'music'
      ? mix.musicVolume
      : mix.sfxVolume;

  const localT = timeSec - clip.startSec;
  const remaining = clip.durationSec - localT;

  let fadeFactor = 1;
  if (clip.fadeInSec && clip.fadeInSec > 0 && localT < clip.fadeInSec) {
    fadeFactor = Math.min(fadeFactor, localT / clip.fadeInSec);
  }
  if (clip.fadeOutSec && clip.fadeOutSec > 0 && remaining < clip.fadeOutSec) {
    fadeFactor = Math.min(fadeFactor, remaining / clip.fadeOutSec);
  }

  return Math.max(0, Math.round(baseVolume * categoryScale * fadeFactor * 1000) / 1000);
}

export interface QuizSegmentTiming {
  question: QuizQuestion;
  startSec: number;
  countdownStartSec: number;
  countdownEndSec: number;
  endSec: number;
}

export function computeQuizTimeline(
  questions: QuizQuestion[],
  offsetSec = 0
): QuizSegmentTiming[] {
  const activeQuestions = questions.filter((q) => q.prompt.trim().length > 0);
  const list = activeQuestions.length > 0 ? activeQuestions : questions.slice(0, 1);

  let cursor = offsetSec;
  return list.map((question) => {
    const countdownSec = Math.max(3, Math.min(30, question.countdownSec || 10));
    const startSec = cursor;
    const countdownStartSec = startSec + QUIZ_PROMPT_LEAD_IN_SEC;
    const countdownEndSec = countdownStartSec + countdownSec;
    const endSec = countdownEndSec + QUIZ_REVEAL_SEC;
    cursor = endSec;
    return {
      question,
      startSec,
      countdownStartSec,
      countdownEndSec,
      endSec,
    };
  });
}

export function computeFieldSequenceDuration(project: CricketProject): number {
  const ballDur = Math.max(1.0, project.fieldDesign.ballPath.durationSec || 3.2);
  return Math.round((FIELD_INTRO_HOLD_SEC + ballDur + FIELD_OUTRO_HOLD_SEC) * 10) / 10;
}

export function computeSequenceDuration(
  project: CricketProject,
  mode: PreviewSequenceMode
): number {
  if (mode === 'timeline') {
    const clipDur = computeTimelineTotalDuration(project.timelineClips ?? []);
    if (clipDur > 0) return clipDur;
  }

  const fieldDur = computeFieldSequenceDuration(project);
  if (mode === 'field') return fieldDur;

  const quizOffset = mode === 'combined' || mode === 'timeline' ? fieldDur : 0;
  const segments = computeQuizTimeline(project.quizQuestions, quizOffset);
  if (segments.length === 0) return fieldDur;
  return Math.round(segments[segments.length - 1].endSec * 10) / 10;
}

export interface ActiveTransitionState {
  type: TransitionType;
  progress: number; // 0..1
  isEntering: boolean;
}

export interface RenderSceneState {
  timeSec: number;
  totalDurationSec: number;
  activeStage: 'intro' | 'field' | 'quiz' | 'cta' | 'outro';
  activeSceneClip: TimelineClip | null;
  activeFieldDesign: CricketProject['fieldDesign'];
  activeGraphics: BroadcastGraphicOverlay[];
  activeAudioClips: { clip: TimelineClip; gain: number }[];
  ballEval: BallEvaluation;
  activeTransition: ActiveTransitionState | null;
  activeCaption: string | null;
  quizState: {
    question: QuizQuestion;
    questionNumber: number;
    totalQuestions: number;
    phase: 'intro' | 'countdown' | 'reveal' | 'explanation';
    remainingSec: number;
    countdownProgress: number; // 0..1
  } | null;
}

export function resolveClipTransitionAtTime(
  clip: TimelineClip | null,
  timeSec: number,
  fallbackType: TransitionType = 'fade',
  fallbackDurationSec = 0.4
): ActiveTransitionState | null {
  if (!clip) return null;
  const type = clip.transitionType ?? (clip.type === 'transition' ? 'broadcast-wipe' : fallbackType);
  if (type === 'cut') return null;

  if (clip.type === 'transition') {
    const dur = Math.max(0.1, clip.durationSec);
    return {
      type,
      progress: Math.max(0, Math.min(1, (timeSec - clip.startSec) / dur)),
      isEntering: true,
    };
  }

  const dur = Math.min(
    clip.durationSec * 0.45,
    Math.max(0.15, clip.transitionDurationSec ?? fallbackDurationSec)
  );
  const localT = timeSec - clip.startSec;
  if (localT >= 0 && localT < dur) {
    return {
      type,
      progress: Math.max(0, Math.min(1, localT / dur)),
      isEntering: true,
    };
  }
  return null;
}

export interface TimelineEvaluator {
  totalDurationSec: number;
  evaluateAt: (rawTimeSec: number) => RenderSceneState;
}

function findActiveClipAtTime(sortedClips: TimelineClip[], t: number): TimelineClip | null {
  let lo = 0;
  let hi = sortedClips.length - 1;
  let candidateIdx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sortedClips[mid].startSec <= t) {
      candidateIdx = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  // Scan backwards from candidateIdx in case multiple overlapping clips share startSec <= t
  for (let i = candidateIdx; i >= 0; i--) {
    const c = sortedClips[i];
    if (t >= c.startSec && t < c.startSec + c.durationSec) {
      return c;
    }
    // Note: sortedClips can contain earlier long clips; only stop early if none exist before
  }
  return null;
}

/**
 * Pre-indexes timeline clips, caption windows, audio tracks, and graphics once per render/preview pass
 * so 10,000+ frame exports avoid re-sorting hundreds of clips on every frame while returning identical state.
 */
export function createTimelineEvaluator(
  project: CricketProject,
  mode: PreviewSequenceMode
): TimelineEvaluator {
  const totalDurationSec = computeSequenceDuration(project, mode);
  const fieldDur = computeFieldSequenceDuration(project);
  const ballDur = Math.max(1.0, project.fieldDesign.ballPath.durationSec || 3.2);

  const trackMap = new Map<TimelineTrackId, TimelineTrack>();
  for (const tr of project.timelineTracks ?? DEFAULT_TIMELINE_TRACKS) {
    trackMap.set(tr.id, tr);
  }

  const allClips = project.timelineClips ?? [];
  const audioClipsAll = allClips.filter(
    (c) => c.trackId === 'voiceover' || c.trackId === 'music' || c.trackId === 'sfx'
  );
  const enabledGraphics = (project.broadcastGraphics ?? []).filter((g) => g.enabled);

  const captionWindows =
    project.captionSettings?.enabled !== false
      ? resolveVoiceoverCaptionWindows(project.voiceoverSegments ?? [], allClips)
      : [];
  const captionsEnabled = Boolean(project.captionSettings?.enabled);
  const defaultTransType = project.defaultTransition?.type ?? 'fade';
  const defaultTransDur = project.defaultTransition?.durationSec ?? 0.4;

  const videoClips = sortClips(
    allClips.filter(
      (c) => c.trackId === 'video' || c.trackId === 'quiz' || c.trackId === 'field'
    )
  );
  const fieldClips = allClips.filter((c) => c.trackId === 'field');
  const quizClips = allClips.filter(
    (c) =>
      (c.trackId === 'quiz' || c.trackId === 'video') &&
      typeof c.questionIndex === 'number'
  );
  const quizSubClipsByQ = new Map<number, TimelineClip[]>();
  for (const c of allClips) {
    if (c.trackId === 'quiz' && typeof c.questionIndex === 'number') {
      const list = quizSubClipsByQ.get(c.questionIndex);
      if (list) list.push(c);
      else quizSubClipsByQ.set(c.questionIndex, [c]);
    }
  }
  const fieldSceneById = new Map(
    (project.fieldScenes ?? []).map((fs) => [fs.id, fs])
  );
  const completeQuizCount = Math.max(
    1,
    project.quizQuestions.filter((q) => q.prompt.trim().length > 0).length
  );
  const quizSegments = mode !== 'field' ? computeQuizTimeline(project.quizQuestions, mode === 'combined' ? fieldDur : 0) : [];

  const evaluateAt = (rawTimeSec: number): RenderSceneState => {
    const t = Math.max(0, Math.min(totalDurationSec, rawTimeSec));

    const activeAudioClips: { clip: TimelineClip; gain: number }[] = [];
    for (let i = 0; i < audioClipsAll.length; i++) {
      const clip = audioClipsAll[i];
      if (t >= clip.startSec && t <= clip.startSec + clip.durationSec) {
        activeAudioClips.push({
          clip,
          gain: resolveAudioClipGain(clip, t, trackMap.get(clip.trackId), project.audioMix),
        });
      }
    }

    const activeGraphics: BroadcastGraphicOverlay[] = [];
    for (let i = 0; i < enabledGraphics.length; i++) {
      const g = enabledGraphics[i];
      if (t >= g.startSec && t <= g.startSec + g.durationSec) {
        activeGraphics.push(g);
      }
    }

    const activeCaption = captionsEnabled
      ? getActiveCaptionAtTime(captionWindows, t)
      : null;

    if (mode === 'timeline' && allClips.length > 0) {
      const activeSceneClip =
        findActiveClipAtTime(videoClips, t) ??
        videoClips[videoClips.length - 1] ??
        null;

      let fieldClip: TimelineClip | undefined;
      for (let i = 0; i < fieldClips.length; i++) {
        const fc = fieldClips[i];
        if (t >= fc.startSec && t < fc.startSec + fc.durationSec) {
          fieldClip = fc;
          break;
        }
      }

      const matchedFieldScene = fieldClip?.fieldSceneId
        ? fieldSceneById.get(fieldClip.fieldSceneId)
        : undefined;
      const activeFieldDesign = matchedFieldScene?.fieldDesign ?? project.fieldDesign;

      const ballProgress = fieldClip
        ? Math.max(
            0,
            Math.min(1, (t - fieldClip.startSec) / Math.max(0.5, fieldClip.durationSec))
          )
        : 1;
      const ballEval = evaluateBallPathAtProgress(activeFieldDesign.ballPath, ballProgress);

      let quizClip: TimelineClip | undefined;
      for (let i = 0; i < quizClips.length; i++) {
        const qc = quizClips[i];
        if (t >= qc.startSec && t < qc.startSec + qc.durationSec) {
          quizClip = qc;
          break;
        }
      }

      if (quizClip && typeof quizClip.questionIndex === 'number') {
        const question =
          project.quizQuestions[quizClip.questionIndex] ?? project.quizQuestions[0];
        const relatedClips = quizSubClipsByQ.get(quizClip.questionIndex) ?? [];
        let activeQuizSubClip = quizClip;
        for (let i = 0; i < relatedClips.length; i++) {
          const rc = relatedClips[i];
          if (t >= rc.startSec && t < rc.startSec + rc.durationSec) {
            activeQuizSubClip = rc;
            break;
          }
        }

        let phase: 'intro' | 'countdown' | 'reveal' | 'explanation' = 'intro';
        let remainingSec = question.countdownSec;
        let countdownProgress = 0;

        if (activeQuizSubClip.type === 'countdown') {
          phase = 'countdown';
          const elapsed = t - activeQuizSubClip.startSec;
          remainingSec = Math.max(
            0,
            Math.ceil(activeQuizSubClip.durationSec - elapsed)
          );
          countdownProgress = Math.max(
            0,
            Math.min(1, elapsed / Math.max(0.1, activeQuizSubClip.durationSec))
          );
        } else if (activeQuizSubClip.type === 'reveal') {
          phase = 'reveal';
          remainingSec = 0;
          countdownProgress = 1;
        } else if (activeQuizSubClip.type === 'explanation') {
          phase = 'explanation';
          remainingSec = 0;
          countdownProgress = 1;
        }

        return {
          timeSec: t,
          totalDurationSec,
          activeStage: 'quiz',
          activeSceneClip: activeQuizSubClip,
          activeFieldDesign,
          activeGraphics,
          activeAudioClips,
          ballEval,
          activeTransition: resolveClipTransitionAtTime(
            activeQuizSubClip,
            t,
            defaultTransType,
            defaultTransDur
          ),
          activeCaption,
          quizState: {
            question,
            questionNumber: question.index + 1,
            totalQuestions: completeQuizCount,
            phase,
            remainingSec,
            countdownProgress,
          },
        };
      }

      if (fieldClip || activeSceneClip?.type === 'field-scene') {
        const targetClip = fieldClip ?? activeSceneClip;
        return {
          timeSec: t,
          totalDurationSec,
          activeStage: 'field',
          activeSceneClip: targetClip,
          activeFieldDesign,
          activeGraphics,
          activeAudioClips,
          ballEval,
          activeTransition: resolveClipTransitionAtTime(
            targetClip,
            t,
            defaultTransType,
            defaultTransDur
          ),
          activeCaption,
          quizState: null,
        };
      }

      if (activeSceneClip?.type === 'intro') {
        return {
          timeSec: t,
          totalDurationSec,
          activeStage: 'intro',
          activeSceneClip,
          activeFieldDesign,
          activeGraphics,
          activeAudioClips,
          ballEval,
          activeTransition: resolveClipTransitionAtTime(
            activeSceneClip,
            t,
            defaultTransType,
            defaultTransDur
          ),
          activeCaption,
          quizState: null,
        };
      }

      if (activeSceneClip?.type === 'cta' || activeSceneClip?.type === 'outro') {
        return {
          timeSec: t,
          totalDurationSec,
          activeStage: activeSceneClip.type === 'cta' ? 'cta' : 'outro',
          activeSceneClip,
          activeFieldDesign,
          activeGraphics,
          activeAudioClips,
          ballEval,
          activeTransition: resolveClipTransitionAtTime(
            activeSceneClip,
            t,
            defaultTransType,
            defaultTransDur
          ),
          activeCaption,
          quizState: null,
        };
      }

      if (activeSceneClip?.type === 'transition') {
        return {
          timeSec: t,
          totalDurationSec,
          activeStage: 'field',
          activeSceneClip,
          activeFieldDesign,
          activeGraphics,
          activeAudioClips,
          ballEval,
          activeTransition: resolveClipTransitionAtTime(
            activeSceneClip,
            t,
            'broadcast-wipe',
            activeSceneClip.durationSec
          ),
          activeCaption,
          quizState: null,
        };
      }
    }

    const computeBallProgress = (localT: number): number => {
      if (localT <= FIELD_INTRO_HOLD_SEC) return 0;
      const active = localT - FIELD_INTRO_HOLD_SEC;
      return Math.max(0, Math.min(1, active / ballDur));
    };

    if (mode === 'field' || (mode === 'combined' && t < fieldDur)) {
      return {
        timeSec: t,
        totalDurationSec,
        activeStage: 'field',
        activeSceneClip: null,
        activeFieldDesign: project.fieldDesign,
        activeGraphics,
        activeAudioClips,
        ballEval: evaluateBallPathAtProgress(project.fieldDesign.ballPath, computeBallProgress(t)),
        activeTransition: null,
        activeCaption,
        quizState: null,
      };
    }

    const activeSeg =
      quizSegments.find((seg) => t >= seg.startSec && t < seg.endSec) ??
      quizSegments[quizSegments.length - 1];

    let phase: 'intro' | 'countdown' | 'reveal' = 'intro';
    let remainingSec = activeSeg.question.countdownSec;
    let countdownProgress = 0;

    if (t >= activeSeg.countdownEndSec) {
      phase = 'reveal';
      remainingSec = 0;
      countdownProgress = 1;
    } else if (t >= activeSeg.countdownStartSec) {
      phase = 'countdown';
      const elapsed = t - activeSeg.countdownStartSec;
      const totalCd = activeSeg.countdownEndSec - activeSeg.countdownStartSec;
      remainingSec = Math.max(0, Math.ceil(totalCd - elapsed));
      countdownProgress = Math.max(0, Math.min(1, elapsed / totalCd));
    }

    return {
      timeSec: t,
      totalDurationSec,
      activeStage: 'quiz',
      activeSceneClip: null,
      activeFieldDesign: project.fieldDesign,
      activeGraphics,
      activeAudioClips,
      ballEval: evaluateBallPathAtProgress(project.fieldDesign.ballPath, 1),
      activeTransition: null,
      activeCaption,
      quizState: {
        question: activeSeg.question,
        questionNumber: activeSeg.question.index + 1,
        totalQuestions: quizSegments.length,
        phase,
        remainingSec,
        countdownProgress,
      },
    };
  };

  return { totalDurationSec, evaluateAt };
}

export function evaluateSequenceAtTime(
  project: CricketProject,
  mode: PreviewSequenceMode,
  rawTimeSec: number
): RenderSceneState {
  const totalDurationSec = computeSequenceDuration(project, mode);
  const t = Math.max(0, Math.min(totalDurationSec, rawTimeSec));
  const fieldDur = computeFieldSequenceDuration(project);
  const ballDur = Math.max(1.0, project.fieldDesign.ballPath.durationSec || 3.2);

  const trackMap = new Map<TimelineTrackId, TimelineTrack>();
  for (const tr of project.timelineTracks ?? DEFAULT_TIMELINE_TRACKS) {
    trackMap.set(tr.id, tr);
  }

  const activeAudioClips = (project.timelineClips ?? [])
    .filter(
      (c) =>
        (c.trackId === 'voiceover' || c.trackId === 'music' || c.trackId === 'sfx') &&
        t >= c.startSec &&
        t <= c.startSec + c.durationSec
    )
    .map((clip) => ({
      clip,
      gain: resolveAudioClipGain(clip, t, trackMap.get(clip.trackId), project.audioMix),
    }));

  const activeGraphics = (project.broadcastGraphics ?? []).filter(
    (g) => g.enabled && t >= g.startSec && t <= g.startSec + g.durationSec
  );

  const captionWindows =
    project.captionSettings?.enabled !== false
      ? resolveVoiceoverCaptionWindows(
          project.voiceoverSegments ?? [],
          project.timelineClips ?? []
        )
      : [];
  const activeCaption = project.captionSettings?.enabled
    ? getActiveCaptionAtTime(captionWindows, t)
    : null;
  const defaultTransType = project.defaultTransition?.type ?? 'fade';
  const defaultTransDur = project.defaultTransition?.durationSec ?? 0.4;

  // If mode is 'timeline' and project has multi-track clips, drive stage directly from deterministic timeline clips
  if (mode === 'timeline' && (project.timelineClips?.length ?? 0) > 0) {
    const videoClips = sortClips(
      project.timelineClips.filter(
        (c) => c.trackId === 'video' || c.trackId === 'quiz' || c.trackId === 'field'
      )
    );
    const activeSceneClip =
      videoClips.find((c) => t >= c.startSec && t < c.startSec + c.durationSec) ??
      videoClips[videoClips.length - 1] ??
      null;

    // Determine active field scene
    const fieldClip = project.timelineClips.find(
      (c) => c.trackId === 'field' && t >= c.startSec && t < c.startSec + c.durationSec
    );
    const matchedFieldScene = fieldClip?.fieldSceneId
      ? project.fieldScenes?.find((fs) => fs.id === fieldClip.fieldSceneId)
      : undefined;
    const activeFieldDesign = matchedFieldScene?.fieldDesign ?? project.fieldDesign;

    const ballProgress = fieldClip
      ? Math.max(0, Math.min(1, (t - fieldClip.startSec) / Math.max(0.5, fieldClip.durationSec)))
      : 1;
    const ballEval = evaluateBallPathAtProgress(activeFieldDesign.ballPath, ballProgress);

    // Check active quiz clip at time t
    const quizClip = project.timelineClips.find(
      (c) =>
        (c.trackId === 'quiz' || c.trackId === 'video') &&
        typeof c.questionIndex === 'number' &&
        t >= c.startSec &&
        t < c.startSec + c.durationSec
    );

    if (quizClip && typeof quizClip.questionIndex === 'number') {
      const question =
        project.quizQuestions[quizClip.questionIndex] ?? project.quizQuestions[0];
      const relatedClips = project.timelineClips.filter(
        (c) => c.questionIndex === quizClip.questionIndex && c.trackId === 'quiz'
      );
      const activeQuizSubClip =
        relatedClips.find((c) => t >= c.startSec && t < c.startSec + c.durationSec) ??
        quizClip;

      let phase: 'intro' | 'countdown' | 'reveal' | 'explanation' = 'intro';
      let remainingSec = question.countdownSec;
      let countdownProgress = 0;

      if (activeQuizSubClip.type === 'countdown') {
        phase = 'countdown';
        const elapsed = t - activeQuizSubClip.startSec;
        remainingSec = Math.max(
          0,
          Math.ceil(activeQuizSubClip.durationSec - elapsed)
        );
        countdownProgress = Math.max(
          0,
          Math.min(1, elapsed / Math.max(0.1, activeQuizSubClip.durationSec))
        );
      } else if (activeQuizSubClip.type === 'reveal') {
        phase = 'reveal';
        remainingSec = 0;
        countdownProgress = 1;
      } else if (activeQuizSubClip.type === 'explanation') {
        phase = 'explanation';
        remainingSec = 0;
        countdownProgress = 1;
      }

      const completeQuizCount = Math.max(
        1,
        project.quizQuestions.filter((q) => q.prompt.trim().length > 0).length
      );

      return {
        timeSec: t,
        totalDurationSec,
        activeStage: 'quiz',
        activeSceneClip: activeQuizSubClip,
        activeFieldDesign,
        activeGraphics,
        activeAudioClips,
        ballEval,
        activeTransition: resolveClipTransitionAtTime(
          activeQuizSubClip,
          t,
          defaultTransType,
          defaultTransDur
        ),
        activeCaption,
        quizState: {
          question,
          questionNumber: question.index + 1,
          totalQuestions: completeQuizCount,
          phase,
          remainingSec,
          countdownProgress,
        },
      };
    }

    if (fieldClip || activeSceneClip?.type === 'field-scene') {
      const targetClip = fieldClip ?? activeSceneClip;
      return {
        timeSec: t,
        totalDurationSec,
        activeStage: 'field',
        activeSceneClip: targetClip,
        activeFieldDesign,
        activeGraphics,
        activeAudioClips,
        ballEval,
        activeTransition: resolveClipTransitionAtTime(
          targetClip,
          t,
          defaultTransType,
          defaultTransDur
        ),
        activeCaption,
        quizState: null,
      };
    }

    if (activeSceneClip?.type === 'intro') {
      return {
        timeSec: t,
        totalDurationSec,
        activeStage: 'intro',
        activeSceneClip,
        activeFieldDesign,
        activeGraphics,
        activeAudioClips,
        ballEval,
        activeTransition: resolveClipTransitionAtTime(
          activeSceneClip,
          t,
          defaultTransType,
          defaultTransDur
        ),
        activeCaption,
        quizState: null,
      };
    }

    if (activeSceneClip?.type === 'cta' || activeSceneClip?.type === 'outro') {
      return {
        timeSec: t,
        totalDurationSec,
        activeStage: activeSceneClip.type === 'cta' ? 'cta' : 'outro',
        activeSceneClip,
        activeFieldDesign,
        activeGraphics,
        activeAudioClips,
        ballEval,
        activeTransition: resolveClipTransitionAtTime(
          activeSceneClip,
          t,
          defaultTransType,
          defaultTransDur
        ),
        activeCaption,
        quizState: null,
      };
    }

    if (activeSceneClip?.type === 'transition') {
      return {
        timeSec: t,
        totalDurationSec,
        activeStage: 'field',
        activeSceneClip,
        activeFieldDesign,
        activeGraphics,
        activeAudioClips,
        ballEval,
        activeTransition: resolveClipTransitionAtTime(
          activeSceneClip,
          t,
          'broadcast-wipe',
          activeSceneClip.durationSec
        ),
        activeCaption,
        quizState: null,
      };
    }
  }

  // Phase 1 compatible 'field' | 'quiz' | 'combined' evaluation
  const computeBallProgress = (localT: number): number => {
    if (localT <= FIELD_INTRO_HOLD_SEC) return 0;
    const active = localT - FIELD_INTRO_HOLD_SEC;
    return Math.max(0, Math.min(1, active / ballDur));
  };

  if (mode === 'field' || (mode === 'combined' && t < fieldDur)) {
    return {
      timeSec: t,
      totalDurationSec,
      activeStage: 'field',
      activeSceneClip: null,
      activeFieldDesign: project.fieldDesign,
      activeGraphics,
      activeAudioClips,
      ballEval: evaluateBallPathAtProgress(project.fieldDesign.ballPath, computeBallProgress(t)),
      activeTransition: null,
      activeCaption,
      quizState: null,
    };
  }

  const offset = mode === 'combined' ? fieldDur : 0;
  const segments = computeQuizTimeline(project.quizQuestions, offset);
  const activeSeg =
    segments.find((seg) => t >= seg.startSec && t < seg.endSec) ??
    segments[segments.length - 1];

  let phase: 'intro' | 'countdown' | 'reveal' = 'intro';
  let remainingSec = activeSeg.question.countdownSec;
  let countdownProgress = 0;

  if (t >= activeSeg.countdownEndSec) {
    phase = 'reveal';
    remainingSec = 0;
    countdownProgress = 1;
  } else if (t >= activeSeg.countdownStartSec) {
    phase = 'countdown';
    const elapsed = t - activeSeg.countdownStartSec;
    const totalCd = activeSeg.countdownEndSec - activeSeg.countdownStartSec;
    remainingSec = Math.max(0, Math.ceil(totalCd - elapsed));
    countdownProgress = Math.max(0, Math.min(1, elapsed / totalCd));
  }

  return {
    timeSec: t,
    totalDurationSec,
    activeStage: 'quiz',
    activeSceneClip: null,
    activeFieldDesign: project.fieldDesign,
    activeGraphics,
    activeAudioClips,
    ballEval: evaluateBallPathAtProgress(project.fieldDesign.ballPath, 1),
    activeTransition: null,
    activeCaption,
    quizState: {
      question: activeSeg.question,
      questionNumber: activeSeg.question.index + 1,
      totalQuestions: segments.length,
      phase,
      remainingSec,
      countdownProgress,
    },
  };
}

export function formatTimecode(seconds: number, fps: 30 | 60 = 30): string {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const frames = Math.floor((safe - Math.floor(safe)) * fps);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(mins)}:${pad(secs)}:${pad(frames)}`;
}

export function formatYouTubeTimestamp(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hrs > 0) return `${hrs}:${pad(mins)}:${pad(secs)}`;
  return `${pad(mins)}:${pad(secs)}`;
}

export function generateYouTubeChaptersFromTimeline(clips: TimelineClip[]): string {
  const sceneClips = sortClips(
    clips.filter((c) => c.trackId === 'video' || c.trackId === 'field')
  );
  if (sceneClips.length === 0) {
    return '00:00 Intro\n00:05 Tactical Breakdown';
  }
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const clip of sceneClips) {
    if (clip.type === 'transition') continue;
    const stamp = formatYouTubeTimestamp(clip.startSec);
    const key = `${stamp}-${clip.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`${stamp} ${clip.name}`);
  }
  return lines.join('\n');
}
