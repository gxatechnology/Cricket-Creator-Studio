import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePath } from './RouterContext';

test('normalizePath cleans standard absolute paths', () => {
  assert.equal(normalizePath('/'), '/');
  assert.equal(normalizePath('/dashboard'), '/dashboard');
  assert.equal(normalizePath('/studio'), '/studio');
  assert.equal(normalizePath('/login'), '/login');
  assert.equal(normalizePath('/get-started'), '/get-started');
});

test('normalizePath strips query parameters and standard fragments', () => {
  assert.equal(normalizePath('/dashboard?project=123&format=16-9'), '/dashboard');
  assert.equal(normalizePath('/studio?tab=field#section'), '/studio');
  assert.equal(normalizePath('/login?returnTo=%2Fstudio'), '/login');
});

test('normalizePath handles hash fallback routes safely', () => {
  assert.equal(normalizePath('http://localhost:3000/#/dashboard'), '/dashboard');
  assert.equal(normalizePath('/#/studio?scene=pitch'), '/studio');
  assert.equal(normalizePath('#/get-started'), '/get-started');
  assert.equal(normalizePath('#/'), '/');
});

test('normalizePath handles empty string or root variants gracefully', () => {
  assert.equal(normalizePath(''), '/');
  assert.equal(normalizePath('/'), '/');
  assert.equal(normalizePath('?test=1'), '/');
  assert.equal(normalizePath('#section'), '/');
});
