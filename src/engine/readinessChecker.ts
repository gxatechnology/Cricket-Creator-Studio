import type { CricketProject, TimelineClip } from '../types/studio';
import { isQuizQuestionComplete, sortClips } from './timeline';

export type ReadinessSeverity = 'pass' | 'warning' | 'error';

export interface ReadinessCheckItem {
  id: string;
  label: string;
  detail: string;
  severity: ReadinessSeverity;
  pointsEarned: number;
  pointsMax: number;
}

export interface ProductionReadinessReport {
  scorePercent: number;
  checks: ReadinessCheckItem[];
  summaryLine: string;
}

export function detectTimelineOverlaps(clips: TimelineClip[]): string[] {
  const byTrack = new Map<string, TimelineClip[]>();
  for (const clip of clips) {
    const list = byTrack.get(clip.trackId) ?? [];
    list.push(clip);
    byTrack.set(clip.trackId, list);
  }

  const overlaps: string[] = [];
  for (const [trackId, list] of byTrack.entries()) {
    const sorted = sortClips(list);
    for (let i = 0; i < sorted.length - 1; i++) {
      const curr = sorted[i];
      const next = sorted[i + 1];
      if (curr.startSec + curr.durationSec > next.startSec + 0.05) {
        overlaps.push(`${trackId}: "${curr.name}" overlaps "${next.name}"`);
      }
    }
  }
  return overlaps;
}

