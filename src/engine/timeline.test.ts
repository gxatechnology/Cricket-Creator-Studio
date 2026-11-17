import test from 'node:test';
import assert from 'node:assert/strict';
import {
  QUIZ_QUESTION_COUNT,
  computeQuizTimeline,
  computeSequenceDuration,
  computeTimelineTotalDuration,
  countCompleteQuestions,
  evaluateSequenceAtTime,
  formatTimecode,
  generateYouTubeChaptersFromTimeline,
  resolveAudioClipGain,
  sortClips,
  splitClipAtTime,
} from './timeline';
import { createInitialWorkspace } from '../data/seedProjects';

test('seed project has 30 quiz questions and counts completion accurately', () => {
  const ws = createInitialWorkspace();
  const proj = ws.projects[0];
  assert.equal(proj.quizQuestions.length, QUIZ_QUESTION_COUNT);
  assert.equal(countCompleteQuestions(proj.quizQuestions), 30);

  const proj2 = ws.projects[1];
  assert.equal(proj2.quizQuestions.length, QUIZ_QUESTION_COUNT);
  assert.equal(countCompleteQuestions(proj2.quizQuestions), 12);
});

test('evaluateSequenceAtTime transitions cleanly in combined and timeline modes', () => {
  const ws = createInitialWorkspace();
  const proj = ws.projects[0];

  const atStart = evaluateSequenceAtTime(proj, 'combined', 0.5);
  assert.equal(atStart.activeStage, 'field');
  assert.equal(atStart.quizState, null);

  const timelineIntro = evaluateSequenceAtTime(proj, 'timeline', 1.0);
  assert.equal(timelineIntro.activeStage, 'intro');

  const totalDur = computeSequenceDuration(proj, 'combined');
  const fieldDur = computeSequenceDuration(proj, 'field');
  assert.ok(totalDur > fieldDur);

  const inQuiz = evaluateSequenceAtTime(proj, 'combined', fieldDur + 2.5);
  assert.equal(inQuiz.activeStage, 'quiz');
  assert.ok(inQuiz.quizState !== null);
  assert.equal(inQuiz.quizState.questionNumber, 1);
  assert.equal(inQuiz.quizState.phase, 'countdown');
});

test('computeQuizTimeline reaches reveal phase after countdown expires', () => {
  const ws = createInitialWorkspace();
  const proj = ws.projects[0];
  const segments = computeQuizTimeline(proj.quizQuestions, 0);
  const first = segments[0];

  const revealScene = evaluateSequenceAtTime(proj, 'quiz', first.countdownEndSec + 0.5);
  assert.equal(revealScene.quizState?.phase, 'reveal');
  assert.equal(revealScene.quizState?.remainingSec, 0);
});

test('timeline sorting, duration, splitting, chapters, and audio fade gain calculations', () => {
  const sorted = sortClips([
    { id: 'b', trackId: 'video', name: 'B', startSec: 10, durationSec: 5, type: 'question', status: 'ready' },
    { id: 'a', trackId: 'video', name: 'A', startSec: 0, durationSec: 10, type: 'intro', status: 'ready' },
  ]);
  assert.equal(sorted[0].id, 'a');
  assert.equal(computeTimelineTotalDuration(sorted), 15);

  const split = splitClipAtTime(sorted[0], 4);
  assert.ok(split !== null);
  assert.equal(split[0].durationSec, 4);
  assert.equal(split[1].startSec, 4);
  assert.equal(split[1].durationSec, 6);

  const chapters = generateYouTubeChaptersFromTimeline(sorted);
  assert.match(chapters, /00:00 A/);
  assert.match(chapters, /00:10 B/);

  const gainMid = resolveAudioClipGain(
    {
      id: 'm1',
      trackId: 'music',
      name: 'BG',
      startSec: 0,
      durationSec: 10,
      type: 'music',
      status: 'ready',
      volume: 1,
      fadeInSec: 2,
      fadeOutSec: 2,
    },
    1,
    { id: 'music', label: 'MUSIC', muted: false, locked: false },
    { masterMuted: false, voiceVolume: 1, musicVolume: 0.5, sfxVolume: 1 }
  );
  assert.equal(gainMid, 0.25);
});

test('formatTimecode formats MM:SS:FF accurately', () => {
  assert.equal(formatTimecode(0, 30), '00:00:00');
  assert.equal(formatTimecode(65.5, 30), '01:05:15');
});
