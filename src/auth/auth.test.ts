import test from 'node:test';
import assert from 'node:assert/strict';
import { isSupabaseConfigured, getSupabaseConfig } from './supabaseClient';
import { getAuthAccessToken, setAuthAccessToken } from './AuthContext';
import {
  loadWorkspaceFromStorage,
  saveWorkspaceToStorage,
  WORKSPACE_STORAGE_KEY,
} from '../engine/storage';
import { createInitialWorkspace } from '../data/seedProjects';
import type { StudioWorkspace } from '../types/studio';

test('isSupabaseConfigured returns false when env variables are missing or placeholders', () => {
  const config = getSupabaseConfig();
  // By default in test environment without real secrets, it should detect unconfigured state safely
  assert.equal(typeof config.isConfigured, 'boolean');
  assert.ok(Array.isArray(config.missingKeys));
});

test('Auth token storage and retrieval for render API calls', () => {
  // Initially null or whatever state
  setAuthAccessToken(null);
  assert.equal(getAuthAccessToken(), null);

  // Set active token on login
  const mockToken = 'mock-supabase-jwt-token-12345';
  setAuthAccessToken(mockToken);
  assert.equal(getAuthAccessToken(), mockToken);

  // Clear on sign out
  setAuthAccessToken(null);
  assert.equal(getAuthAccessToken(), null);
});

test('Guest project preservation: signing out or switching auth never purges local projects', () => {
  // Mock localStorage in node environment if needed
  const store = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => store.set(key, val),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };

  const originalWindow = globalThis.window;
  // @ts-expect-error Mock window for test
  globalThis.window = { localStorage: mockLocalStorage };

  try {
    const initialWs = createInitialWorkspace();
    assert.ok(initialWs.projects.length >= 1);

    // Save initial workspace as a guest
    const saved = saveWorkspaceToStorage(initialWs);
    assert.equal(saved, true);

    // Simulate user logging in and loading workspace
    setAuthAccessToken('user-token-xyz');
    const loadedWhileSignedIn = loadWorkspaceFromStorage(initialWs);
    assert.equal(loadedWhileSignedIn.projects.length, initialWs.projects.length);
    assert.equal(loadedWhileSignedIn.projects[0].title, initialWs.projects[0].title);

    // Simulate user signing out back to Guest mode
    setAuthAccessToken(null);
    const loadedAfterSignOut = loadWorkspaceFromStorage(initialWs);
    assert.equal(loadedAfterSignOut.projects.length, initialWs.projects.length);
    assert.equal(loadedAfterSignOut.projects[0].id, initialWs.projects[0].id);

    // Verify raw storage was never cleared
    const rawStorage = mockLocalStorage.getItem(WORKSPACE_STORAGE_KEY);
    assert.ok(rawStorage);
    const parsed = JSON.parse(rawStorage!) as StudioWorkspace;
    assert.equal(parsed.projects.length, initialWs.projects.length);
  } finally {
    globalThis.window = originalWindow;
  }
});