export function evaluateProjectReadiness(project: CricketProject): ProductionReadinessReport {
  const checks: ReadinessCheckItem[] = [];
  const targetQuizCount = Math.max(1, project.production?.quizTargetCount ?? 30);
  const relevantQuestions = project.quizQuestions.slice(0, targetQuizCount);

  // 1. Quiz completeness
  const isQuizProject =
    project.production?.contentType === 'quiz' ||
    relevantQuestions.some((q) => q.prompt.trim().length > 0);

  if (isQuizProject) {
    const completeQs = relevantQuestions.filter(isQuizQuestionComplete).length;
    const validCorrect = relevantQuestions.filter(
      (q) => q.prompt.trim().length > 0 && q.correctIndex >= 0 && q.correctIndex <= 3
    ).length;
    const explanationsDone = relevantQuestions.filter(
      (q) => q.explanation.trim().length > 0
    ).length;

    const qRatio = completeQs / targetQuizCount;
    checks.push({
      id: 'quiz-complete',
      label: `${completeQs} / ${targetQuizCount} questions complete`,
      detail:
        completeQs === targetQuizCount
          ? 'All target question slots have prompt and 4 options.'
          : `${targetQuizCount - completeQs} question slots still need prompt or options.`,
      severity: completeQs === targetQuizCount ? 'pass' : completeQs > 0 ? 'warning' : 'error',
      pointsEarned: Math.round(qRatio * 20),
      pointsMax: 20,
    });

    checks.push({
      id: 'quiz-correct',
      label: `${validCorrect} / ${targetQuizCount} correct answers selected`,
      detail:
        validCorrect === targetQuizCount
          ? 'All active questions specify a correct answer.'
          : 'Select a correct answer (A–D) for every question.',
      severity: validCorrect === targetQuizCount ? 'pass' : 'warning',
      pointsEarned: Math.round((validCorrect / targetQuizCount) * 10),
      pointsMax: 10,
    });

    checks.push({
      id: 'quiz-explanations',
      label: `${explanationsDone} / ${targetQuizCount} explanations complete`,
      detail:
        explanationsDone === targetQuizCount
          ? 'All reveal cards include explanations.'
          : `${targetQuizCount - explanationsDone} questions missing reveal explanation.`,
      severity: explanationsDone === targetQuizCount ? 'pass' : 'warning',
      pointsEarned: Math.round((explanationsDone / targetQuizCount) * 10),
      pointsMax: 10,
    });
  } else {
    checks.push({
      id: 'field-setup',
      label: `${project.fieldDesign.fielders.length} fielders positioned`,
      detail: `Field design "${project.fieldDesign.activePresetName}" configured with ${project.fieldDesign.ballPath.deliveryType}.`,
      severity: project.fieldDesign.fielders.length >= 11 ? 'pass' : 'warning',
      pointsEarned: project.fieldDesign.fielders.length >= 11 ? 40 : 25,
      pointsMax: 40,
    });
  }

  // 2. Brand logo & identity
  const hasLogoAsset = Boolean(
    project.brandKit?.logoAssetId &&
      project.assets?.some((a) => a.id === project.brandKit.logoAssetId)
  );
  const hasBrandText = Boolean(project.brandKit?.brandName?.trim());
  checks.push({
    id: 'brand-logo',
    label: hasLogoAsset
      ? 'Brand logo attached'
      : hasBrandText
      ? 'Logo image missing (using text mark)'
      : 'Brand profile incomplete',
    detail: hasLogoAsset
      ? 'Custom logo asset is linked and ready.'
      : 'Upload a brand logo in Asset Library or Brand Studio for full broadcast polish.',
    severity: hasLogoAsset ? 'pass' : 'warning',
    pointsEarned: hasLogoAsset ? 10 : hasBrandText ? 6 : 0,
    pointsMax: 10,
  });

  // 3. Voiceover coverage
  const voSegments = project.voiceoverSegments ?? [];
  const missingVoCount = voSegments.filter((v) => v.status === 'not-created').length;
  const attachedVoCount = voSegments.filter((v) => v.status === 'audio-attached').length;
  checks.push({
    id: 'voiceover',
    label:
      voSegments.length === 0
        ? 'No voiceover segments generated yet'
        : missingVoCount > 0
        ? `Voiceover missing on ${missingVoCount} scenes`
        : `${attachedVoCount} / ${voSegments.length} voiceover audio files attached`,
    detail:
      voSegments.length === 0
        ? 'Run Auto Build Episode or add narration in Audio Workspace.'
        : missingVoCount === 0
        ? 'All timeline scenes have scripts or attached audio.'
        : 'Attach narration scripts or audio files to remaining scenes.',
    severity:
      voSegments.length === 0
        ? 'warning'
        : missingVoCount === 0 && attachedVoCount > 0
        ? 'pass'
        : 'warning',
    pointsEarned:
      voSegments.length === 0
        ? 3
        : attachedVoCount === voSegments.length
        ? 15
        : Math.max(6, Math.round(((voSegments.length - missingVoCount) / voSegments.length) * 12)),
    pointsMax: 15,
  });

  // 4. Asset references integrity
  const assetIds = new Set((project.assets ?? []).map((a) => a.id));
  const audioAssetIds = new Set((project.audioAssets ?? []).map((a) => a.id));
  let missingMediaCount = 0;
  if (project.brandKit?.logoAssetId && !assetIds.has(project.brandKit.logoAssetId)) {
    missingMediaCount++;
  }
  for (const clip of project.timelineClips ?? []) {
    if (clip.audioAssetId && !audioAssetIds.has(clip.audioAssetId)) {
      missingMediaCount++;
    }
  }
  checks.push({
    id: 'media-refs',
    label:
      missingMediaCount === 0
        ? 'All referenced media files present'
        : `${missingMediaCount} media reference(s) missing`,
    detail:
      missingMediaCount === 0
        ? 'Zero broken asset links detected.'
        : 'Re-upload or relink missing audio/logo assets in Asset Library.',
    severity: missingMediaCount === 0 ? 'pass' : 'error',
    pointsEarned: missingMediaCount === 0 ? 10 : 3,
    pointsMax: 10,
  });

  // 5. Timeline overlaps & existence
  const clips = project.timelineClips ?? [];
  const overlaps = detectTimelineOverlaps(clips);
  checks.push({
    id: 'timeline-overlap',
    label:
      clips.length === 0
        ? 'Timeline has 0 clips'
        : overlaps.length > 0
        ? `${overlaps.length} timeline overlap(s) detected`
        : 'Timeline sequence valid (no overlaps)',
    detail:
      overlaps.length > 0
        ? overlaps[0]
        : clips.length === 0
        ? 'Use Auto Build Episode or add clips in Timeline.'
        : `${clips.length} timeline clips ordered cleanly.`,
    severity: clips.length === 0 ? 'error' : overlaps.length > 0 ? 'warning' : 'pass',
    pointsEarned: clips.length === 0 ? 0 : overlaps.length > 0 ? 6 : 10,
    pointsMax: 10,
  });

  // 6. Audio clipping check
  const mix = project.audioMix;
  const maxTrackMix = Math.max(
    mix?.voiceVolume ?? 1,
    mix?.musicVolume ?? 0.35,
    mix?.sfxVolume ?? 0.85
  );
  const clippingClips = clips.filter((c) => (c.volume ?? 1) > 1.05);
  const hasClipping = maxTrackMix > 1.05 || clippingClips.length > 0;
  checks.push({
    id: 'audio-clipping',
    label: hasClipping ? 'Audio clipping warning' : 'Audio gain staging nominal',
    detail: hasClipping
      ? 'One or more audio levels exceed 100% gain and may clip on render.'
      : 'Master voice, music, and SFX gains are within safe headroom.',
    severity: hasClipping ? 'warning' : 'pass',
    pointsEarned: hasClipping ? 3 : 7,
    pointsMax: 7,
  });

  // 7. Broadcast safe areas
  const enabledGraphics = (project.broadcastGraphics ?? []).filter((g) => g.enabled);
  const outOfSafe = enabledGraphics.filter(
    (g) => g.position.x < 5 || g.position.x > 92 || g.position.y < 5 || g.position.y > 92
  );
  checks.push({
    id: 'safe-area',
    label:
      outOfSafe.length === 0
        ? 'All scenes & overlays inside safe area'
        : `${outOfSafe.length} graphic(s) near frame edge`,
    detail:
      outOfSafe.length === 0
        ? 'Broadcast graphics fit inside title-safe margins.'
        : `Adjust position of "${outOfSafe[0].label}" inside 5%–92% safe bounds.`,
    severity: outOfSafe.length === 0 ? 'pass' : 'warning',
    pointsEarned: outOfSafe.length === 0 ? 8 : 4,
    pointsMax: 8,
  });

  const earned = checks.reduce((sum, c) => sum + c.pointsEarned, 0);
  const maxPts = checks.reduce((sum, c) => sum + c.pointsMax, 0);
  const scorePercent = maxPts > 0 ? Math.min(100, Math.round((earned / maxPts) * 100)) : 0;

  return {
    scorePercent,
    checks,
    summaryLine: `Renderer Ready: ${scorePercent}%`,
  };
}
