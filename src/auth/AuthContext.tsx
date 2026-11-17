import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import {
  getSupabaseClient,
  getSupabaseConfig,
  isSupabaseConfigured,
} from './supabaseClient';

export interface UserProfile {
  id: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
  provider: string;
  createdAt: string;
}

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isGuest: boolean;
  isConfigured: boolean;
  authError: string | null;
  missingConfigKeys: string[];
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
  getAccessToken: () => Promise<string | null>;
}

// Module-level token holder for non-React export/persistence calls
let activeAccessToken: string | null = null;

export function getAuthAccessToken(): string | null {
  return activeAccessToken;
}

export function setAuthAccessToken(token: string | null): void {
  activeAccessToken = token;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function extractProfileFromUser(user: User): UserProfile {
  const metadata = user.user_metadata || {};
  const name =
    metadata.full_name ||
    metadata.name ||
    metadata.user_name ||
    user.email?.split('@')[0] ||
    'Cricket Creator';

  const avatarUrl =
    metadata.avatar_url ||
    metadata.picture ||
    null;

  return {
    id: user.id,
    email: user.email || null,
    name,
    avatarUrl,
    provider: user.app_metadata?.provider || 'google',
    createdAt: user.created_at,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const configInfo = useMemo(() => getSupabaseConfig(), []);
  const supabase = useMemo(() => getSupabaseClient(), []);

  // Initialize session and listen to auth changes
  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    // Check for active session
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          setAuthError(error.message);
        } else if (data.session) {
          setSession(data.session);
          setUser(data.session.user);
          setAuthAccessToken(data.session.access_token);
        }

        // Clean up OAuth query parameters (e.g. ?code=...) if present
        if (typeof window !== 'undefined' && window.location.search.includes('code=')) {
          const url = new URL(window.location.href);
          url.searchParams.delete('code');
          url.searchParams.delete('state');
          window.history.replaceState({}, document.title, url.pathname + url.search);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setAuthError(err instanceof Error ? err.message : 'Failed to retrieve auth session');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    // Subscribe to auth state updates
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!isMounted) return;

      setSession(newSession);
      setUser(newSession?.user || null);
      setAuthAccessToken(newSession?.access_token || null);

      if (event === 'SIGNED_IN') {
        setAuthError(null);
      } else if (event === 'SIGNED_OUT') {
        setAuthAccessToken(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signInWithGoogle = useCallback(async (): Promise<{ error: Error | null }> => {
    setAuthError(null);
    if (!supabase || !isSupabaseConfigured()) {
      const err = new Error(
        'Supabase authentication is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.'
      );
      setAuthError(err.message);
      return { error: err };
    }

    try {
      const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        setAuthError(error.message);
        return { error };
      }
      return { error: null };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setAuthError(error.message);
      return { error };
    }
  }, [supabase]);

  const signOut = useCallback(async (): Promise<void> => {
    setAuthError(null);
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Sign out failed');
      }
    }
    setSession(null);
    setUser(null);
    setAuthAccessToken(null);
  }, [supabase]);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token || null;
    setAuthAccessToken(token);
    return token;
  }, [supabase]);

  const profile = useMemo(() => {
    return user ? extractProfileFromUser(user) : null;
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile,
      isLoading,
      isGuest: !user,
      isConfigured: configInfo.isConfigured,
      authError,
      missingConfigKeys: configInfo.missingKeys,
      signInWithGoogle,
      signOut,
      clearAuthError,
      getAccessToken,
    }),
    [
      user,
      session,
      profile,
      isLoading,
      configInfo.isConfigured,
      configInfo.missingKeys,
      authError,
      signInWithGoogle,
      signOut,
      clearAuthError,
      getAccessToken,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
