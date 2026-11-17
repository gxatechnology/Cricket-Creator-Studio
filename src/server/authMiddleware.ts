import type { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface ServerAuthenticatedUser {
  id: string;
  email: string | null;
  isGuest: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: ServerAuthenticatedUser;
    }
  }
}

let serverSupabase: SupabaseClient | null = null;

export function initServerSupabase(url?: string, anonKey?: string): SupabaseClient | null {
  const finalUrl = url || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const finalKey = anonKey || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (
    finalUrl &&
    finalKey &&
    !finalUrl.includes('your-project-id') &&
    !finalKey.includes('your-anon-publishable-key')
  ) {
    serverSupabase = createClient(finalUrl, finalKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  } else {
    serverSupabase = null;
  }
  return serverSupabase;
}

export function isLoopbackAddress(ip?: string): boolean {
  if (!ip) return false;
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip === 'localhost'
  );
}

export function isLocalGuestAllowed(req: Request): boolean {
  // If strict auth is explicitly required by environment, disallow guest access
  if (process.env.REQUIRE_AUTH === 'true') {
    return false;
  }

  // In non-production development environments, local guest is always allowed
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }

  // In production, only permit guest if the request originates from loopback
  const clientIp = req.ip || req.socket.remoteAddress;
  return isLoopbackAddress(clientIp);
}

export async function authenticateRenderRequest(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (token && token !== 'guest' && token !== 'guest:local') {
    // If running in test with test token format
    if (token.startsWith('test-user-') && process.env.NODE_ENV === 'test') {
      req.user = {
        id: token,
        email: `${token}@example.com`,
        isGuest: false,
      };
      next();
      return;
    }

    // Verify token with Supabase
    const client = serverSupabase || initServerSupabase();
    if (client) {
      try {
        const { data, error } = await client.auth.getUser(token);
        if (error || !data.user) {
          res.status(401).json({ error: error?.message || 'Invalid or expired authorization token.' });
          return;
        }
        req.user = {
          id: data.user.id,
          email: data.user.email || null,
          isGuest: false,
        };
        next();
        return;
      } catch (err) {
        res.status(401).json({ error: 'Failed to verify authorization token.' });
        return;
      }
    } else {
      // Supabase is not configured on server
      // If REQUIRE_AUTH is true, reject
      if (process.env.REQUIRE_AUTH === 'true') {
        res.status(503).json({ error: 'Supabase authentication is not configured on the server.' });
        return;
      }
    }
  }

  // Check if guest access is allowed
  if (isLocalGuestAllowed(req)) {
    req.user = {
      id: 'guest:local',
      email: null,
      isGuest: true,
    };
    next();
    return;
  }

  res.status(401).json({
    error: 'Authentication required. You must be signed in with Google or run in local development mode.',
  });
}

export function verifyJobOwnership(
  jobOwnerId: string | undefined,
  user?: ServerAuthenticatedUser
): { allowed: boolean; reason?: string } {
  if (!user) {
    return { allowed: false, reason: 'Authentication required.' };
  }
  const effectiveJobOwner = jobOwnerId || 'guest:local';
  if (effectiveJobOwner === user.id) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: 'Access denied: You do not have permission to access or modify this render job.',
  };
}
