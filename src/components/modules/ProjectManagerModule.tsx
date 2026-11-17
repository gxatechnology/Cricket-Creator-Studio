import React, { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FolderArchive,
  FolderPlus,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { useStudio } from '../../context/StudioContext';
import type { AspectRatio, CricketProject } from '../../types/studio';
import { FIELD_PRESETS } from '../../engine/cricketField';
import { parseImportedProjectJson } from '../../engine/storage';
import { countCompleteQuestions } from '../../engine/timeline';
import {
  buildProjectPackageZip,
  hasProjectIdConflict,
  parseProjectPackageZip,
} from '../../engine/packaging';

export function ProjectManagerModule() {
  const {
    workspace,
    activeProject,
    setActiveProjectId,
    createProject,
    duplicateProject,
    deleteProject,
    importProject,
    setActiveModule,
    setWizardOpen,
    loadRendererQaProject,
  } = useStudio();

  const [newTitle, setNewTitle] = useState('');
  const [newPresetId, setNewPresetId] = useState(FIELD_PRESETS[0].id);
  const [newAspectRatio, setNewAspectRatio] = useState<AspectRatio>('16:9');
  const [createError, setCreateError] = useState<string | null>(null);

  const [importJsonText, setImportJsonText] = useState('');
  const [importStatus, setImportStatus] = useState<{
    kind: 'ok' | 'err';
    message: string;
  } | null>(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [pendingConflictProject, setPendingConflictProject] =
    useState<CricketProject | null>(null);

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setCreateError('Please enter a project title before creating.');
      return;
    }
    setCreateError(null);
    createProject(newTitle.trim(), newPresetId, newAspectRatio);
    setNewTitle('');
  };

  const handleDownloadJson = (projectId: string) => {
    const project = workspace.projects.find((p) => p.id === projectId);
    if (!project) return;
    const blob = new Blob([JSON.stringify(project, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const slug = project.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    link.download = `${slug || 'cricket-project'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadZip = async (projectId: string) => {
    const project = workspace.projects.find((p) => p.id === projectId);
    if (!project) return;
    const { blob, filename } = await buildProjectPackageZip(project);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSafeImport = (project: CricketProject, sourceLabel: string) => {
    if (hasProjectIdConflict(project.id, workspace.projects)) {
      setPendingConflictProject(project);
      return;
    }
    importProject(project, false);
    setImportStatus({
      kind: 'ok',
      message: `Imported "${project.title}" from ${sourceLabel}.`,
    });
  };

  const handleImportSubmit = () => {
    if (!importJsonText.trim()) {
      setImportStatus({ kind: 'err', message: 'Paste valid project JSON first.' });
      return;
    }
    const result = parseImportedProjectJson(importJsonText);
    if (result.ok === false) {
      setImportStatus({ kind: 'err', message: result.error });
      return;
    }
    handleSafeImport(result.project, 'JSON');
    setImportJsonText('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (file.name.toLowerCase().endsWith('.zip')) {
      const buf = await file.arrayBuffer();
      const res = await parseProjectPackageZip(buf);
      if (res.ok === false) {
        setImportStatus({ kind: 'err', message: res.error });
        return;
      }
      handleSafeImport(res.project, 'ZIP package');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      const result = parseImportedProjectJson(content);
      if (result.ok === false) {
        setImportStatus({ kind: 'err', message: result.error });
        return;
      }
      handleSafeImport(result.project, 'JSON file');
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-6 max-w-[1320px] mx-auto space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Saved Projects Library */}
        <section className="lg:col-span-7 bg-[#0F182D] border border-slate-800/80 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div>
              <h2 className="text-base font-display font-semibold text-slate-100">
                Saved Studio Projects
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Persisted automatically in browser storage. Switch, duplicate, or download JSON / ZIP packages.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  loadRendererQaProject('16:9');
                  setActiveModule('export');
                }}
                className="px-3 py-1.5 rounded-md bg-[#131E38] hover:bg-[#1B2B4F] border border-[#D4AF37]/40 text-[#F4D57A] text-xs font-semibold flex items-center gap-1.5"
              >
                <span>Load Renderer QA Scene (24s)</span>
              </button>
              <button
                type="button"
                onClick={() => setWizardOpen(true)}
                className="px-3 py-1.5 rounded-md bg-[#D4AF37] hover:bg-[#E2BE48] text-[#080E1A] text-xs font-bold flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>5-Step Project Wizard</span>
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            {workspace.projects.map((proj) => {
              const isActive = proj.id === activeProject.id;
              const quizCount = countCompleteQuestions(proj.quizQuestions);
              const updatedLabel = new Date(proj.updatedAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={proj.id}
                  className={`p-4 rounded-lg border transition-colors ${
                    isActive
                      ? 'bg-[#16233F] border-[#D4AF37]/50'
                      : 'bg-[#09101E] border-slate-800/90 hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-display font-semibold text-slate-100 truncate">
                          {proj.title}
                        </h3>
                        {isActive && (
                          <span className="text-[11px] font-semibold text-[#E5B94C] whitespace-nowrap shrink-0">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 font-mono-tabular mt-1 flex flex-wrap items-center gap-2">
                        <span>{proj.settings.aspectRatio}</span>
                        <span aria-hidden="true">·</span>
                        <span>{proj.fieldDesign.fielders.length} fielders</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {quizCount}/{proj.quizQuestions.length} quiz
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{proj.timelineClips.length} clips</span>
                        <span aria-hidden="true">·</span>
                        <span>Updated {updatedLabel}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveProjectId(proj.id);
                            setActiveModule('dashboard');
                          }}
                          className="px-3 py-1.5 rounded bg-[#D4AF37] hover:bg-[#E2BE48] text-[#080E1A] text-xs font-semibold flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Load</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => duplicateProject(proj.id)}
                        aria-label={`Duplicate ${proj.title}`}
                        className="p-1.5 rounded bg-[#131E38] hover:bg-[#1B2B4F] border border-slate-700/80 text-slate-300"
                        title="Duplicate project"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDownloadJson(proj.id)}
                        aria-label={`Export ${proj.title} as JSON`}
                        className="p-1.5 rounded bg-[#131E38] hover:bg-[#1B2B4F] border border-slate-700/80 text-slate-300"
                        title="Download project JSON"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDownloadZip(proj.id)}
                        aria-label={`Export ${proj.title} as ZIP`}
                        className="p-1.5 rounded bg-[#131E38] hover:bg-[#1B2B4F] border border-slate-700/80 text-[#E5B94C]"
                        title="Download project ZIP package"
                      >
                        <FolderArchive className="w-3.5 h-3.5" />
                      </button>

                      {workspace.projects.length > 1 && (
                        <>
                          {confirmDeleteId === proj.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  deleteProject(proj.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-[11px] font-semibold"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1 rounded bg-slate-800 text-slate-300 text-[11px]"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(proj.id)}
                              aria-label={`Delete ${proj.title}`}
                              className="p-1.5 rounded bg-[#131E38] hover:bg-red-950/80 border border-slate-700/80 hover:border-red-500/40 text-slate-400 hover:text-red-400"
                              title="Delete project"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right: Quick Create Project + JSON/ZIP Import */}
        <div className="lg:col-span-5 space-y-6">
          <section className="bg-[#0F182D] border border-slate-800/80 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-display font-semibold text-slate-100">
              Quick Create Episode Project
            </h2>

            <form onSubmit={handleCreateProject} className="space-y-3">
              <div>
                <label
                  htmlFor="pm-new-title"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Episode Title
                </label>
                <input
                  id="pm-new-title"
                  type="text"
                  value={newTitle}
                  onChange={(e) => {
                    setNewTitle(e.target.value);
                    if (createError) setCreateError(null);
                  }}
                  placeholder="e.g. Ep 16: Asia Cup Fielding Traps"
                  className="w-full px-3 py-2 rounded-lg bg-[#080E1A] border border-slate-700/80 text-xs text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                />
                {createError && (
                  <p className="text-xs text-red-400 mt-1">{createError}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="pm-new-preset"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Starting Field Preset
                  </label>
                  <select
                    id="pm-new-preset"
                    value={newPresetId}
                    onChange={(e) => setNewPresetId(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg bg-[#080E1A] border border-slate-700/80 text-xs text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                  >
                    {FIELD_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="pm-new-aspect"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Format
                  </label>
                  <select
                    id="pm-new-aspect"
                    value={newAspectRatio}
                    onChange={(e) => setNewAspectRatio(e.target.value as AspectRatio)}
                    className="w-full px-2.5 py-2 rounded-lg bg-[#080E1A] border border-slate-700/80 text-xs text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                  >
                    <option value="16:9">16:9 Landscape</option>
                    <option value="9:16">9:16 Portrait</option>
                    <option value="1:1">1:1 Square</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 px-4 rounded-lg bg-[#D4AF37] hover:bg-[#E2BE48] text-[#080E1A] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <FolderPlus className="w-4 h-4" />
                <span>Create Episode Project</span>
              </button>
            </form>
          </section>

          <section className="bg-[#0F182D] border border-slate-800/80 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-display font-semibold text-slate-100">
                Import Project JSON or ZIP
              </h2>
              <label className="px-2.5 py-1 rounded bg-[#131E38] hover:bg-[#1B2B4F] border border-slate-700/80 text-xs text-slate-200 cursor-pointer flex items-center gap-1">
                <Upload className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Upload File</span>
                <input
                  type="file"
                  accept="application/json,.json,.zip,application/zip"
                  onChange={handleFileUpload}
                  className="sr-only"
                />
              </label>
            </div>

            <label htmlFor="pm-import-json" className="sr-only">
              Paste project JSON
            </label>
            <textarea
              id="pm-import-json"
              rows={4}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder="Paste exported Cricket Creator Studio project JSON..."
              className="w-full px-3 py-2 rounded-lg bg-[#080E1A] border border-slate-700/80 text-xs font-mono-tabular text-slate-200 focus:outline-none focus:border-[#D4AF37]"
            />

            {importStatus && (
              <p
                className={`text-xs ${
                  importStatus.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {importStatus.message}
              </p>
            )}

            {pendingConflictProject && (
              <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-500/40 space-y-2">
                <div className="text-xs text-amber-200 font-semibold">
                  Project ID already exists for &ldquo;{pendingConflictProject.title}&rdquo;.
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      importProject(pendingConflictProject, false);
                      setImportStatus({
                        kind: 'ok',
                        message: `Imported "${pendingConflictProject.title}" as a new copy.`,
                      });
                      setPendingConflictProject(null);
                    }}
                    className="px-2.5 py-1 rounded bg-[#D4AF37] text-[#080E1A] text-[11px] font-bold"
                  >
                    Import as Copy
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      importProject(pendingConflictProject, true);
                      setImportStatus({
                        kind: 'ok',
                        message: `Overwrote "${pendingConflictProject.title}".`,
                      });
                      setPendingConflictProject(null);
                    }}
                    className="px-2.5 py-1 rounded bg-red-600 text-white text-[11px] font-semibold"
                  >
                    Overwrite Existing
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingConflictProject(null)}
                    className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-[11px]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleImportSubmit}
              className="w-full py-2 px-4 rounded-lg bg-[#131E38] hover:bg-[#1B2A4D] border border-slate-700/80 text-xs font-semibold text-slate-100 transition-colors"
            >
              Validate &amp; Import JSON
            </button>
          </section>

          <section className="bg-[#0C1426] border border-slate-800/80 rounded-xl p-4 text-xs text-slate-400 space-y-1.5">
            <div className="font-display font-semibold text-slate-200">
              Phase 3 Renderer-Ready Architecture
            </div>
            <p className="leading-relaxed">
              Timeline playback, graphics overlays, field scenes, and audio mix gain are evaluated deterministically via{' '}
              <code className="font-mono-tabular text-[#E5B94C]">
                evaluateSequenceAtTime(project, &apos;timeline&apos;, timeSec)
              </code>{' '}
              for direct MP4 rendering in Phase 3.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
