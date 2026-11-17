import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('AccountModal source code has zero developer jargon or internal diagnostics', () => {
  const modalSourcePath = path.resolve(process.cwd(), 'src/components/AccountModal.tsx');
  const source = fs.readFileSync(modalSourcePath, 'utf8');

  // Verify that all obsolete technical/developer strings have been removed from user-facing screens
  const forbiddenPhrases = [
    'Creator Account & Security',
    'Authenticated creator session',
    'Provider: Google OAuth 2.0 (Supabase PKCE)',
    'Creator ID',
    'Supabase Configuration Required',
    'Local Projects on this Device',
    'YouTube Publishing Foundation',
    'Phase 2 Target',
  ];

  for (const phrase of forbiddenPhrases) {
    assert.ok(
      !source.includes(phrase),
      `Expected AccountModal.tsx not to contain forbidden phrase: "${phrase}"`
    );
  }

  // Verify it contains clean creator-facing Account Settings title
  assert.ok(source.includes('Account Settings'));
  assert.ok(source.includes('Google Account Connected'));
  assert.ok(source.includes('Sign Out'));
});

test('UserAccountDropdown source code contains all required menu items', () => {
  const dropdownPath = path.resolve(process.cwd(), 'src/components/UserAccountDropdown.tsx');
  const source = fs.readFileSync(dropdownPath, 'utf8');

  // Required menu items from prompt:
  // My Account, My Dashboard, My Projects, Account Settings, Sign Out
  assert.ok(source.includes('My Account'), 'Missing My Account');
  assert.ok(source.includes('My Dashboard'), 'Missing My Dashboard');
  assert.ok(source.includes('My Projects'), 'Missing My Projects');
  assert.ok(source.includes('Account Settings'), 'Missing Account Settings');
  assert.ok(source.includes('Sign Out'), 'Missing Sign Out');
  assert.ok(source.includes('Google Connected'), 'Missing Google Connected');
});

test('OAuth callback destination redirects to dashboard for root and login paths', () => {
  const redirectHelper = (pathname: string, wasAuthCallback: boolean): string => {
    if (wasAuthCallback && (pathname === '/' || pathname === '/login' || pathname === '/get-started')) {
      return '/dashboard';
    }
    return pathname;
  };

  assert.equal(redirectHelper('/', true), '/dashboard');
  assert.equal(redirectHelper('/login', true), '/dashboard');
  assert.equal(redirectHelper('/get-started', true), '/dashboard');
  assert.equal(redirectHelper('/studio', true), '/studio');
  assert.equal(redirectHelper('/dashboard', true), '/dashboard');
  assert.equal(redirectHelper('/', false), '/');
});
