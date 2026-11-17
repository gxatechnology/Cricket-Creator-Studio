import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  LogOut,
  Mail,
  Shield,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AccountModal({ isOpen, onClose }: AccountModalProps) {
  const {
    profile,
    isGuest,
    isConfigured,
    authError,
    clearAuthError,
    signInWithGoogle,
    signOut,
    isLoading,
  } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-settings-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md rounded-2xl bg-[#0C1426] border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800/90 flex items-center justify-between bg-[#0A1120]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/15 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37]">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 id="account-settings-title" className="text-sm font-display font-bold text-slate-100">
                Account Settings
              </h2>
              <p className="text-[11px] text-slate-400">
                {isGuest ? 'Local-first offline mode' : 'Creator profile & preferences'}
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
        <div className="p-6 space-y-5 text-xs">
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

          {/* Signed In Profile Card */}
          {!isGuest && profile ? (
            <div className="space-y-4">
              {/* Profile Card */}
              <div className="p-4 rounded-xl bg-[#0F1A30] border border-slate-700/70 flex items-center gap-4">
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.name}
                    className="w-14 h-14 rounded-full border-2 border-[#D4AF37] object-cover shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-[#D4AF37] text-[#080E1A] font-bold text-lg flex items-center justify-center shrink-0">
                    {profile.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-slate-100 truncate">{profile.name}</div>
                  <div className="text-xs text-slate-400 truncate mt-0.5 flex items-center gap-1.5">
                    <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                    <span>{profile.email}</span>
                  </div>
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-500/40 text-[10px] font-mono text-emerald-300">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Google Account Connected</span>
                  </div>
                </div>
              </div>

              {/* Account Details */}
              <div className="p-3.5 rounded-xl bg-[#090F1E] border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Display Name</span>
                  <span className="font-medium text-slate-200 truncate max-w-[180px]">{profile.name}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-800/80">
                  <span className="text-slate-400">Primary Email</span>
                  <span className="font-medium text-slate-200 truncate max-w-[180px]">{profile.email}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-800/80">
                  <span className="text-slate-400">Storage Mode</span>
                  <span className="text-slate-300 font-mono text-[10.5px]">Local Device (Offline-Ready)</span>
                </div>
              </div>
            </div>
          ) : (
            /* Guest Creator Card */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#0F1A30] border border-slate-700/60 space-y-3 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 mx-auto">
                  <UserIcon className="w-6 h-6 text-slate-400" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-100">Guest Creator</div>
                  <p className="text-xs text-slate-400 mt-1">
                    You are working in offline guest mode. All projects and assets are saved securely in your browser storage.
                  </p>
                </div>

                {isConfigured && (
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isLoading || isSigningIn}
                    className="w-full mt-2 py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs flex items-center justify-center gap-2.5 transition-all shadow-md active:scale-[0.99] disabled:opacity-50"
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
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-slate-800/90 bg-[#0A1120] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            {isGuest ? 'Continue as Guest' : 'Done'}
          </button>

          {!isGuest && (
            <button
              type="button"
              onClick={handleSignOut}
              className="px-3.5 py-2 rounded-lg bg-red-950/60 hover:bg-red-900/60 border border-red-700/50 text-red-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
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
