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

export function getSupabaseUrl(): string | undefined {
  return (getEnvVar('VITE_SUPABASE_URL') || getEnvVar('SUPABASE_URL'))?.trim();
}

export function getSupabaseAnonKey(): string | undefined {
  return (
    getEnvVar('VITE_SUPABASE_ANON_KEY') ||
    getEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY') ||
    getEnvVar('SUPABASE_ANON_KEY') ||
    getEnvVar('SUPABASE_PUBLISHABLE_KEY')
  )?.trim();
}

// Treat placeholder strings from .env.example or unconfigured states as false
export const isPlaceholder = (val?: string): boolean => {
  if (!val) return true;
  const trimmed = val.trim();
  return (
    trimmed.startsWith('<') ||
    trimmed.endsWith('>') ||
    trimmed.includes('your-project-id') ||
    trimmed.includes('your-anon-publishable-key') ||
    trimmed === 'MY_SUPABASE_URL' ||
    trimmed === 'MY_SUPABASE_ANON_KEY' ||
    trimmed === 'MY_SUPABASE_PUBLISHABLE_KEY' ||
    trimmed.includes('MY_SUPABASE_PUBLISHABLE_KEY') ||
    trimmed.includes('MY_SUPABASE_ANON_KEY')
  );
};

export const isSupabaseConfigured = (): boolean => {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  return Boolean(url && anonKey && !isPlaceholder(url) && !isPlaceholder(anonKey));
};

let cachedClient: SupabaseClient | null = null;
let lastClientKey: string | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  const url = getSupabaseUrl()!;
  const anonKey = getSupabaseAnonKey()!;
  const clientKey = `${url}:${anonKey}`;
  if (!cachedClient || lastClientKey !== clientKey) {
    cachedClient = createClient(url, anonKey, {
      auth: {
        flowType: 'pkce',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
    lastClientKey = clientKey;
  }
  return cachedClient;
}

export function getSupabaseConfig(): {
  url: string | null;
  isConfigured: boolean;
  missingKeys: string[];
} {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  const missing: string[] = [];
  if (!url || isPlaceholder(url)) missing.push('VITE_SUPABASE_URL');
  if (!anonKey || isPlaceholder(anonKey)) missing.push('VITE_SUPABASE_ANON_KEY');

  return {
    url: url && !isPlaceholder(url) ? url : null,
    isConfigured: missing.length === 0,
    missingKeys: missing,
  };
}
