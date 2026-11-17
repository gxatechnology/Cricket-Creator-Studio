import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBenchmarkProject,
  createClientDemoProject,
  createRendererQaProject,
} from '../data/seedProjects';
import {
  computeSequenceDuration,
  createTimelineEvaluator,
  evaluateSequenceAtTime,
} from '../engine/timeline';
import {
  formatSrtTimestamp,
  generateSrtFromProject,
  getActiveCaptionAtTime,
  resolveVoiceoverCaptionWindows,
} from '../engine/captions';
import {
  AssetBlobStore,
  migrateProjectAssetsToIndexedDB,
} from '../engine/assetBlobStore';
import {
  buildProjectPackageZip,
  parseProjectPackageZip,
} from '../engine/packaging';
import { adaptLayoutForAspectRatio } from './canvasRenderer';
import {
  estimateMixNormalizationScale,
  mixAudioSegmentRange,
  mixDecodedAudioTracks,
  runAssetPreflight,
} from './audioRenderer';
import { evaluateRenderGate, startVideoExport } from './exportController';
import {
  clearActiveRenderCheckpoint,
  loadActiveRenderCheckpoint,
  saveActiveRenderCheckpoint,
} from './jobPersistence';
import { planRenderSegments, resolveWorkerConcurrency } from './segmentPlanner';
import {
  createRenderJob,
  enqueueMultiFormatSuite,
  enqueueRenderJob,
  markJobCompleted,
  markJobFailed,
  markJobRendering,
  removeRenderJob,
  retryRenderJob,
} from './renderQueue';
import {
  buildRenderSettings,
  estimateExportFileSizeBytes,
  formatBytes,
  validateRenderSettings,
} from './rendererTypes';

test('QA project evaluates deterministically across 24s stages, captions, and transitions', () => {
  const qa = createRendererQaProject('16:9');
  const dur = computeSequenceDuration(qa, 'timeline');
  assert.equal(dur, 24);

  const intro = evaluateSequenceAtTime(qa, 'timeline', 0.15);
  assert.equal(intro.activeStage, 'intro');
  assert.equal(intro.activeTransition, null);

  const introCaption = evaluateSequenceAtTime(qa, 'timeline', 0.35);
  assert.ok(
    typeof introCaption.activeCaption === 'string' && introCaption.activeCaption.length > 0
  );

  const fieldTrans = evaluateSequenceAtTime(qa, 'timeline', 2.65);
  assert.equal(fieldTrans.activeStage, 'field');
  assert.equal(fieldTrans.activeTransition?.type, 'slide-left');

  const field = evaluateSequenceAtTime(qa, 'timeline', 5.0);
  assert.equal(field.activeStage, 'field');
  assert.ok(field.ballEval.progress > 0 && field.ballEval.progress < 1);
  assert.ok(field.activeGraphics.length >= 1);

  const quizCountdown = evaluateSequenceAtTime(qa, 'timeline', 12.2);
  assert.equal(quizCountdown.activeStage, 'quiz');
  assert.equal(quizCountdown.quizState?.phase, 'countdown');

  const quizReveal = evaluateSequenceAtTime(qa, 'timeline', 15.5);
  assert.equal(quizReveal.activeStage, 'quiz');
  assert.equal(quizReveal.quizState?.phase, 'reveal');

  const quizExp = evaluateSequenceAtTime(qa, 'timeline', 17.5);
  assert.equal(quizExp.activeStage, 'quiz');
  assert.equal(quizExp.quizState?.phase, 'explanation');

  const outro = evaluateSequenceAtTime(qa, 'timeline', 22.0);
  assert.equal(outro.activeStage, 'outro');
});

