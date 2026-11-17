import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBlankProject,
  createProjectSnapshot,
  migrateProjectToPhase2,
  normalizeQuizQuestions,
  parseImportedProjectJson,
  restoreProjectFromSnapshot,
} from './storage';
import { QUIZ_QUESTION_COUNT } from './timeline';
import { buildProjectPackageZip, parseProjectPackageZip } from './packaging';
import { DEFAULT_BRAND_PRESETS } from './brandDefaults';

test('normalizeQuizQuestions always pads to 30 slots', () => {
  const normalized = normalizeQuizQuestions([
    {
      prompt: 'Sample question?',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 2,
      countdownSec: 12,
    },
  ]);
  assert.equal(normalized.length, QUIZ_QUESTION_COUNT);
  assert.equal(normalized[0].prompt, 'Sample question?');
  assert.equal(normalized[0].correctIndex, 2);
  assert.equal(normalized[29].index, 29);
  assert.equal(normalized[29].prompt, '');
});

test('parseImportedProjectJson migrates Phase 1 projects safely to Phase 2', () => {
  const legacyPhase1Json = JSON.stringify({
    id: 'legacy-1',
    title: 'Phase 1 Legacy Project',
    subtitle: 'Old format',
    fieldDesign: createBlankProject('tmp').fieldDesign,
    quizQuestions: [
      {
        id: 'q1',
        index: 0,
        prompt: 'Legacy Q1?',
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 1,
        countdownSec: 8,
        explanation: 'Exp',
        category: 'Rules',
        includeFieldOverlay: false,
      },
    ],
  });
  const res = parseImportedProjectJson(legacyPhase1Json);
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.project.schemaVersion, 2);
    assert.equal(res.project.brandKit.brandName, 'Cricket Creator Studio');
    assert.ok(res.project.timelineClips.length > 0);
  }
});

test('snapshots capture and restore project edits cleanly', () => {
  const proj = migrateProjectToPhase2(createBlankProject('Original Name'));
  const snap = createProjectSnapshot(proj, 'Before Revision');
  const edited = { ...proj, title: 'Modified Title' };
  const restored = restoreProjectFromSnapshot(edited, snap);
  assert.ok(restored !== null);
  assert.equal(restored.title, 'Original Name');
});

test('ZIP project packaging round-trips project data and validates contents', async () => {
  const proj = createBlankProject('ZIP Roundtrip Episode');
  proj.brandKit = { ...DEFAULT_BRAND_PRESETS[1] };
  const pkg = await buildProjectPackageZip(proj);
  const bytes = await pkg.blob.arrayBuffer();
  const parsed = await parseProjectPackageZip(bytes);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.project.title, 'ZIP Roundtrip Episode');
    assert.equal(parsed.project.brandKit.brandName, 'Your Cricket Guy');
  }
});
