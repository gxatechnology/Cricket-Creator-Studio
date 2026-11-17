import type {
  AutoEpisodeTiming,
  AutoSfxSettings,
  CricketProject,
  TimelineClip,
  VoiceoverSegment,
} from '../types/studio';
import { computeTimelineTotalDuration, sortClips } from './timeline';

export const DEFAULT_AUTO_EPISODE_TIMING: AutoEpisodeTiming = {
  introSec: 5,
  questionSec: 7,
  countdownSec: 5,
  revealSec: 3,
  explanationSec: 6,
  transitionSec: 1,
  ctaSec: 5,
  outroSec: 5,
};

export const DEFAULT_AUTO_SFX_SETTINGS: AutoSfxSettings = {
  enabled: true,
  countdownTick: true,
  correctSting: true,
  wrongSting: false,
  boundaryCheer: true,
  wicketSting: true,
  batImpact: true,
  sceneWhoosh: true,
};

export function estimateNarrationDurationSec(text: string): number {
  const words = text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  if (words === 0) return 0;
  // Average broadcast pacing: ~145 words per minute (~2.4 words/sec)
  return Math.max(1.5, Math.round((words / 2.4) * 10) / 10);
}

export interface AutoBuildResult {
  clips: TimelineClip[];
  voiceoverSegments: VoiceoverSegment[];
  totalDurationSec: number;
}

