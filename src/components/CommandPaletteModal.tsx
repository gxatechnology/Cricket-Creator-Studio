import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useStudio } from '../context/StudioContext';

interface CommandAction {
  id: string;
  label: string;
  group: string;
  shortcut?: string;
  run: () => void;
}

export function CommandPaletteModal() {
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    setActiveModule,
    setWizardOpen,
    triggerImmediateSave,
    setSelectedQuizIndex,
    activeProject,
    loadRendererQaProject,
    setAccountModalOpen,
    undo,
    redo,
  } = useStudio();

  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      window.setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [commandPaletteOpen]);

  const actions = useMemo<CommandAction[]>(() => {
    const base: CommandAction[] = [
      {
        id: 'cmd-account',
        label: 'Creator Account & Security (Google Sign In / Guest)',
        group: 'Account',
        run: () => setAccountModalOpen(true),
      },
      {
        id: 'cmd-new-project',
        label: 'New Project Wizard',
        group: 'Project',
        run: () => setWizardOpen(true),
      },
      {
        id: 'cmd-save',
        label: 'Save Project Now',
        group: 'Project',
        shortcut: 'Ctrl+S',
        run: () => triggerImmediateSave(),
      },
      {
        id: 'cmd-undo',
        label: 'Undo Last Change',
        group: 'Edit',
        shortcut: 'Ctrl+Z',
        run: () => undo(),
      },
      {
        id: 'cmd-redo',
        label: 'Redo Change',
        group: 'Edit',
        shortcut: 'Ctrl+Shift+Z',
        run: () => redo(),
      },
      {
        id: 'cmd-open-dashboard',
        label: 'Open Project Dashboard',
        group: 'Navigation',
        run: () => setActiveModule('dashboard'),
      },
      {
        id: 'cmd-open-timeline',
        label: 'Open Production Timeline & Auto Builder',
        group: 'Navigation',
        run: () => setActiveModule('timeline'),
      },
      {
        id: 'cmd-open-field',
        label: 'Open Field Designer',
        group: 'Navigation',
        run: () => setActiveModule('field'),
      },
      {
        id: 'cmd-open-quiz',
        label: 'Open Quiz Builder & Importer',
        group: 'Navigation',
        run: () => setActiveModule('quiz'),
      },
      {
        id: 'cmd-import-questions',
        label: 'Import Questions (CSV / Text / JSON)',
        group: 'Quiz',
        run: () => setActiveModule('quiz'),
      },
      {
        id: 'cmd-open-brand',
        label: 'Open Brand Studio & Graphics',
        group: 'Navigation',
        run: () => setActiveModule('graphics'),
      },
      {
        id: 'cmd-open-audio',
        label: 'Open Audio & Voiceover Workspace',
        group: 'Navigation',
        run: () => setActiveModule('audio'),
      },
      {
        id: 'cmd-open-preview',
        label: 'Open Animation Preview',
        group: 'Navigation',
        run: () => setActiveModule('preview'),
      },
      {
        id: 'cmd-open-export',
        label: 'Open Export & Render Center',
        group: 'Render',
        run: () => setActiveModule('export'),
      },
      {
        id: 'cmd-load-qa-scene',
        label: 'Load Renderer QA Scene (24s)',
        group: 'Render',
        run: () => {
          loadRendererQaProject('16:9');
          setActiveModule('export');
        },
      },
      {
        id: 'cmd-check-project',
        label: 'Check Project Readiness Score',
        group: 'QA',
        run: () => setActiveModule('dashboard'),
      },
      {
        id: 'cmd-export-project',
        label: 'Export Project Package (.zip / .json)',
        group: 'Publish',
        run: () => setActiveModule('publish'),
      },
    ];

    const qCount = Math.min(activeProject.quizQuestions.length, 100);
    for (let i = 0; i < qCount; i++) {
      base.push({
        id: `cmd-jump-q-${i + 1}`,
        label: `Jump Question ${i + 1}`,
        group: 'Quiz Jump',
        run: () => {
          setSelectedQuizIndex(i);
          setActiveModule('quiz');
        },
      });
    }

    return base;
  }, [
    activeProject.quizQuestions.length,
    loadRendererQaProject,
    redo,
    setActiveModule,
    setSelectedQuizIndex,
    setWizardOpen,
    triggerImmediateSave,
    undo,
  ]);

  if (!commandPaletteOpen) return null;

  const filtered = actions
    .filter((a) => {
      if (!query.trim()) return a.group !== 'Quiz Jump';
      return (
        a.label.toLowerCase().includes(query.toLowerCase()) ||
        a.group.toLowerCase().includes(query.toLowerCase())
      );
    })
    .slice(0, 14);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center pt-[12vh] p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      onClick={() => setCommandPaletteOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-[#0C1426] border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-3">
          <Search className="w-4 h-4 text-[#D4AF37] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setCommandPaletteOpen(false);
              } else if (e.key === 'Enter' && filtered[0]) {
                filtered[0].run();
                setCommandPaletteOpen(false);
              }
            }}
            placeholder="Type a command (e.g. New Project, Jump Question 15, Brand Kit)..."
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(false)}
            aria-label="Close Command Palette"
            className="p-1 rounded text-slate-400 hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[340px] overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-4 text-xs text-slate-400 text-center">
              No matching studio commands.
            </div>
          ) : (
            filtered.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => {
                  action.run();
                  setCommandPaletteOpen(false);
                }}
                className="w-full px-3 py-2 rounded-lg text-left hover:bg-[#172442] flex items-center justify-between gap-3 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-[10px] font-mono-tabular text-[#E5B94C] w-20 shrink-0">
                    {action.group}
                  </span>
                  <span className="text-xs font-medium text-slate-100 truncate">
                    {action.label}
                  </span>
                </div>
                {action.shortcut && (
                  <span className="text-[11px] font-mono-tabular text-slate-400 shrink-0">
                    {action.shortcut}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
