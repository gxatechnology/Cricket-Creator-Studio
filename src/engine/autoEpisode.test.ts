import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_AUTO_EPISODE_TIMING,
  buildAutoEpisodeTimeline,
  estimateNarrationDurationSec,
} from './autoEpisode';
import { createBlankProject } from './storage';
import { CRICKET_SEED_QUESTIONS } from '../data/seedProjects';

test('estimateNarrationDurationSec scales proportionally with word count', () => {
  assert.equal(estimateNarrationDurationSec(''), 0);
  const shortSec = estimateNarrationDurationSec('Welcome to cricket studio');
  const longSec = estimateNarrationDurationSec(
    'Welcome back to Cricket Creator Studio where we analyze powerplay fielding positions and bowling lines across thirty questions.'
  );
  assert.ok(longSec > shortSec);
});

test('buildAutoEpisodeTimeline generates intro, questions, countdown, reveal, explanation, SFX, CTA and outro', () => {
  const proj = createBlankProject('Auto Quiz Episode');
  proj.quizQuestions = proj.quizQuestions.map((q, idx) =>
    idx < 3
      ? {
          ...q,
          prompt: CRICKET_SEED_QUESTIONS[idx].prompt,
          options: [...CRICKET_SEED_QUESTIONS[idx].options],
          correctIndex: CRICKET_SEED_QUESTIONS[idx].correctIndex,
          countdownSec: 5,
          explanation: CRICKET_SEED_QUESTIONS[idx].explanation,
        }
      : q
  );

  const result = buildAutoEpisodeTimeline(proj, DEFAULT_AUTO_EPISODE_TIMING);
  assert.ok(result.totalDurationSec > 60);
  assert.ok(result.clips.some((c) => c.type === 'intro'));
  assert.ok(result.clips.some((c) => c.type === 'countdown'));
  assert.ok(result.clips.some((c) => c.type === 'reveal'));
  assert.ok(result.clips.some((c) => c.type === 'explanation'));
  assert.ok(result.clips.some((c) => c.type === 'cta'));
  assert.ok(result.clips.some((c) => c.type === 'outro'));
  assert.ok(result.clips.some((c) => c.trackId === 'sfx' && c.audioCategory === 'countdown-tick'));
  assert.ok(result.clips.some((c) => c.trackId === 'sfx' && c.audioCategory === 'answer-correct'));
  assert.ok(result.voiceoverSegments.length >= 4);
});
