import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createHistoryState,
  pushHistoryState,
  redoHistory,
  undoHistory,
} from './history';
import { evaluateProjectReadiness } from './readinessChecker';
import { createBlankProject } from './storage';
import { createInitialWorkspace } from '../data/seedProjects';

test('undo/redo history stack transitions and respects bounds', () => {
  let stack = createHistoryState(1);
  stack = pushHistoryState(stack, 2, 3);
  stack = pushHistoryState(stack, 3, 3);
  stack = pushHistoryState(stack, 4, 3);
  stack = pushHistoryState(stack, 5, 3);

  assert.equal(stack.present, 5);
  assert.equal(stack.past.length, 3);

  stack = undoHistory(stack);
  assert.equal(stack.present, 4);
  stack = redoHistory(stack);
  assert.equal(stack.present, 5);
});

test('evaluateProjectReadiness scores complete seed project higher than blank project', () => {
  const ws = createInitialWorkspace();
  const seedReport = evaluateProjectReadiness(ws.projects[0]);
  const blankReport = evaluateProjectReadiness(createBlankProject('Empty'));

  assert.ok(seedReport.scorePercent > blankReport.scorePercent);
  assert.ok(seedReport.scorePercent >= 70 && seedReport.scorePercent <= 100);
  assert.ok(blankReport.checks.some((c) => c.severity === 'error' || c.severity === 'warning'));
});