test('adaptLayoutForAspectRatio computes valid non-overflowing boxes for 16:9, 9:16, and 1:1', () => {
  const formats: Array<{ w: number; h: number; ar: '16:9' | '9:16' | '1:1' }> = [
    { w: 1920, h: 1080, ar: '16:9' },
    { w: 1080, h: 1920, ar: '9:16' },
    { w: 1080, h: 1080, ar: '1:1' },
  ];

  for (const fmt of formats) {
    const layout = adaptLayoutForAspectRatio(fmt.w, fmt.h, fmt.ar);
    assert.ok(layout.safeBox.x > 0);
    assert.ok(layout.safeBox.y > 0);
    assert.ok(layout.safeBox.x + layout.safeBox.width < fmt.w);
    assert.ok(layout.safeBox.y + layout.safeBox.height < fmt.h);
    assert.ok(layout.fieldBox.width > 200 && layout.fieldBox.height > 200);
    assert.ok(layout.captionY > 0 && layout.captionY < fmt.h);

    // Verify safe-area-aware separation when top broadcast graphics and captions are active
    const hinted = adaptLayoutForAspectRatio(fmt.w, fmt.h, fmt.ar, {
      hasTopGraphic: true,
      hasCaption: true,
    });
    assert.ok(
      hinted.watermarkPos.y < hinted.topHudBox.y,
      `watermark (${hinted.watermarkPos.y}) must sit cleanly above topHudBox (${hinted.topHudBox.y})`
    );
    assert.ok(
      hinted.quizBox.y >= hinted.topHudBox.y + hinted.topHudBox.height,
      `quizBox (${hinted.quizBox.y}) must start below topHudBox bottom (${hinted.topHudBox.y + hinted.topHudBox.height})`
    );
    assert.ok(
      hinted.fieldBox.y >= hinted.topHudBox.y + hinted.topHudBox.height,
      `fieldBox (${hinted.fieldBox.y}) must start below topHudBox bottom (${hinted.topHudBox.y + hinted.topHudBox.height})`
    );
    assert.ok(
      hinted.quizBox.y + hinted.quizBox.height < hinted.captionY - 30,
      `quizBox bottom (${hinted.quizBox.y + hinted.quizBox.height}) must clear captionY (${hinted.captionY})`
    );
  }
});

test('mixDecodedAudioTracks normalizes safely without clipping and handles master mute', () => {
  const qa = createRendererQaProject('16:9');
  const tone = new Float32Array(44100 * 2).fill(0.95);
  const decoded = new Map([
    ['aud-test', { left: tone, right: tone, sampleRate: 44100 }],
  ]);

  const mixed = mixDecodedAudioTracks(
    [
      {
        id: 'c1',
        trackId: 'voiceover',
        name: 'VO',
        startSec: 0,
        durationSec: 2,
        type: 'voiceover',
        status: 'ready',
        audioAssetId: 'aud-test',
        volume: 1.5,
      },
      {
        id: 'c2',
        trackId: 'sfx',
        name: 'Tick',
        startSec: 0.5,
        durationSec: 2,
        type: 'sfx',
        audioCategory: 'countdown-tick',
        status: 'ready',
        volume: 1,
      },
    ],
    qa.timelineTracks,
    qa.audioMix,
    decoded,
    3,
    44100,
    true
  );

  assert.equal(mixed.leftChannel.length, 44100 * 3);
  let maxPeak = 0;
  for (let i = 0; i < mixed.leftChannel.length; i++) {
    const abs = Math.abs(mixed.leftChannel[i]);
    if (abs > maxPeak) maxPeak = abs;
  }
  assert.ok(maxPeak > 0.5 && maxPeak <= 0.9001, `peak ${maxPeak} should be normalized <= 0.9`);

  const muted = mixDecodedAudioTracks(
    qa.timelineClips,
    qa.timelineTracks,
    { ...qa.audioMix, masterMuted: true },
    decoded,
    2,
    44100,
    true
  );
  assert.equal(muted.peakBeforeNormalize, 0);
  assert.ok(muted.warnings.length > 0);
});

test('captions engine resolves time windows, active lookup, and SRT formatting', () => {
  assert.equal(formatSrtTimestamp(0), '00:00:00,000');
  assert.equal(formatSrtTimestamp(65.25), '00:01:05,250');

  const qa = createRendererQaProject('16:9');
  const windows = resolveVoiceoverCaptionWindows(
    qa.voiceoverSegments,
    qa.timelineClips
  );
  assert.ok(windows.length >= 3);
  assert.equal(getActiveCaptionAtTime(windows, 0.5), windows[0].text);
  assert.equal(getActiveCaptionAtTime(windows, 999), null);

  const srt = generateSrtFromProject(qa);
  assert.match(srt, /^1\n00:00:00,200 --> 00:00:02,400/);
  assert.ok(srt.includes(windows[0].text));
});

