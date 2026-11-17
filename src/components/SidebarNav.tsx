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
  Volume2,
} from 'lucide-react';
import type { StudioModuleId } from '../types/studio';
import { useStudio } from '../context/StudioContext';
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
    label: 'Project Dashboard',
    subtitle: 'Readiness & snapshots',
    icon: LayoutDashboard,
  },
  {
    id: 'timeline',
    label: 'Production Timeline',
    subtitle: 'Multi-track & Auto Build',
    icon: Film,
  },
  {
    id: 'field',
    label: 'Cricket Field Designer',
    subtitle: '23 presets & scene library',
    icon: Compass,
  },
  {
    id: 'quiz',
    label: 'Quiz Video Builder',
    subtitle: 'Importer, AI assist & bank',
    icon: HelpCircle,
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
    id: 'preview',
    label: 'Animation Preview',
    subtitle: '16:9, 9:16 & 1:1 stage',
    icon: PlaySquare,
  },
  {
    id: 'export',
    label: 'Export / Render',
    subtitle: 'MP4, Shorts & delivery',
    icon: Clapperboard,
  },
  {
    id: 'publish',
    label: 'Package & YouTube',
    subtitle: 'Assets, ZIP & chapters',
    icon: Share2,
  },
  {
    id: 'projects',
    label: 'Project Manager',
    subtitle: 'Library & New Wizard',
    icon: FolderKanban,
  },
];

export function SidebarNav() {
  const { activeModule, setActiveModule, activeProject, workspace, setWizardOpen } =
    useStudio();
  const completedQuizCount = countCompleteQuestions(activeProject.quizQuestions);

  return (
    <aside className="w-[248px] shrink-0 bg-[#0A1120] border-r border-slate-800/80 flex flex-col justify-between h-full">
      <div className="flex flex-col min-h-0 flex-1">
        <div className="h-14 px-4 border-b border-slate-800/80 flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded bg-[#D4AF37] text-[#080E1A] flex items-center justify-center font-display font-bold text-sm shrink-0">
            CC
          </div>
          <span className="font-display font-bold text-sm tracking-tight text-slate-100 whitespace-nowrap truncate">
            Cricket Creator Studio
          </span>
        </div>

        <div className="px-3 pt-3 pb-1 shrink-0">
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            className="w-full py-2 px-3 rounded-lg bg-[#D4AF37] hover:bg-[#E2BE48] text-[#080E1A] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Project</span>
          </button>
        </div>

        <nav className="p-2.5 space-y-0.5 overflow-y-auto flex-1" aria-label="Studio Modules">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveModule(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${
                  isActive
                    ? 'bg-[#16233F] text-[#F4D57A] border border-[#D4AF37]/35'
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
                  <div className="text-[10.5px] text-slate-400 leading-tight mt-0.5 whitespace-nowrap truncate">
                    {item.subtitle}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-3.5 border-t border-slate-800/80 space-y-2 text-xs text-slate-400 shrink-0">
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
      </div>
    </aside>
  );
}
