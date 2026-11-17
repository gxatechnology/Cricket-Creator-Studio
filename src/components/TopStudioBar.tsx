import React from 'react';
import {
  Clapperboard,
  Command,
  Monitor,
  Play,
  Redo2,
  Smartphone,
  Square,
  Undo2,
  User,
} from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import { useAuth } from '../auth/AuthContext';
import type { AspectRatio, StudioModuleId } from '../types/studio';

const MODULE_TITLES: Record<StudioModuleId, string> = {
  dashboard: 'Project Dashboard',
  timeline: 'Production Timeline',
  field: 'Cricket Field Designer',
  quiz: 'Quiz Video Builder',
  graphics: 'Brand & Broadcast Graphics',
  audio: 'Audio & Voiceover Workspace',
  preview: 'Animation Preview',
  export: 'Export & Render Center',
  publish: 'Package & YouTube Metadata',
  projects: 'Project Manager',
};

export function TopStudioBar() {
  const {
    activeModule,
    setActiveModule,
    activeProject,
    updateActiveProject,
    undo,
    redo,
    canUndo,
    canRedo,
    saveStatus,
    setCommandPaletteOpen,
    setAccountModalOpen,
  } = useStudio();
  const { profile, isGuest } = useAuth();

  const cycleAspectRatio = () => {
    const order: AspectRatio[] = ['16:9', '9:16', '1:1'];
    const next = order[(order.indexOf(activeProject.settings.aspectRatio) + 1) % order.length];
    updateActiveProject((prev) => ({
      ...prev,
      settings: { ...prev.settings, aspectRatio: next },
    }));
  };

  return (
    <header className="h-14 shrink-0 bg-[#0C1426] border-b border-slate-800/80 px-5 flex items-center justify-between gap-6">
      {/* Zone 1: Contextual Workspace Breadcrumb */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs text-slate-400 whitespace-nowrap shrink-0">
          {activeProject.settings.seriesName}
        </span>
        <span className="text-slate-600 shrink-0" aria-hidden="true">
          /
        </span>
        <h1 className="text-sm font-display font-semibold text-slate-100 truncate">
          {MODULE_TITLES[activeModule]}
        </h1>
      </div>

      {/* Zone 2: Undo/Redo, Command Palette, Autosave State */}
      <div className="hidden lg:flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            aria-label="Undo (Ctrl+Z)"
            title="Undo (Ctrl+Z)"
            className="p-1.5 rounded bg-[#131E38] hover:bg-[#1B2B4F] border border-slate-800 text-slate-300 disabled:opacity-35"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            aria-label="Redo (Ctrl+Shift+Z)"
            title="Redo (Ctrl+Shift+Z)"
            className="p-1.5 rounded bg-[#131E38] hover:bg-[#1B2B4F] border border-slate-800 text-slate-300 disabled:opacity-35"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          className="px-2.5 py-1 rounded bg-[#080E1A] hover:bg-[#131E38] border border-slate-800 text-xs text-slate-400 flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <Command className="w-3 h-3 text-[#D4AF37]" />
          <span>Search commands</span>
          <span className="font-mono-tabular text-[10px] text-slate-500">Ctrl+K</span>
        </button>

        <span
          data-testid="autosave-status"
          className={`text-xs font-mono-tabular whitespace-nowrap shrink-0 ${
            saveStatus === 'error'
              ? 'text-red-400'
              : saveStatus === 'saving'
              ? 'text-amber-300'
              : 'text-slate-400'
          }`}
        >
          {saveStatus === 'saving'
            ? 'Saving...'
            : saveStatus === 'error'
            ? 'Save Error'
            : 'Saved'}
        </span>
      </div>

      {/* Zone 3: Format Cycle + Preview Launch */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          type="button"
          onClick={cycleAspectRatio}
          aria-label={`Switch aspect ratio, currently ${activeProject.settings.aspectRatio}`}
          className="px-3 py-1.5 rounded-md bg-[#131E38] hover:bg-[#1A284A] border border-slate-700/80 text-xs font-medium text-slate-200 flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
        >
          {activeProject.settings.aspectRatio === '16:9' ? (
            <Monitor className="w-3.5 h-3.5 text-[#D4AF37]" />
          ) : activeProject.settings.aspectRatio === '9:16' ? (
            <Smartphone className="w-3.5 h-3.5 text-[#D4AF37]" />
          ) : (
            <Square className="w-3.5 h-3.5 text-[#D4AF37]" />
          )}
          <span className="font-mono-tabular">{activeProject.settings.aspectRatio}</span>
        </button>

        {activeModule !== 'preview' && (
          <button
            type="button"
            onClick={() => setActiveModule('preview')}
            className="px-3.5 py-1.5 rounded-md bg-[#131E38] hover:bg-[#1B2B4F] border border-slate-700/80 text-slate-100 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Play className="w-3.5 h-3.5 fill-current text-[#D4AF37]" />
            <span>Open Preview</span>
          </button>
        )}

        {activeModule !== 'export' && (
          <button
            type="button"
            onClick={() => setActiveModule('export')}
            className="px-4 py-1.5 rounded-md bg-[#D4AF37] hover:bg-[#E2BE48] text-[#080E1A] text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
          >
            <Clapperboard className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        )}

        <div className="h-5 w-[1px] bg-slate-800/80 mx-0.5" aria-hidden="true" />

        {/* Creator Account Entry Point */}
        <button
          type="button"
          onClick={() => setAccountModalOpen(true)}
          title={!isGuest && profile ? `Creator: ${profile.name} (${profile.email})` : 'Account & Sign In'}
          className="pl-2 pr-2.5 py-1.5 rounded-md bg-[#131E38] hover:bg-[#1B2B4F] border border-slate-700/80 hover:border-[#D4AF37]/50 text-xs font-medium text-slate-200 flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
        >
          {!isGuest && profile ? (
            <>
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.name}
                  className="w-4 h-4 rounded-full object-cover border border-[#D4AF37]"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-4 h-4 rounded-full bg-[#D4AF37] text-[#080E1A] font-bold text-[9px] flex items-center justify-center">
                  {profile.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <span className="max-w-[85px] truncate font-medium">{profile.name}</span>
            </>
          ) : (
            <>
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-300">Account</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
}