test('renderSettings validation, file size estimation, and renderQueue lifecycle', () => {
  const good = buildRenderSettings('youtube-1080p', 'standard', 30, 'mp4', 'test-vid');
  assert.deepEqual(validateRenderSettings(good), { valid: true, errors: [] });

  const bad = { ...good, width: 1921, fps: 24 as unknown as 30, outputName: ' ' };
  const badCheck = validateRenderSettings(bad);
  assert.equal(badCheck.valid, false);
  assert.equal(badCheck.errors.length, 3);

  const est = estimateExportFileSizeBytes(24, good);
  assert.ok(est > 10_000_000);
  assert.match(formatBytes(est), /MB$/);

  const qa = createRendererQaProject('16:9');
  let queue = enqueueRenderJob([], createRenderJob(qa, good, 'Landscape Test'));
  assert.equal(queue.length, 1);
  queue = enqueueMultiFormatSuite(queue, qa, 30, 'mp4');
  assert.equal(queue.length, 4);

  const jobId = queue[0].id;
  queue = markJobRendering(queue, jobId, {
    stage: 'encoding-video',
    stageLabel: 'Encoding',
    percent: 45,
    currentFrame: 100,
    totalFrames: 200,
    elapsedMs: 1000,
    estimatedRemainingMs: 1000,
    currentSceneName: 'Field',
  });
  assert.equal(queue[0].status, 'rendering');
  assert.equal(queue[0].progressPercent, 45);

  queue = markJobFailed(queue, jobId, { code: 'CANCELLED', message: 'Cancelled' });
  assert.equal(queue[0].status, 'cancelled');

  queue = retryRenderJob(queue, jobId);
  assert.equal(queue[0].status, 'queued');
  assert.equal(queue[0].progressPercent, 0);

  queue = markJobCompleted(queue, jobId, {
    blob: new Blob(['mp4']),
    objectUrl: 'blob:test',
    filename: 'test.mp4',
    mimeType: 'video/mp4',
    codecLabel: 'H.264',
    container: 'mp4',
    width: 1920,
    height: 1080,
    fps: 30,
    durationSec: 24,
    fileSizeBytes: 3,
    hasAudio: true,
    audioWarnings: [],
    renderDurationMs: 500,
  });
  assert.equal(queue[0].status, 'completed');

  queue = removeRenderJob(queue, jobId);
  assert.equal(queue.length, 3);
});

test('AssetBlobStore migration, preflight, and evaluateRenderGate blockers', async () => {
  const qa = createRendererQaProject('16:9');
  const gatePass = evaluateRenderGate(qa);
  assert.equal(gatePass.allowed, true);
  assert.equal(gatePass.statusLabel, 'READY TO EXPORT');

  const broken = {
    ...qa,
    fieldDesign: { ...qa.fieldDesign, fielders: [] },
  };
  const gateFail = evaluateRenderGate(broken);
  assert.equal(gateFail.allowed, false);
  assert.equal(gateFail.statusLabel, 'FIX REQUIRED ITEMS');

  const tinyPngDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const withAsset = {
    ...qa,
    assets: [
      {
        id: 'asset-logo-1',
        name: 'logo.png',
        category: 'logos' as const,
        mimeType: 'image/png',
        dataUrl: tinyPngDataUrl,
        sizeBytes: 68,
        createdAt: new Date().toISOString(),
      },
    ],
    brandKit: { ...qa.brandKit, logoAssetId: 'asset-logo-1' },
  };

  const migrated = await migrateProjectAssetsToIndexedDB(withAsset);
  assert.equal(migrated.migratedCount, 1);
  const preflight = await runAssetPreflight(migrated.project);
  assert.equal(preflight.allReady, true);
  assert.equal(preflight.readyCount, 1);

  // Add an offloaded large asset (>64KB, no inline dataUrl) stored purely in AssetBlobStore
  const largeBlob = new Blob([new Uint8Array(70_000).fill(7)], { type: 'image/png' });
  await AssetBlobStore.putAsset('blob-large-banner', largeBlob, {
    name: 'large-banner.png',
    mimeType: 'image/png',
  });
  const withLargeAsset = {
    ...migrated.project,
    assets: [
      ...migrated.project.assets,
      {
        id: 'large-banner',
        assetId: 'blob-large-banner',
        name: 'large-banner.png',
        category: 'backgrounds' as const,
        mimeType: 'image/png',
        sizeBytes: 70_000,
        createdAt: new Date().toISOString(),
      },
    ],
  };

  // Round-trip ZIP package with IndexedDB asset restoration
  const pkg = await buildProjectPackageZip(withLargeAsset);
  await AssetBlobStore.deleteAsset('blob-large-banner');

  // Deleting blob causes missing asset error in preflight
  const missingPreflight = await runAssetPreflight(withLargeAsset);
  assert.equal(missingPreflight.allReady, false);
  assert.deepEqual(missingPreflight.missingNames, ['large-banner.png']);

  // Importing ZIP package restores the blob back into AssetBlobStore
  const reimported = await parseProjectPackageZip(await pkg.blob.arrayBuffer());
  assert.equal(reimported.ok, true);
  if (reimported.ok) {
    const restoredPreflight = await runAssetPreflight(reimported.project);
    assert.equal(restoredPreflight.allReady, true);
    assert.equal(restoredPreflight.readyCount, 2);
    await AssetBlobStore.deleteAsset(reimported.project.assets[0].assetId!);
    await AssetBlobStore.deleteAsset('blob-large-banner');
  }
});

