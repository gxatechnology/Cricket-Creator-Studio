import React from 'react';
import {
  Clapperboard,
  Compass,
  Film,
  FolderKanban,
  HelpCircle,
  LayoutDashboard,
  Palette,
  PlaySquare,
  Plus,
  Share2,
  Shield,
  Volume2,
  X,
} from 'lucide-react';
import type { StudioModuleId } from '../types/studio';
import { useStudio } from '../context/StudioContext';
import { useAuth } from '../auth/AuthContext';
import { countCompleteQuestions } from '../engine/timeline';

interface NavItem {
  id: StudioModuleId;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Overview & Readiness',
    subtitle: 'Health & snapshots',
    icon: LayoutDashboard,
  },
  {
    id: 'quiz',
    label: 'Quiz Builder',
    subtitle: 'Importer, AI assist & bank',
    icon: HelpCircle,
  },
  {
    id: 'field',
    label: 'Field Designer',
    subtitle: '23 presets & ball animation',
    icon: Compass,
  },
  {
    id: 'preview',
    label: 'Animation Preview',
    subtitle: '16:9, 9:16 & 1:1 stage',
    icon: PlaySquare,
  },
  {
    id: 'timeline',
    label: 'Production Timeline',
    subtitle: 'Multi-track & Auto Build',
    icon: Film,
  },
  {
    id: 'graphics',
    label: 'Brand & Graphics',
    subtitle: 'Brand kit, overlays & thumb',
    icon: Palette,
  },
  {
    id: 'audio',
    label: 'Audio & Voiceover',
    subtitle: 'Tracks, SFX & narration',
    icon: Volume2,
  },
  {
    id: 'export',
    label: 'Export Center',
    subtitle: 'MP4, Shorts & render queue',
    icon: Clapperboard,
  },
  {
    id: 'publish',
    label: 'Package & Assets',
    subtitle: 'YouTube metadata & ZIP',
    icon: Share2,
  },
  {
    id: 'projects',
    label: 'Project Manager',
    subtitle: 'Library & snapshots',
    icon: FolderKanban,
  },
];

export function SidebarNav() {
  const {
    activeModule,
    setActiveModule,
    activeProject,
    workspace,
    setWizardOpen,
    setAccountModalOpen,
    mobileNavOpen,
    setMobileNavOpen,
  } = useStudio();
  const { profile, isGuest } = useAuth();
  const completedQuizCount = countCompleteQuestions(activeProject.quizQuestions);

  const handleSelectModule = (id: StudioModuleId) => {
    setActiveModule(id);
    setMobileNavOpen(false);
  };

  const navContent = (
    <div className="flex flex-col justify-between h-full w-[260px] bg-[#0A1120] border-r border-slate-800/80">
      <div className="flex flex-col min-h-0 flex-1">
        {/* Studio Monogram Header */}
        <div className="h-14 px-4 border-b border-slate-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-[#D4AF37] text-[#080E1A] flex items-center justify-center font-display font-bold text-sm shrink-0">
              CC
            </div>
            <span className="font-display font-bold text-sm tracking-tight text-slate-100 whitespace-nowrap truncate">
              Production Studio
            </span>
          </div>

          {/* Close button on mobile */}
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation drawer"
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action: New Project */}
        <div className="px-3 pt-3 pb-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              setWizardOpen(true);
              setMobileNavOpen(false);
            }}
            className="w-full py-2 px-3 rounded-lg bg-[#D4AF37] hover:bg-[#E2BE48] text-[#080E1A] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Episode Wizard</span>
          </button>
        </div>

        {/* Modules Navigation Links */}
        <nav className="p-2.5 space-y-0.5 overflow-y-auto flex-1" aria-label="Studio Modules">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectModule(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${
                  isActive
                    ? 'bg-[#16233F] text-[#F4D57A] border border-[#D4AF37]/35 shadow-sm'
                    : 'text-slate-300 hover:bg-[#111B33] hover:text-slate-100 border border-transparent'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-[#D4AF37]' : 'text-slate-400'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-semibold leading-tight whitespace-nowrap truncate">
                    {item.label}
                  </div>
                  <div className="text-[10px] text-slate-400 leading-tight mt-0.5 whitespace-nowrap truncate">
                    {item.subtitle}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-3.5 border-t border-slate-800/80 space-y-2 text-xs text-slate-400 shrink-0 bg-[#080E1A]">
        <div>
          <div className="text-[10px] font-medium text-slate-400">Active Episode</div>
          <div className="text-slate-100 font-semibold mt-0.5 truncate text-xs" title={activeProject.title}>
            {activeProject.title}
          </div>
        </div>
        <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 font-mono-tabular text-[11px]">
          <span>Quiz Bank</span>
          <span className="text-[#E5B94C]">
            {completedQuizCount}/{activeProject.quizQuestions.length}
          </span>
        </div>
        <div className="flex items-center justify-between font-mono-tabular text-[11px]">
          <span>Saved Projects</span>
          <span className="text-slate-200">{workspace.projects.length}</span>
        </div>

        <button
          type="button"
          onClick={() => {
            setAccountModalOpen(true);
            setMobileNavOpen(false);
          }}
          className="w-full mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-left hover:opacity-90 transition-opacity"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <div className={`w-2 h-2 rounded-full shrink-0 ${!isGuest ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span className="text-[11px] text-slate-300 font-medium truncate">
              {!isGuest && profile ? profile.name : 'Guest Mode (Local)'}
            </span>
          </div>
          <span className="text-[10px] text-[#D4AF37] font-semibold shrink-0">Account</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex shrink-0 h-full">{navContent}</aside>

      {/* Mobile Drawer Overlay */}
      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileNavOpen(false)}
          />
          {/* Drawer content */}
          <div className="relative z-10 animate-slide-right h-full shadow-2xl">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
}
