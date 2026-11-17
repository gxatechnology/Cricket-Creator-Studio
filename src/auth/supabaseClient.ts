import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variable resolution safe for both Vite (browser) and Node.js (test)
function getEnvVar(key: string): string | undefined {
  if (typeof import.meta !== 'undefined' && import.meta.env && typeof import.meta.env[key] === 'string') {
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env && typeof process.env[key] === 'string') {
    return process.env[key];
  }
  return undefined;
}

const rawUrl = getEnvVar('VITE_SUPABASE_URL')?.trim();
const rawAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY')?.trim();

// Treat placeholder strings from .env.example as unconfigured
const isPlaceholder = (val?: string) =>
  !val ||
  val.includes('your-project-id') ||
  val.includes('your-anon-publishable-key') ||
  val === 'MY_SUPABASE_URL' ||
  val === 'MY_SUPABASE_ANON_KEY';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(rawUrl && rawAnonKey && !isPlaceholder(rawUrl) && !isPlaceholder(rawAnonKey));
};

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!cachedClient) {
    cachedClient = createClient(rawUrl!, rawAnonKey!, {
      auth: {
        flowType: 'pkce',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }
  return cachedClient;
}

export function getSupabaseConfig(): {
  url: string | null;
  isConfigured: boolean;
  missingKeys: string[];
} {
  const missing: string[] = [];
  if (isPlaceholder(rawUrl)) missing.push('VITE_SUPABASE_URL');
  if (isPlaceholder(rawAnonKey)) missing.push('VITE_SUPABASE_ANON_KEY');

  return {
    url: rawUrl && !isPlaceholder(rawUrl) ? rawUrl : null,
    isConfigured: missing.length === 0,
    missingKeys: missing,
  };
}