test('startVideoExport cancellation rejects cleanly with CANCELLED code', async () => {
  const qa = createRendererQaProject('16:9');
  const settings = buildRenderSettings('preview-480p', 'draft', 30, 'mp4', 'cancel-test');
  const handle = startVideoExport(qa, settings);
  handle.cancel();
  await assert.rejects(handle.promise, (err: unknown) => {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'CANCELLED'
    );
  });
});

test('render evaluation does not mutate project and invalid projects fail with READINESS_BLOCKED', async () => {
  const qa = createRendererQaProject('16:9');
  const snapshotBefore = JSON.stringify(qa);
  for (const t of [0, 2.5, 5.0, 11.5, 15.5, 22.0]) {
    evaluateSequenceAtTime(qa, 'timeline', t);
  }
  evaluateRenderGate(qa);
  assert.equal(JSON.stringify(qa), snapshotBefore);

  const broken = {
    ...qa,
    fieldDesign: { ...qa.fieldDesign, fielders: [] },
  };
  const settings = buildRenderSettings('youtube-1080p', 'standard', 30, 'mp4', 'fail-test');
  const handle = startVideoExport(broken, settings);
  await assert.rejects(handle.promise, (err: unknown) => {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'READINESS_BLOCKED'
    );
  });
});

test('createTimelineEvaluator matches evaluateSequenceAtTime identically across 30Q & demo timelines', () => {
  const demo = createClientDemoProject('16:9');
  const bench30 = createBenchmarkProject(30, '16:9');

  for (const proj of [demo, bench30]) {
    const fast = createTimelineEvaluator(proj, 'timeline');
    const dur = computeSequenceDuration(proj, 'timeline');
    assert.equal(fast.totalDurationSec, dur);

    const sampleTimes = [
      0,
      0.25,
      3.5,
      5.2,
      12.2,
      16.0,
      21.0,
      24.0,
      dur * 0.5,
      dur - 3.5,
      dur - 0.5,
      dur,
    ];

    for (const t of sampleTimes) {
      const a = evaluateSequenceAtTime(proj, 'timeline', t);
      const b = fast.evaluateAt(t);
      assert.equal(b.activeStage, a.activeStage, `stage mismatch at t=${t}`);
      assert.equal(b.activeSceneClip?.id, a.activeSceneClip?.id, `clip mismatch at t=${t}`);
      assert.equal(b.activeCaption, a.activeCaption, `caption mismatch at t=${t}`);
      assert.equal(b.quizState?.phase, a.quizState?.phase, `quiz phase mismatch at t=${t}`);
      assert.equal(
        b.quizState?.questionNumber,
        a.quizState?.questionNumber,
        `questionNumber mismatch at t=${t}`
      );
      assert.equal(b.activeAudioClips.length, a.activeAudioClips.length);
      assert.equal(b.activeGraphics.length, a.activeGraphics.length);
    }
  }
});

test('planRenderSegments tiles frames contiguously with zero gaps/overlaps and bounds concurrency', () => {
  // Short 24s remains 1 segment
  const shortPlan = planRenderSegments(24, 30);
  assert.equal(shortPlan.length, 1);
  assert.equal(shortPlan[0].startFrame, 0);
  assert.equal(shortPlan[0].endFrame, 720);

  // 60s demo splits into 3x 20s segments (1800 frames total)
  const demoPlan = planRenderSegments(60, 30);
  assert.equal(demoPlan.length, 3);
  let cursorFrame = 0;
  for (let i = 0; i < demoPlan.length; i++) {
    assert.equal(demoPlan[i].segmentIndex, i);
    assert.equal(demoPlan[i].totalSegments, demoPlan.length);
    assert.equal(demoPlan[i].startFrame, cursorFrame);
    cursorFrame = demoPlan[i].endFrame;
  }
  assert.equal(cursorFrame, 1800);

  // 344.5s 30Q episode tiles cleanly without dropping frames
  const longPlan = planRenderSegments(344.5, 30);
  assert.ok(longPlan.length >= 16);
  let totalFrames = 0;
  for (let i = 0; i < longPlan.length; i++) {
    assert.equal(longPlan[i].startFrame, totalFrames);
    totalFrames = longPlan[i].endFrame;
  }
  assert.equal(totalFrames, Math.round(344.5 * 30));

  // Concurrency limits
  assert.equal(resolveWorkerConcurrency(1, 1920, 1080, 8), 1);
  assert.equal(resolveWorkerConcurrency(6, 1920, 1080, 8), 2);
  assert.equal(resolveWorkerConcurrency(6, 1280, 720, 8), 3);
});

