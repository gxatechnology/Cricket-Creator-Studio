import test from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';
import {
  authenticateRenderRequest,
  isLocalGuestAllowed,
  isLoopbackAddress,
  verifyJobOwnership,
} from './authMiddleware';
import { getRenderApiHeaders } from '../render/renderApiHelper';
import { setAuthAccessToken } from '../auth/AuthContext';

test('isLoopbackAddress detects local network interfaces accurately', () => {
  assert.equal(isLoopbackAddress('127.0.0.1'), true);
  assert.equal(isLoopbackAddress('::1'), true);
  assert.equal(isLoopbackAddress('::ffff:127.0.0.1'), true);
  assert.equal(isLoopbackAddress('localhost'), true);

  assert.equal(isLoopbackAddress('192.168.1.50'), false);
  assert.equal(isLoopbackAddress('10.0.0.5'), false);
  assert.equal(isLoopbackAddress('203.0.113.195'), false);
  assert.equal(isLoopbackAddress(undefined), false);
});

test('isLocalGuestAllowed respects environment safety rules', () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origRequireAuth = process.env.REQUIRE_AUTH;

  try {
    // 1. In dev mode without REQUIRE_AUTH, guest is allowed
    process.env.NODE_ENV = 'development';
    delete process.env.REQUIRE_AUTH;
    const devReq = { ip: '127.0.0.1', socket: {} } as unknown as Request;
    assert.equal(isLocalGuestAllowed(devReq), true);

    // 2. When REQUIRE_AUTH=true, guest is strictly forbidden even on loopback
    process.env.REQUIRE_AUTH = 'true';
    assert.equal(isLocalGuestAllowed(devReq), false);

    // 3. In production mode without REQUIRE_AUTH: allowed on loopback, disallowed for external IPs
    process.env.REQUIRE_AUTH = 'false';
    process.env.NODE_ENV = 'production';
    const prodExternalReq = { ip: '203.0.113.195', socket: {} } as unknown as Request;
    assert.equal(isLocalGuestAllowed(prodExternalReq), false);

    const prodLoopbackReq = { ip: '127.0.0.1', socket: {} } as unknown as Request;
    assert.equal(isLocalGuestAllowed(prodLoopbackReq), true);
  } finally {
    process.env.NODE_ENV = origNodeEnv;
    process.env.REQUIRE_AUTH = origRequireAuth;
  }
});

test('verifyJobOwnership enforces strict cross-user isolation', () => {
  const userA = { id: 'user-creator-aaa-111', email: 'creatorA@example.com', isGuest: false };
  const userB = { id: 'user-creator-bbb-222', email: 'creatorB@example.com', isGuest: false };
  const guestUser = { id: 'guest:local', email: null, isGuest: true };

  // 1. User A accessing User A's job -> Allowed
  const selfAccess = verifyJobOwnership(userA.id, userA);
  assert.equal(selfAccess.allowed, true);

  // 2. User B attempting to access User A's job -> Rejected
  const crossUserAccess = verifyJobOwnership(userA.id, userB);
  assert.equal(crossUserAccess.allowed, false);
  assert.ok(crossUserAccess.reason?.includes('Access denied'));

  // 3. Guest attempting to access User A's job -> Rejected
  const guestCrossAccess = verifyJobOwnership(userA.id, guestUser);
  assert.equal(guestCrossAccess.allowed, false);

  // 4. Guest accessing a local guest job -> Allowed
  const guestLocalAccess = verifyJobOwnership('guest:local', guestUser);
  assert.equal(guestLocalAccess.allowed, true);

  // 5. Unauthenticated access -> Rejected
  const noUserAccess = verifyJobOwnership(userA.id, undefined);
  assert.equal(noUserAccess.allowed, false);
});

test('getRenderApiHeaders attaches Bearer token only when authenticated', () => {
  // Guest mode
  setAuthAccessToken(null);
  const guestHeaders = getRenderApiHeaders({ 'Content-Type': 'application/json' });
  assert.equal(guestHeaders['Content-Type'], 'application/json');
  assert.equal(guestHeaders['Authorization'], undefined);

  // Authenticated mode
  const token = 'supabase-jwt-token-alpha-omega';
  setAuthAccessToken(token);
  const authHeaders = getRenderApiHeaders({ 'Content-Type': 'application/json' });
  assert.equal(authHeaders['Content-Type'], 'application/json');
  assert.equal(authHeaders['Authorization'], `Bearer ${token}`);

  // Cleanup
  setAuthAccessToken(null);
});

test('authenticateRenderRequest middleware handles loopback dev guest vs strict auth', async () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origRequireAuth = process.env.REQUIRE_AUTH;

  try {
    process.env.NODE_ENV = 'test';
    delete process.env.REQUIRE_AUTH;

    // 1. Request with test user token
    let nextCalled = false;
    const reqTestUser = {
      headers: { authorization: 'Bearer test-user-999' },
      ip: '127.0.0.1',
      socket: {},
    } as unknown as Request;

    const resDummy = {
      status: () => resDummy,
      json: () => resDummy,
    } as unknown as Response;

    await authenticateRenderRequest(reqTestUser, resDummy, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.equal(reqTestUser.user?.id, 'test-user-999');
    assert.equal(reqTestUser.user?.isGuest, false);

    // 2. Request with REQUIRE_AUTH=true and missing token -> 401
    process.env.REQUIRE_AUTH = 'true';
    let statusCode: number | null = null;
    let responseBody: unknown = null;

    const reqNoToken = {
      headers: {},
      ip: '127.0.0.1',
      socket: {},
    } as unknown as Request;

    const resCapturing = {
      status: (code: number) => {
        statusCode = code;
        return resCapturing;
      },
      json: (body: unknown) => {
        responseBody = body;
        return resCapturing;
      },
    } as unknown as Response;

    let unauthNextCalled = false;
    await authenticateRenderRequest(reqNoToken, resCapturing, () => {
      unauthNextCalled = true;
    });

    assert.equal(unauthNextCalled, false);
    assert.equal(statusCode, 401);
    assert.ok(
      typeof responseBody === 'object' &&
        responseBody !== null &&
        'error' in responseBody
    );
  } finally {
    process.env.NODE_ENV = origNodeEnv;
    process.env.REQUIRE_AUTH = origRequireAuth;
  }
});
