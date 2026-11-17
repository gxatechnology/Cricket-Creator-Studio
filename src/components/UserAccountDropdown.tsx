import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  FolderKanban,
  LayoutDashboard,
  LogIn,
  LogOut,
  Settings,
  Shield,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useRouter } from '../router/RouterContext';

interface UserAccountDropdownProps {
  onOpenSettings?: () => void;
  className?: string;
  align?: 'left' | 'right';
}

export function UserAccountDropdown({
  onOpenSettings,
  className = '',
  align = 'right',
}: UserAccountDropdownProps) {
  const { user, profile, isGuest, signOut, signInWithGoogle, isConfigured } = useAuth();
  const { navigate, currentPath } = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or escape
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Close dropdown on route change
  useEffect(() => {
    setIsOpen(false);
  }, [currentPath]);

  const handleOpenAccount = () => {
    setIsOpen(false);
    if (onOpenSettings) {
      onOpenSettings();
    } else {
      navigate('/settings');
    }
  };

  const handleGoToDashboard = () => {
    setIsOpen(false);
    navigate('/dashboard');
  };

  const handleGoToProjects = () => {
    setIsOpen(false);
    navigate('/dashboard');
    // Smooth scroll to projects section if on dashboard
    setTimeout(() => {
      const el = document.getElementById('creator-projects-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const handleSignOut = async () => {
    setIsOpen(false);
    await signOut();
    navigate('/');
  };

  const handleSignIn = () => {
    setIsOpen(false);
    navigate('/login');
  };

  // ---------------- GUEST MODE TRIGGER ----------------
  if (isGuest || !profile) {
    return (
      <div ref={containerRef} className={`relative inline-block ${className}`}>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-label="Account options"
          className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#131E38] hover:bg-[#1B2B4F] border border-slate-700/80 text-xs font-medium text-slate-200 flex items-center gap-1.5 sm:gap-2 transition-colors min-h-[36px]"
        >
          <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0">
            <UserIcon className="w-3 h-3 text-slate-400" />
          </div>
          <span className="hidden sm:inline text-slate-300">Guest</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {isOpen && (
          <div
            role="menu"
            aria-label="Guest account menu"
            className={`absolute ${
              align === 'right' ? 'right-0' : 'left-0'
            } mt-2 w-56 max-w-[calc(100vw-1.5rem)] rounded-xl bg-[#0C1426] border border-slate-700/80 shadow-2xl p-1.5 z-50 animate-fade-in`}
          >
            {/* Header info */}
            <div className="px-3 py-2 border-b border-slate-800/90 text-left">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-100">Guest Creator</span>
                <span className="px-1.5 py-0.5 rounded bg-amber-950/70 border border-amber-500/40 text-[9px] font-mono text-amber-300">
                  Offline
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Projects saved locally</p>
            </div>

            <div className="py-1 space-y-0.5">
              <button
                type="button"
                role="menuitem"
                onClick={handleSignIn}
                className="w-full min-h-[38px] px-3 py-2 rounded-lg text-left text-xs font-medium text-white hover:bg-[#16233F] flex items-center gap-2.5 transition-colors"
              >
                <LogIn className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Sign in with Google</span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={handleGoToDashboard}
                className="w-full min-h-[38px] px-3 py-2 rounded-lg text-left text-xs font-medium text-slate-200 hover:bg-[#16233F] flex items-center gap-2.5 transition-colors"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-slate-400" />
                <span>My Dashboard</span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={handleOpenAccount}
                className="w-full min-h-[38px] px-3 py-2 rounded-lg text-left text-xs font-medium text-slate-200 hover:bg-[#16233F] flex items-center gap-2.5 transition-colors"
              >
                <Settings className="w-3.5 h-3.5 text-slate-400" />
                <span>Account Settings</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------------- AUTHENTICATED CREATOR TRIGGER ----------------
  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Creator Account Menu"
        title={`Creator: ${profile.name}`}
        className="px-2 sm:pl-2 sm:pr-2.5 py-1 rounded-lg bg-[#131E38] hover:bg-[#1B2B4F] border border-slate-700/80 hover:border-[#D4AF37]/50 text-xs font-medium text-slate-200 flex items-center gap-1.5 sm:gap-2 transition-colors min-h-[36px]"
      >
        {profile.avatarUrl ? (
          <img
            src={profile.avatarUrl}
            alt={profile.name}
            className="w-5 h-5 rounded-full object-cover border border-[#D4AF37] shrink-0"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-[#D4AF37] text-[#080E1A] font-bold text-[10px] flex items-center justify-center shrink-0">
            {profile.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <span className="hidden sm:inline max-w-[90px] md:max-w-[120px] truncate font-medium text-slate-100">
          {profile.name}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          aria-label="Creator account options"
          className={`absolute ${
            align === 'right' ? 'right-0' : 'left-0'
          } mt-2 w-64 max-w-[calc(100vw-1.5rem)] rounded-xl bg-[#0C1426] border border-slate-700/80 shadow-2xl p-1.5 z-50 animate-fade-in`}
        >
          {/* User Profile Header */}
          <div className="px-3 py-2.5 border-b border-slate-800/90 text-left">
            <div className="flex items-center gap-2.5">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.name}
                  className="w-8 h-8 rounded-full object-cover border border-[#D4AF37] shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#D4AF37] text-[#080E1A] font-bold text-xs flex items-center justify-center shrink-0">
                  {profile.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-white truncate">{profile.name}</div>
                <div className="text-[11px] text-slate-400 truncate">{profile.email}</div>
              </div>
            </div>

            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span>Google Connected</span>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-1 space-y-0.5">
            <button
              type="button"
              role="menuitem"
              onClick={handleOpenAccount}
              className="w-full min-h-[38px] px-3 py-2 rounded-lg text-left text-xs font-medium text-slate-200 hover:bg-[#16233F] hover:text-white flex items-center gap-2.5 transition-colors"
            >
              <UserIcon className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>My Account</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={handleGoToDashboard}
              className="w-full min-h-[38px] px-3 py-2 rounded-lg text-left text-xs font-medium text-slate-200 hover:bg-[#16233F] hover:text-white flex items-center gap-2.5 transition-colors"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-slate-400" />
              <span>My Dashboard</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={handleGoToProjects}
              className="w-full min-h-[38px] px-3 py-2 rounded-lg text-left text-xs font-medium text-slate-200 hover:bg-[#16233F] hover:text-white flex items-center gap-2.5 transition-colors"
            >
              <FolderKanban className="w-3.5 h-3.5 text-slate-400" />
              <span>My Projects</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={handleOpenAccount}
              className="w-full min-h-[38px] px-3 py-2 rounded-lg text-left text-xs font-medium text-slate-200 hover:bg-[#16233F] hover:text-white flex items-center gap-2.5 transition-colors"
            >
              <Settings className="w-3.5 h-3.5 text-slate-400" />
              <span>Account Settings</span>
            </button>
          </div>

          {/* Sign Out */}
          <div className="pt-1 border-t border-slate-800/90">
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="w-full min-h-[38px] px-3 py-2 rounded-lg text-left text-xs font-medium text-red-400 hover:bg-red-950/40 hover:text-red-300 flex items-center gap-2.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5 text-red-400" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
