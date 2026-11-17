import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Key,
  Shield,
  Sparkles,
  User as UserIcon,
  X,
  Youtube,
} from 'lucide-react';
import { Link, useRouter } from '../router/RouterContext';
import { useAuth } from '../auth/AuthContext';
import { useStudio } from '../context/StudioContext';

export function LoginPage() {
  const { navigate } = useRouter();
  const {
    user,
    profile,
    isGuest,
    isConfigured,
    missingConfigKeys,
    authError,
    clearAuthError,
    signInWithGoogle,
    signOut,
    isLoading,
  } = useAuth();
  const { workspace } = useStudio();
  const [isSigningIn, setIsSigningIn] = useState(false);

  // If an authenticated user visits /login, redirect directly to /dashboard
  React.useEffect(() => {
    if (!isLoading && !isGuest && user) {
      navigate('/dashboard', true);
    }
  }, [isLoading, isGuest, user, navigate]);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    try {
      const res = await signInWithGoogle();
      if (!res.error) {
        navigate('/dashboard');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleContinueAsGuest = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#080E1A] text-slate-100 flex flex-col font-sans selection:bg-[#D4AF37]/30 selection:text-white">
      {/* Header Bar */}
      <header className="h-16 border-b border-slate-800/80 px-4 sm:px-8 flex items-center justify-between bg-[#0A1120]">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#D4AF37] text-[#080E1A] flex items-center justify-center font-display font-bold text-sm">
            CC
          </div>
          <span className="font-display font-bold text-sm tracking-tight text-white">
            Cricket Creator Studio
          </span>
        </Link>

        <Link
          to="/"
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Home</span>
        </Link>
      </header>

      {/* Main Card */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8">
        <div className="w-full max-w-md rounded-2xl bg-[#0C1426] border border-slate-700/80 shadow-2xl p-6 sm:p-8 space-y-6">
          {/* Title Area */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[#D4AF37]/15 border border-[#D4AF37]/35 text-[#D4AF37] flex items-center justify-center mx-auto shadow-md">
              <Shield className="w-6 h-6" />
            </div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-white tracking-tight">
              Creator Authentication
            </h1>
            <p className="text-xs text-slate-400">
              Sign in to manage your cricket episodes, or continue in offline Guest Mode.
            </p>
          </div>

          {/* Auth Error Banner */}
          {authError && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-700/50 text-red-200 flex items-start gap-3 text-xs">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-red-300">Authentication Error</div>
                <div className="text-[11px] text-red-200/90 mt-0.5">{authError}</div>
              </div>
              <button
                type="button"
                onClick={clearAuthError}
                className="text-red-400 hover:text-red-200 p-0.5"
                aria-label="Dismiss error"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Configuration Missing Banner */}
          {!isConfigured && (
            <div className="p-4 rounded-xl bg-[#131E38] border border-amber-500/40 text-slate-200 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-amber-300 font-semibold">
                <Key className="w-4 h-4 shrink-0" />
                <span>Supabase Configuration Required</span>
              </div>
              <p className="text-[11.5px] text-slate-300 leading-relaxed">
                Live Google OAuth requires a connected Supabase project. Add the following to your{' '}
                <code className="px-1 py-0.5 rounded bg-[#080E1A] text-amber-200 font-mono text-[10.5px]">.env</code>:
              </p>
              <div className="p-2.5 rounded-lg bg-[#080E1A] font-mono text-[10.5px] text-slate-300 space-y-1 border border-slate-800">
                <div>VITE_SUPABASE_URL=https://your-project.supabase.co</div>
                <div>VITE_SUPABASE_ANON_KEY=your-anon-publishable-key</div>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-0.5">
                <span>Missing:</span>
                <span className="font-mono text-amber-300">{missingConfigKeys.join(', ')}</span>
              </div>
            </div>
          )}

          {/* If already signed in */}
          {!isGuest && profile ? (
            <div className="p-4 rounded-xl bg-[#0A1120] border border-slate-700/80 space-y-4 text-xs">
              <div className="flex items-center gap-3">
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.name}
                    className="w-10 h-10 rounded-full border-2 border-[#D4AF37] object-cover shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#D4AF37] text-[#080E1A] font-bold text-sm flex items-center justify-center shrink-0">
                    {profile.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-white truncate">{profile.name}</div>
                  <div className="text-[11px] text-slate-400 truncate">{profile.email}</div>
                  <div className="text-[10px] text-emerald-400 mt-0.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Signed in via Google OAuth</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="flex-1 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#E2BE48] text-[#080E1A] font-bold text-xs flex items-center justify-center gap-1.5"
                >
                  <span>Go to Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={signOut}
                  className="py-2.5 px-3 rounded-xl bg-red-950/60 hover:bg-red-900/60 border border-red-700/50 text-red-200 font-semibold text-xs"
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            /* Sign-in Actions for Guests */
            <div className="space-y-3">
              {isConfigured ? (
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading || isSigningIn}
                  className="w-full py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs flex items-center justify-center gap-2.5 transition-all shadow-md active:scale-[0.99] disabled:opacity-50"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.665-5.17 3.665-9.12z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.13C3.26 21.36 7.33 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.58H1.26C.46 8.18 0 9.99 0 12s.46 3.82 1.26 5.42l4.02-3.13z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.26 6.58l4.02 3.13c.95-2.83 3.6-4.96 6.72-4.96z"
                    />
                  </svg>
                  <span>{isSigningIn ? 'Connecting to Google...' : 'Sign in with Google'}</span>
                </button>
              ) : null}

              <button
                type="button"
                onClick={handleContinueAsGuest}
                className="w-full py-3 px-4 rounded-xl bg-[#16233F] hover:bg-[#1E3056] border border-[#D4AF37]/40 text-[#F4D57A] font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
              >
                <UserIcon className="w-4 h-4" />
                <span>Continue in Offline Guest Mode</span>
              </button>
            </div>
          )}

          {/* Privacy & Storage Notice */}
          <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center justify-between text-slate-300 font-medium">
              <span>Local Device Projects:</span>
              <span className="font-mono text-[#D4AF37]">{workspace.projects.length} saved</span>
            </div>
            <p className="text-[10.5px] text-slate-500 leading-relaxed">
              Your episodes remain safely stored on this computer. Guest projects are never overwritten or forcibly
              synced to cloud accounts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
