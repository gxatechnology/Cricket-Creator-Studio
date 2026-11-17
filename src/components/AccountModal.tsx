import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Key,
  LogOut,
  Shield,
  User as UserIcon,
  X,
  Youtube,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useStudio } from '../context/StudioContext';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AccountModal({ isOpen, onClose }: AccountModalProps) {
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
  const [copiedId, setCopiedId] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  if (!isOpen) return null;

  const handleCopyId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-[#0C1426] border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800/90 flex items-center justify-between bg-[#0A1120] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/15 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37]">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 id="account-modal-title" className="text-sm font-display font-bold text-slate-100">
                Creator Account & Security
              </h2>
              <p className="text-[11px] text-slate-400">
                {isGuest ? 'Local-first offline mode' : 'Authenticated creator session'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* Auth Error Banner */}
          {authError && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-700/50 text-red-200 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-red-300">Authentication Error</div>
                <div className="text-[11px] text-red-200/90 mt-0.5">{authError}</div>
              </div>
              <button
                type="button"
                onClick={clearAuthError}
                className="text-red-400 hover:text-red-200 p-1"
                aria-label="Dismiss error"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Configuration Missing Banner */}
          {!isConfigured && (
            <div className="p-4 rounded-xl bg-[#131E38]/80 border border-amber-500/40 text-slate-200 space-y-2">
              <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs">
                <Key className="w-4 h-4 shrink-0" />
                <span>Supabase Configuration Required</span>
              </div>
              <p className="text-[11.5px] text-slate-300 leading-relaxed">
                Google OAuth sign-in requires a Supabase project. Add the following to your{' '}
                <code className="px-1 py-0.5 rounded bg-[#080E1A] text-amber-200 font-mono text-[10.5px]">.env</code> file:
              </p>
              <div className="p-2.5 rounded-lg bg-[#080E1A] font-mono text-[10.5px] text-slate-300 space-y-1 border border-slate-800">
                <div>VITE_SUPABASE_URL=https://your-project.supabase.co</div>
                <div>VITE_SUPABASE_ANON_KEY=your-anon-publishable-key</div>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-0.5">
                <span>Missing keys:</span>
                <span className="font-mono text-amber-300">{missingConfigKeys.join(', ')}</span>
              </div>
            </div>
          )}

          {/* Profile Card if Signed In */}
          {!isGuest && profile && (
            <div className="p-4 rounded-xl bg-[#0F1A30] border border-slate-700/70 space-y-4">
              <div className="flex items-center gap-3.5">
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.name}
                    className="w-12 h-12 rounded-full border-2 border-[#D4AF37] object-cover shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[#D4AF37] text-[#080E1A] font-bold text-lg flex items-center justify-center shrink-0">
                    {profile.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-100 truncate">{profile.name}</span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-[10px] font-mono text-emerald-300 shrink-0">
                      Verified
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">{profile.email}</div>
                  <div className="text-[10px] text-[#D4AF37] mt-0.5">
                    Provider: {profile.provider === 'google' ? 'Google OAuth 2.0 (Supabase PKCE)' : profile.provider}
                  </div>
                </div>
              </div>

              {/* User ID block */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Creator ID</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-slate-300 text-[10.5px]">
                    {profile.id.slice(0, 12)}...{profile.id.slice(-6)}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyId}
                    title="Copy full User ID"
                    className="p-1 rounded bg-[#16233F] hover:bg-[#1E3056] text-slate-300 transition-colors"
                  >
                    {copiedId ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Guest Card if Guest */}
          {isGuest && (
            <div className="p-4 rounded-xl bg-[#0F1A30] border border-slate-700/60 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                  <UserIcon className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-200">Guest Creator</span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-500/40 text-[10px] font-mono text-amber-300">
                      Local Mode
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Full offline editing and rendering is enabled.
                  </p>
                </div>
              </div>

              {isConfigured ? (
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading || isSigningIn}
                  className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs flex items-center justify-center gap-2.5 transition-all shadow-md active:scale-[0.99] disabled:opacity-50"
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
                  <span>{isSigningIn ? 'Redirecting to Google...' : 'Sign in with Google'}</span>
                </button>
              ) : null}
            </div>
          )}

          {/* Local Projects & Storage Preservation Notice (Step 4) */}
          <div className="p-3.5 rounded-xl bg-[#090F1E] border border-slate-800 text-[11px] space-y-1.5">
            <div className="flex items-center justify-between text-slate-300 font-medium">
              <span>Local Projects on this Device</span>
              <span className="font-mono text-[#D4AF37]">{workspace.projects.length} project(s)</span>
            </div>
            <p className="text-slate-400 text-[10.5px] leading-relaxed">
              Guest projects remain stored in your local browser storage. Signing in will not overwrite or force-upload
              your local work.
            </p>
          </div>

          {/* Connected Services / Phase 2 Roadmap */}
          <div className="p-3.5 rounded-xl bg-[#090F1E] border border-slate-800 space-y-2.5">
            <div className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
              <Youtube className="w-3.5 h-3.5 text-red-500" />
              <span>YouTube Publishing Foundation</span>
            </div>
            <p className="text-[10.5px] text-slate-400 leading-relaxed">
              Google Sign-In provides the identity foundation for upcoming YouTube channel linking, direct chapter
              upload, and Shorts publishing.
            </p>
            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
              <span>Channel Integration:</span>
              <span className="text-amber-400 font-mono">Phase 2 Target</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-slate-800/90 bg-[#0A1120] flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            {isGuest ? 'Continue as Guest' : 'Close'}
          </button>

          {!isGuest && (
            <button
              type="button"
              onClick={handleSignOut}
              className="px-3.5 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/60 border border-red-700/50 text-red-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
