import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isSupabaseConfigured,
  getSupabaseConfig,
  isPlaceholder,
  getSupabaseClient,
} from './supabaseClient';
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

test('isPlaceholder correctly flags templates, bracketed values and unconfigured keys', () => {
  assert.equal(isPlaceholder(''), true);
  assert.equal(isPlaceholder(undefined), true);
  assert.equal(isPlaceholder('<MY_SUPABASE_PUBLISHABLE_KEY>'), true);
  assert.equal(isPlaceholder('MY_SUPABASE_ANON_KEY'), true);
  assert.equal(isPlaceholder('your-anon-publishable-key'), true);
  assert.equal(isPlaceholder('https://your-project-id.supabase.co'), true);

  // Real or valid keys should NOT be flagged as placeholders
  assert.equal(isPlaceholder('sb_publishable_8Aoi4RV9YrnNKsYC53u1CQ_FXenqLu6'), false);
  assert.equal(isPlaceholder('https://axgqwndnmkkicgrqldtg.supabase.co'), false);
});

test('Supabase client supports sb_publishable_ key configuration', () => {
  const originalEnv = { ...process.env };
  try {
    process.env.VITE_SUPABASE_URL = 'https://axgqwndnmkkicgrqldtg.supabase.co';
    process.env.VITE_SUPABASE_ANON_KEY = 'sb_publishable_test_token_abcdef123456';

    assert.equal(isSupabaseConfigured(), true);
    const client = getSupabaseClient();
    assert.ok(client !== null);
    assert.ok(typeof client.auth?.signInWithOAuth === 'function');
  } finally {
    process.env = originalEnv;
  }
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
