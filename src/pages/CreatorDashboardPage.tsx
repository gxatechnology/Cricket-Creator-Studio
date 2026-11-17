import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Film,
  FolderKanban,
  HardDrive,
  HelpCircle,
  LayoutDashboard,
  Monitor,
  MoreVertical,
  Plus,
  Search,
  Shield,
  Smartphone,
  Sparkles,
  Square,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import { Link, useRouter } from '../router/RouterContext';
import { useStudio } from '../context/StudioContext';
import { useAuth } from '../auth/AuthContext';
import { evaluateProjectReadiness } from '../engine/readinessChecker';
import { buildProjectPackageZip } from '../engine/packaging';
import type { CricketProject } from '../types/studio';
import { UserAccountDropdown } from '../components/UserAccountDropdown';

export function CreatorDashboardPage() {
  const { navigate } = useRouter();
  const { workspace, setActiveProjectId, setWizardOpen, duplicateProject, deleteProject, setAccountModalOpen } =
    useStudio();
  const { isGuest, profile } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<'all' | '16:9' | '9:16' | '1:1'>('all');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Filter projects by search and aspect ratio
  const filteredProjects = useMemo(() => {
    return workspace.projects.filter((p) => {
      const matchesSearch =
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.settings.seriesName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFormat = selectedFormat === 'all' || p.settings.aspectRatio === selectedFormat;
      return matchesSearch && matchesFormat;
    });
  }, [workspace.projects, searchQuery, selectedFormat]);

  // Aggregate stats across all local projects
  const totalQuestions = useMemo(() => {
    return workspace.projects.reduce((acc, p) => acc + (p.quizQuestions?.length || 0), 0);
  }, [workspace.projects]);

  const handleOpenStudio = (projectId: string) => {
    setActiveProjectId(projectId);
    navigate('/studio');
  };

  const handleExportZip = async (project: CricketProject) => {
    try {
      const { blob, filename } = await buildProjectPackageZip(project);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Failed to package ZIP: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleDelete = (projectId: string, title: string) => {
    if (workspace.projects.length <= 1) {
      alert('You must keep at least one project in your workspace.');
      return;
    }
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
      deleteProject(projectId);
    }
  };

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-[#080E1A] text-slate-100 flex flex-col font-sans">
      {/* ---------------- TOP NAVBAR ---------------- */}
      <header className="sticky top-0 z-40 h-16 w-full max-w-[100vw] bg-[#0A1120] border-b border-slate-800/80 px-3 sm:px-6 lg:px-8 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-100 p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors shrink-0"
            title="Return to Public Homepage"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Home</span>
          </Link>
          <div className="h-5 w-[1px] bg-slate-800 shrink-0" />
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded bg-[#D4AF37] text-[#080E1A] flex items-center justify-center font-display font-bold text-xs shrink-0">
              CC
            </div>
            <span className="font-display font-bold text-xs sm:text-sm tracking-tight text-slate-100 truncate">
              <span className="hidden sm:inline">Creator </span>Workspace
            </span>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            aria-label="New Project"
            title="New Project Wizard"
            className="px-2.5 sm:px-3.5 py-1.5 rounded-lg bg-[#D4AF37] hover:bg-[#E2BE48] text-[#080E1A] text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all shrink-0 min-h-[36px]"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">New Project</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenStudio(workspace.activeProjectId)}
            aria-label="Open Studio"
            title="Open Studio"
            className="px-2.5 sm:px-3.5 py-1.5 rounded-lg bg-[#16233F] hover:bg-[#1E3056] border border-[#D4AF37]/40 text-[#F4D57A] text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0 min-h-[36px]"
          >
            <Film className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Open Studio</span>
          </button>

          <div className="hidden sm:block h-5 w-[1px] bg-slate-800" />

          {/* Account Dropdown */}
          <UserAccountDropdown onOpenSettings={() => setAccountModalOpen(true)} />
        </div>
      </header>

      {/* ---------------- MAIN DASHBOARD CONTENT ---------------- */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Welcome Banner */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-[#0C152B] via-[#0F1D3D] to-[#0A1224] border border-slate-800/80 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-mono font-semibold text-[#D4AF37] uppercase tracking-wider">
                Production Center
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                  !isGuest
                    ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                    : 'bg-amber-950/80 border-amber-500/40 text-amber-300'
                }`}
              >
                {!isGuest ? 'Cloud Authenticated' : 'Offline Guest Mode'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-tight">
              Welcome back, {!isGuest && profile ? profile.name : 'Cricket Creator'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl leading-relaxed">
              Manage your tactical analysis diagrams, multi-question trivia banks, and auto-synced video episodes.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-[#D4AF37] hover:bg-[#E2BE48] text-[#080E1A] font-bold text-xs flex items-center gap-2 shadow-md shadow-[#D4AF37]/20 transition-all active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Create Episode</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#0A1120] border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Saved Projects</span>
              <FolderKanban className="w-4 h-4 text-[#D4AF37]" />
            </div>
            <div className="text-2xl font-display font-bold text-white mt-2">
              {workspace.projects.length}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Local browser storage</div>
          </div>

          <div className="p-4 rounded-xl bg-[#0A1120] border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Authored Trivia Qs</span>
              <HelpCircle className="w-4 h-4 text-[#D4AF37]" />
            </div>
            <div className="text-2xl font-display font-bold text-white mt-2">{totalQuestions}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Across all episode banks</div>
          </div>

          <div className="p-4 rounded-xl bg-[#0A1120] border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Active Master</span>
              <Film className="w-4 h-4 text-[#D4AF37]" />
            </div>
            <div className="text-sm font-semibold text-white mt-2 truncate">
              {workspace.projects.find((p) => p.id === workspace.activeProjectId)?.title || 'Selected'}
            </div>
            <div className="text-[11px] text-[#D4AF37] mt-0.5 font-mono">
              {workspace.projects.find((p) => p.id === workspace.activeProjectId)?.settings.aspectRatio} Aspect
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#0A1120] border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span>Storage Integrity</span>
              <HardDrive className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-sm font-semibold text-emerald-400 mt-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>Offline Ready</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">IndexedDB + localStorage</div>
          </div>
        </div>

        {/* Local Storage Privacy Banner */}
        <div className="p-3.5 rounded-xl bg-[#0F1A30]/60 border border-slate-800 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#D4AF37] shrink-0" />
            <span>
              All episode edits, field designs, and audio files are securely saved on this device.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setAccountModalOpen(true)}
            className="text-[#D4AF37] font-semibold hover:underline shrink-0 ml-4"
          >
            Account Details
          </button>
        </div>

        {/* ---------------- PROJECT BROWSER & LIST ---------------- */}
        <div id="creator-projects-section" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-display font-bold text-white">Your Episodes & Projects</h2>
              <p className="text-xs text-slate-400">
                Select an episode to open inside the multi-track video production studio.
              </p>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search projects..."
                  className="pl-8 pr-3 py-1.5 rounded-lg bg-[#0C1426] border border-slate-700/80 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#D4AF37] w-48 sm:w-56"
                />
              </div>

              {/* Format Filter */}
              <div className="flex items-center p-0.5 rounded-lg bg-[#0C1426] border border-slate-700/80 text-xs">
                {(['all', '16:9', '9:16', '1:1'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setSelectedFormat(fmt)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      selectedFormat === fmt
                        ? 'bg-[#16233F] text-[#D4AF37] font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Project Cards Grid */}
          {filteredProjects.length === 0 ? (
            <div className="p-12 rounded-2xl bg-[#0A1120] border border-dashed border-slate-800 text-center space-y-3">
              <FolderKanban className="w-10 h-10 text-slate-600 mx-auto" />
              <div className="text-sm font-semibold text-slate-300">No matching projects found</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Try adjusting your search terms or create a new episode using the Project Wizard.
              </p>
              <button
                type="button"
                onClick={() => setWizardOpen(true)}
                className="mt-2 px-4 py-2 rounded-lg bg-[#D4AF37] text-[#080E1A] text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create New Project</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredProjects.map((project) => {
                const isActive = project.id === workspace.activeProjectId;
                const readiness = evaluateProjectReadiness(project);
                const questionCount = project.quizQuestions?.length || 0;
                const completedQuestions =
                  project.quizQuestions?.filter((q) => q.prompt.trim() !== '').length || 0;

                return (
                  <div
                    key={project.id}
                    className={`rounded-2xl bg-[#0C1426] border transition-all duration-200 flex flex-col justify-between overflow-hidden relative group hover:border-[#D4AF37]/60 hover:shadow-xl ${
                      isActive ? 'border-[#D4AF37]/50 shadow-md shadow-[#D4AF37]/5' : 'border-slate-800'
                    }`}
                  >
                    {/* Card Header & Badge */}
                    <div className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-[#131E38] border border-slate-700/80 font-mono text-[10px] text-[#D4AF37]">
                              {project.settings.aspectRatio === '16:9' ? (
                                <span className="inline-flex items-center gap-1">
                                  <Monitor className="w-3 h-3" /> 16:9
                                </span>
                              ) : project.settings.aspectRatio === '9:16' ? (
                                <span className="inline-flex items-center gap-1">
                                  <Smartphone className="w-3 h-3" /> 9:16
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1">
                                  <Square className="w-3 h-3" /> 1:1
                                </span>
                              )}
                            </span>
                            {isActive && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-[9px] font-mono text-emerald-300">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <h3
                            className="text-base font-display font-bold text-white truncate pt-1 cursor-pointer hover:text-amber-300 transition-colors"
                            onClick={() => handleOpenStudio(project.id)}
                            title={project.title}
                          >
                            {project.title}
                          </h3>
                        </div>

                        {/* More Menu Dropdown Toggle */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveMenuId(activeMenuId === project.id ? null : project.id)
                            }
                            className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {activeMenuId === project.id && (
                            <div className="absolute right-0 top-8 z-50 w-44 rounded-xl bg-[#080E1A] border border-slate-700 shadow-2xl py-1 text-xs text-slate-300 space-y-0.5 animate-fade-in">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  handleOpenStudio(project.id);
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-[#131E38] flex items-center gap-2"
                              >
                                <Film className="w-3.5 h-3.5 text-[#D4AF37]" />
                                <span>Open in Studio</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  duplicateProject(project.id);
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-[#131E38] flex items-center gap-2"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                <span>Duplicate</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  handleExportZip(project);
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-[#131E38] flex items-center gap-2"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Export Backup ZIP</span>
                              </button>
                              <div className="border-t border-slate-800 my-1" />
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  handleDelete(project.id, project.title);
                                }}
                                className="w-full px-3 py-2 text-left text-red-400 hover:bg-red-950/40 flex items-center gap-2"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete Project</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Series / Category Metadata */}
                      <div className="text-xs text-slate-400 flex items-center gap-3">
                        <span className="truncate">{project.settings.seriesName || 'Standard Series'}</span>
                        <span>•</span>
                        <span className="font-mono text-[#D4AF37]">
                          {completedQuestions}/{questionCount} Questions
                        </span>
                      </div>

                      {/* Readiness Bar */}
                      <div className="space-y-1 pt-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>Readiness</span>
                          <span className="font-mono text-slate-300">{readiness.scorePercent}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              readiness.scorePercent >= 80
                                ? 'bg-emerald-400'
                                : readiness.scorePercent >= 50
                                ? 'bg-amber-400'
                                : 'bg-slate-600'
                            }`}
                            style={{ width: `${readiness.scorePercent}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Card Footer Actions */}
                    <div className="px-5 py-3.5 bg-[#0A1120] border-t border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenStudio(project.id)}
                        className="px-3 py-1.5 rounded-lg bg-[#16233F] hover:bg-[#D4AF37] hover:text-[#080E1A] text-[#F4D57A] text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <span>Open Studio</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