export function buildAutoEpisodeTimeline(
  project: CricketProject,
  timingOverride?: AutoEpisodeTiming,
  sfxOverride?: AutoSfxSettings
): AutoBuildResult {
  const timing = timingOverride ?? project.autoEpisodeTiming ?? DEFAULT_AUTO_EPISODE_TIMING;
  const sfx = sfxOverride ?? project.autoSfx ?? DEFAULT_AUTO_SFX_SETTINGS;

  const clips: TimelineClip[] = [];
  const voiceoverSegments: VoiceoverSegment[] = [];

  // Preserve user's existing background music clips if any
  const existingMusic = (project.timelineClips ?? []).filter((c) => c.trackId === 'music');
  clips.push(...existingMusic);

  let cursor = 0;

  // 1. Intro Scene
  const introClipId = 'auto-clip-intro';
  clips.push({
    id: introClipId,
    trackId: 'video',
    name: 'Episode Intro',
    startSec: cursor,
    durationSec: timing.introSec,
    type: 'intro',
    status: 'ready',
  });
  clips.push({
    id: 'auto-gfx-intro',
    trackId: 'graphics',
    name: `${project.brandKit.channelName} Title Card`,
    startSec: cursor,
    durationSec: timing.introSec,
    type: 'graphic',
    status: 'ready',
  });
  const introScript = `Welcome back to ${project.brandKit.channelName}! Today: ${project.title}.`;
  voiceoverSegments.push({
    id: 'vo-intro',
    sceneClipId: introClipId,
    label: 'Episode Intro',
    text: introScript,
    status: 'script-ready',
    estimatedDurationSec: estimateNarrationDurationSec(introScript),
  });
  clips.push({
    id: 'auto-vo-intro',
    trackId: 'voiceover',
    name: 'VO: Intro',
    startSec: cursor,
    durationSec: timing.introSec,
    type: 'voiceover',
    status: 'draft',
    volume: 1,
  });
  cursor += timing.introSec;

  // 2. If Field Analysis or Tactical intro exists, include Field Animation scene
  const isFieldFocused =
    project.production.contentType === 'field-analysis' ||
    project.production.contentType === 'match-breakdown' ||
    project.production.contentType === 'player-analysis';

  const activeQuestions = project.quizQuestions.filter((q) => q.prompt.trim().length > 0);

  if (isFieldFocused || activeQuestions.length === 0) {
    const fieldDur = Math.max(3, project.fieldDesign.ballPath.durationSec + 1.5);
    const fieldClipId = 'auto-clip-field-main';
    clips.push({
      id: fieldClipId,
      trackId: 'field',
      name: `Field: ${project.fieldDesign.activePresetName}`,
      startSec: cursor,
      durationSec: fieldDur,
      type: 'field-scene',
      status: 'ready',
      fieldSceneId: project.fieldScenes[0]?.id,
    });
    clips.push({
      id: 'auto-vid-field-main',
      trackId: 'video',
      name: `Tactical Field (${project.fieldDesign.ballPath.deliveryType})`,
      startSec: cursor,
      durationSec: fieldDur,
      type: 'field-scene',
      status: 'ready',
    });

    if (sfx.enabled && sfx.batImpact) {
      clips.push({
        id: 'auto-sfx-bat-impact',
        trackId: 'sfx',
        name: 'SFX: Bat Impact',
        startSec: Math.round((cursor + fieldDur * 0.45) * 10) / 10,
        durationSec: 0.8,
        type: 'sfx',
        audioCategory: 'bat-hit',
        status: 'ready',
        volume: 0.9,
      });
    }

    if (
      sfx.enabled &&
      sfx.boundaryCheer &&
      (project.fieldDesign.ballPath.shotType === 'Lofted Six' ||
        project.fieldDesign.ballPath.shotType === 'Four' ||
        project.fieldDesign.ballPath.shotType === 'Cover Drive')
    ) {
      clips.push({
        id: 'auto-sfx-boundary-cheer',
        trackId: 'sfx',
        name: 'SFX: Crowd Cheer',
        startSec: Math.round((cursor + fieldDur * 0.72) * 10) / 10,
        durationSec: 1.8,
        type: 'sfx',
        audioCategory: 'cheer',
        status: 'ready',
        volume: 0.85,
      });
    }

    const fieldScript = `Look at this ${project.fieldDesign.activePresetName} setup against the ${project.fieldDesign.batterHand}-handed batter.`;
    voiceoverSegments.push({
      id: 'vo-field-main',
      sceneClipId: fieldClipId,
      label: 'Tactical Field Breakdown',
      text: fieldScript,
      status: 'script-ready',
      estimatedDurationSec: estimateNarrationDurationSec(fieldScript),
    });

    cursor += fieldDur;
  }

  // 3. Quiz Question Sequence
  activeQuestions.forEach((q, idx) => {
    const qStart = cursor;
    const qNumber = q.index + 1;
    const qCountdown = q.countdownSec > 0 ? q.countdownSec : timing.countdownSec;
    const qTotalDur =
      timing.questionSec +
      qCountdown +
      timing.revealSec +
      timing.explanationSec;

    // Master video scene block for the question
    const sceneId = `auto-vid-q-${qNumber}`;
    clips.push({
      id: sceneId,
      trackId: 'video',
      name: `Question ${qNumber}`,
      startSec: qStart,
      durationSec: qTotalDur,
      type: 'question',
      status: 'ready',
      questionIndex: q.index,
    });

    // Sub-clips on QUIZ track
    clips.push({
      id: `auto-quiz-read-${qNumber}`,
      trackId: 'quiz',
      name: `Q${qNumber} Prompt`,
      startSec: qStart,
      durationSec: timing.questionSec,
      type: 'question',
      status: 'ready',
      questionIndex: q.index,
    });

    const cdStart = qStart + timing.questionSec;
    clips.push({
      id: `auto-quiz-cd-${qNumber}`,
      trackId: 'quiz',
      name: `Q${qNumber} Countdown`,
      startSec: cdStart,
      durationSec: qCountdown,
      type: 'countdown',
      status: 'ready',
      questionIndex: q.index,
    });

    if (sfx.enabled && sfx.countdownTick) {
      clips.push({
        id: `auto-sfx-tick-${qNumber}`,
        trackId: 'sfx',
        name: `SFX: Tick Q${qNumber}`,
        startSec: cdStart,
        durationSec: qCountdown,
        type: 'sfx',
        audioCategory: 'countdown-tick',
        status: 'ready',
        volume: 0.75,
      });
    }

    const revealStart = cdStart + qCountdown;
    clips.push({
      id: `auto-quiz-rev-${qNumber}`,
      trackId: 'quiz',
      name: `Q${qNumber} Answer Reveal`,
      startSec: revealStart,
      durationSec: timing.revealSec,
      type: 'reveal',
      status: 'ready',
      questionIndex: q.index,
    });

    if (sfx.enabled && sfx.correctSting) {
      clips.push({
        id: `auto-sfx-correct-${qNumber}`,
        trackId: 'sfx',
        name: `SFX: Correct Q${qNumber}`,
        startSec: revealStart,
        durationSec: 1.2,
        type: 'sfx',
        audioCategory: 'answer-correct',
        status: 'ready',
        volume: 0.9,
      });
    }

    const expStart = revealStart + timing.revealSec;
    clips.push({
      id: `auto-quiz-exp-${qNumber}`,
      trackId: 'quiz',
      name: `Q${qNumber} Explanation`,
      startSec: expStart,
      durationSec: timing.explanationSec,
      type: 'explanation',
      status: q.explanation.trim() ? 'ready' : 'draft',
      questionIndex: q.index,
    });

    if (q.includeFieldOverlay) {
      clips.push({
        id: `auto-field-q-${qNumber}`,
        trackId: 'field',
        name: `Field Backdrop Q${qNumber}`,
        startSec: qStart,
        durationSec: qTotalDur,
        type: 'field-scene',
        status: 'ready',
      });
    }

    const voText = `${q.prompt} ${q.explanation ? `Answer: ${q.options[q.correctIndex]}. ${q.explanation}` : ''}`.trim();
    voiceoverSegments.push({
      id: `vo-q-${qNumber}`,
      sceneClipId: sceneId,
      label: `Question ${qNumber}`,
      text: voText,
      status: 'script-ready',
      estimatedDurationSec: estimateNarrationDurationSec(voText),
    });

    clips.push({
      id: `auto-vo-q-${qNumber}`,
      trackId: 'voiceover',
      name: `VO: Q${qNumber}`,
      startSec: qStart,
      durationSec: timing.questionSec,
      type: 'voiceover',
      status: 'draft',
      questionIndex: q.index,
      volume: 1,
    });

    cursor = expStart + timing.explanationSec;

    // Transition between questions
    if (idx < activeQuestions.length - 1 && timing.transitionSec > 0) {
      clips.push({
        id: `auto-trans-${qNumber}`,
        trackId: 'video',
        name: `Transition ${qNumber}`,
        startSec: cursor,
        durationSec: timing.transitionSec,
        type: 'transition',
        status: 'ready',
      });
      if (sfx.enabled && sfx.sceneWhoosh) {
        clips.push({
          id: `auto-sfx-whoosh-${qNumber}`,
          trackId: 'sfx',
          name: `SFX: Whoosh ${qNumber}`,
          startSec: cursor,
          durationSec: timing.transitionSec,
          type: 'sfx',
          audioCategory: 'whoosh',
          status: 'ready',
          volume: 0.7,
        });
      }
      cursor += timing.transitionSec;
    }
  });

  // 4. Score / CTA Section
  if (timing.ctaSec > 0) {
    const ctaId = 'auto-clip-cta';
    clips.push({
      id: ctaId,
      trackId: 'video',
      name: 'Score & Subscribe CTA',
      startSec: cursor,
      durationSec: timing.ctaSec,
      type: 'cta',
      status: 'ready',
    });
    voiceoverSegments.push({
      id: 'vo-cta',
      sceneClipId: ctaId,
      label: 'Score & CTA',
      text: project.brandKit.ctaText,
      status: 'script-ready',
      estimatedDurationSec: estimateNarrationDurationSec(project.brandKit.ctaText),
    });
    cursor += timing.ctaSec;
  }

  // 5. Outro
  if (timing.outroSec > 0) {
    const outroId = 'auto-clip-outro';
    clips.push({
      id: outroId,
      trackId: 'video',
      name: 'Episode Outro',
      startSec: cursor,
      durationSec: timing.outroSec,
      type: 'outro',
      status: 'ready',
    });
    cursor += timing.outroSec;
  }

  const sorted = sortClips(clips);
  return {
    clips: sorted,
    voiceoverSegments,
    totalDurationSec: computeTimelineTotalDuration(sorted),
  };
}