test('segmented audio normalization matches full-track mixing across boundaries', () => {
  const demo = createClientDemoProject('16:9');
  const durationSec = computeSequenceDuration(demo, 'timeline');
  const sr = 48000;
  const emptyMap = new Map();

  const full = mixDecodedAudioTracks(
    demo.timelineClips,
    demo.timelineTracks,
    demo.audioMix,
    emptyMap,
    durationSec,
    sr,
    true
  );

  const norm = estimateMixNormalizationScale(
    demo.timelineClips,
    demo.timelineTracks,
    demo.audioMix,
    emptyMap,
    durationSec,
    sr,
    true
  );

  const seg0 = mixAudioSegmentRange(
    demo.timelineClips,
    demo.timelineTracks,
    demo.audioMix,
    emptyMap,
    0,
    20,
    durationSec,
    sr,
    norm.scale
  );
  const seg1 = mixAudioSegmentRange(
    demo.timelineClips,
    demo.timelineTracks,
    demo.audioMix,
    emptyMap,
    20,
    40,
    durationSec,
    sr,
    norm.scale
  );

  assert.equal(seg0.leftChannel.length, 20 * sr);
  assert.equal(seg1.leftChannel.length, 20 * sr);

  // Sample-level parity check across boundary at t = 19.99s and t = 20.01s
  const idxBefore = 19 * sr + 47520;
  const idxAfter = 20 * sr + 480;
  assert.ok(Math.abs(seg0.leftChannel[idxBefore] - full.leftChannel[idxBefore]) < 1e-4);
  assert.ok(Math.abs(seg1.leftChannel[idxAfter - 20 * sr] - full.leftChannel[idxAfter]) < 1e-4);
});

test('5Q, 10Q, 30Q benchmark projects and 60s client demo projects pass readiness gate', () => {
  for (const count of [5, 10, 30] as const) {
    const bench = createBenchmarkProject(count, '16:9');
    const gate = evaluateRenderGate(bench);
    assert.equal(gate.allowed, true, `benchmark ${count}Q should pass readiness gate`);
    const dur = computeSequenceDuration(bench, 'timeline');
    assert.ok(dur > count * 10, `benchmark ${count}Q duration (${dur}s) looks too short`);
  }

  for (const ar of ['16:9', '9:16'] as const) {
    const demo = createClientDemoProject(ar);
    assert.equal(computeSequenceDuration(demo, 'timeline'), 60);
    assert.equal(evaluateRenderGate(demo).allowed, true);
    assert.ok(demo.timelineClips.some((c) => c.type === 'intro'));
    assert.ok(demo.timelineClips.some((c) => c.type === 'field-scene'));
    assert.ok(demo.timelineClips.some((c) => c.type === 'countdown'));
    assert.ok(demo.timelineClips.some((c) => c.type === 'reveal'));
    assert.ok(demo.timelineClips.some((c) => c.type === 'explanation'));
    assert.ok(demo.timelineClips.some((c) => c.type === 'outro'));
  }
});

test('jobPersistence saves, loads, and clears active render checkpoints outside React state', () => {
  const memStore = new Map<string, string>();
  const origLs = (globalThis as { localStorage?: Storage }).localStorage;
  (globalThis as { localStorage: Partial<Storage> }).localStorage = {
    getItem: (k: string) => memStore.get(k) ?? null,
    setItem: (k: string, v: string) => {
      memStore.set(k, v);
    },
    removeItem: (k: string) => {
      memStore.delete(k);
    },
  };
  try {
    const settings = buildRenderSettings('draft-720p', 'draft', 30, 'mp4', 'recover-test');
    saveActiveRenderCheckpoint({
      jobId: 'ccs-recover-1',
      projectId: 'proj-demo',
      projectTitle: 'Recovery Test',
      settings,
      createdAt: '2026-11-16T23:30:00.000Z',
    });
    const loaded = loadActiveRenderCheckpoint();
    assert.equal(loaded?.jobId, 'ccs-recover-1');
    assert.equal(loaded?.projectId, 'proj-demo');
    assert.equal(loaded?.settings.width, 1280);
    clearActiveRenderCheckpoint();
    assert.equal(loadActiveRenderCheckpoint(), null);
  } finally {
    if (origLs) {
      (globalThis as { localStorage?: Storage }).localStorage = origLs;
    } else {
      delete (globalThis as { localStorage?: Storage }).localStorage;
    }
  }
});


