import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Compass,
  Film,
  FolderKanban,
  HelpCircle,
  PlaySquare,
  PlusCircle,
  ShieldCheck,
} from 'lucide-react';
import { useStudio } from '../../context/StudioContext';
import type { AspectRatio } from '../../types/studio';
import {
  computeSequenceDuration,
  countCompleteQuestions,
  formatTimecode,
} from '../../engine/timeline';
import {
  ProductionReadinessReport,
  evaluateProjectReadiness,
} from '../../engine/readinessChecker';
import { CricketFieldSvg } from '../CricketFieldSvg';

export function ProjectDashboard() {
  const {
    activeProject,
    updateActiveProject,
    setActiveModule,
    setWizardOpen,
    workspace,
    lastSavedAt,
    createSnapshot,
  } = useStudio();

  const [readinessReport, setReadinessReport] = useState<ProductionReadinessReport | null>(
    null
  );
  const [snapshotFeedback, setSnapshotFeedback] = useState<string | null>(null);

  const completedQuestions = countCompleteQuestions(activeProject.quizQuestions);
  const totalTimelineSec = computeSequenceDuration(activeProject, 'timeline');
  const totalCombinedSec = computeSequenceDuration(activeProject, 'combined');

  const formatStamp = (iso: string | undefined) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const liveReadinessScore = useMemo(
    () => evaluateProjectReadiness(activeProject).scorePercent,
    [activeProject]
  );

  const handleRunReadinessCheck = () => {
    setReadinessReport(evaluateProjectReadiness(activeProject));
  };

  return (
    <div className="p-6 max-w-[1360px] mx-auto space-y-6">
      {/* Top Production Summary Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0F182D] border border-slate-800/80 rounded-xl p-4">
          <div className="text-xs text-slate-400">Fielders &amp; Scenes</div>
          <div className="text-2xl font-display font-bold text-slate-100 mt-1 font-mono-tabular">
            {activeProject.fieldDesign.fielders.length}
          </div>
          <div className="text-xs text-slate-400 mt-1 truncate">
            {activeProject.fieldDesign.activePresetName} ({activeProject.fieldScenes.length} saved)
          </div>
        </div>

        <div className="bg-[#0F182D] border border-slate-800/80 rounded-xl p-4">
          <div className="text-xs text-slate-400">Quiz Questions Ready</div>
          <div className="text-2xl font-display font-bold text-[#E5B94C] mt-1 font-mono-tabular">
            {completedQuestions} / {activeProject.quizQuestions.length}
          </div>
          <div className="text-xs text-slate-400 mt-1 font-mono-tabular">
            Target: {activeProject.production.quizTargetCount} ·{' '}
            {activeProject.timelineClips.length} timeline clips
          </div>
        </div>

        <div className="bg-[#0F182D] border border-slate-800/80 rounded-xl p-4">
          <div className="text-xs text-slate-400">Episode Runtime</div>
          <div className="text-2xl font-display font-bold text-slate-100 mt-1 font-mono-tabular">
            {formatTimecode(totalTimelineSec || totalCombinedSec, activeProject.settings.fps)}
          </div>
          <div className="text-xs text-slate-400 mt-1 font-mono-tabular">
            {activeProject.settings.aspectRatio} · {activeProject.settings.fps} fps
          </div>
        </div>

        <div className="bg-[#0F182D] border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-slate-400">Renderer Ready</div>
            <button
              type="button"
              data-testid="check-project-btn"
              onClick={handleRunReadinessCheck}
              className="px-2.5 py-1 rounded bg-[#D4AF37] hover:bg-[#E2BE48] text-[#080E1A] text-[11px] font-bold"
            >
              CHECK PROJECT
            </button>
          </div>
          <div className="text-2xl font-display font-bold text-emerald-400 mt-1 font-mono-tabular">
            {readinessReport ? readinessReport.scorePercent : liveReadinessScore}%
          </div>
          <div className="text-xs text-slate-400 mt-1 truncate">
            Brand: {activeProject.brandKit.channelName}
          </div>
        </div>
      </section>

      {/* Production Readiness Report Panel (when checked) */}
      {readinessReport && (
        <section
          data-testid="readiness-report-panel"
          className="bg-[#0F182D] border border-[#D4AF37]/40 rounded-xl p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-[#D4AF37]" />
              <div>
                <h3 className="text-sm font-display font-bold text-slate-100">
                  {readinessReport.summaryLine}
                </h3>
                <p className="text-xs text-slate-400">
                  Phase 3 render readiness validation across quiz bank, voiceover, media links, timeline, and safe areas.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setReadinessReport(null)}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Dismiss
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {readinessReport.checks.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-lg bg-[#080E1A] border border-slate-800 flex items-start gap-2.5"
              >
                {item.severity === 'pass' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : item.severity === 'warning' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-100">{item.label}</span>
                    <span className="text-[11px] font-mono-tabular text-slate-400">
                      {item.pointsEarned}/{item.pointsMax}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Main Split: Episode Configuration + Live Tactical Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <section className="lg:col-span-7 bg-[#0F182D] border border-slate-800/80 rounded-xl p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
              <div>
                <h2 className="text-base font-display font-semibold text-slate-100">
                  Episode Production Details
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Created {formatStamp(activeProject.createdAt)} · Opened{' '}
                  {formatStamp(activeProject.lastOpenedAt)} · Saved{' '}
                  {formatStamp(lastSavedAt ?? activeProject.updatedAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    createSnapshot(
                      `Dashboard Checkpoint (${new Date().toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })})`
                    );
                    setSnapshotFeedback('Snapshot saved');
                    window.setTimeout(() => setSnapshotFeedback(null), 1800);
                  }}
                  className="px-2.5 py-1.5 rounded-md bg-[#131E38] hover:bg-[#1B2B4F] border border-slate-700/80 text-xs text-slate-200"
                >
                  {snapshotFeedback ?? 'Save Snapshot'}
                </button>
                <button
                  type="button"
                  onClick={() => setWizardOpen(true)}
                  className="px-3 py-1.5 rounded-md bg-[#D4AF37] hover:bg-[#E2BE48] text-[#080E1A] text-xs font-bold flex items-center gap-1"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>New Project Wizard</span>
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="dash-episode-title"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Episode Title
                </label>
                <input
                  id="dash-episode-title"
                  type="text"
                  value={activeProject.title}
                  onChange={(e) =>
                    updateActiveProject((prev) => ({ ...prev, title: e.target.value }))
                  }
                  className="w-full px-3.5 py-2 rounded-lg bg-[#080E1A] border border-slate-700/80 text-sm text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                  placeholder="Enter episode title"
                />
              </div>

              <div>
                <label
                  htmlFor="dash-episode-subtitle"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Broadcast Subtitle / Lower-Third Deck
                </label>
                <input
                  id="dash-episode-subtitle"
                  type="text"
                  value={activeProject.subtitle}
                  onChange={(e) =>
                    updateActiveProject((prev) => ({ ...prev, subtitle: e.target.value }))
                  }
                  className="w-full px-3.5 py-2 rounded-lg bg-[#080E1A] border border-slate-700/80 text-sm text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                  placeholder="Episode subtitle"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="dash-series-name"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Series Name
                  </label>
                  <input
                    id="dash-series-name"
                    type="text"
                    value={activeProject.settings.seriesName}
                    onChange={(e) =>
                      updateActiveProject((prev) => ({
                        ...prev,
                        settings: { ...prev.settings, seriesName: e.target.value },
                      }))
                    }
                    className="w-full px-3.5 py-2 rounded-lg bg-[#080E1A] border border-slate-700/80 text-sm text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="dash-channel-handle"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    YouTube Handle
                  </label>
                  <input
                    id="dash-channel-handle"
                    type="text"
                    value={activeProject.settings.channelHandle}
                    onChange={(e) =>
                      updateActiveProject((prev) => ({
                        ...prev,
                        settings: { ...prev.settings, channelHandle: e.target.value },
                        brandKit: { ...prev.brandKit, youtubeHandle: e.target.value },
                      }))
                    }
                    className="w-full px-3.5 py-2 rounded-lg bg-[#080E1A] border border-slate-700/80 text-sm text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="dash-aspect-ratio"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Target Frame Orientation
                  </label>
                  <select
                    id="dash-aspect-ratio"
                    value={activeProject.settings.aspectRatio}
                    onChange={(e) =>
                      updateActiveProject((prev) => ({
                        ...prev,
                        settings: {
                          ...prev.settings,
                          aspectRatio: e.target.value as AspectRatio,
                        },
                      }))
                    }
                    className="w-full px-3.5 py-2 rounded-lg bg-[#080E1A] border border-slate-700/80 text-sm text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                  >
                    <option value="16:9">16:9 Landscape (YouTube)</option>
                    <option value="9:16">9:16 Portrait (Shorts)</option>
                    <option value="1:1">1:1 Square (Social)</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="dash-fps"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Timeline Frame Rate
                  </label>
                  <select
                    id="dash-fps"
                    value={activeProject.settings.fps}
                    onChange={(e) =>
                      updateActiveProject((prev) => ({
                        ...prev,
                        settings: {
                          ...prev.settings,
                          fps: Number(e.target.value) === 60 ? 60 : 30,
                        },
                      }))
                    }
                    className="w-full px-3.5 py-2 rounded-lg bg-[#080E1A] border border-slate-700/80 text-sm text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                  >
                    <option value={30}>30 fps (Standard Broadcast)</option>
                    <option value={60}>60 fps (High Motion)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Direct Module Launchers */}
          <div className="pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setActiveModule('timeline')}
              className="px-4 py-3 rounded-lg bg-[#131E38] hover:bg-[#192748] border border-slate-700/80 text-left flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Film className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-100">
                    Open Production Timeline
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {activeProject.timelineClips.length} clips · Auto Episode Builder
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => setActiveModule('field')}
              className="px-4 py-3 rounded-lg bg-[#131E38] hover:bg-[#192748] border border-slate-700/80 text-left flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Compass className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-100">
                    Open Field Designer
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {activeProject.fieldDesign.ballPath.deliveryType} ·{' '}
                    {activeProject.fieldDesign.ballPath.shotType}
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => setActiveModule('quiz')}
              className="px-4 py-3 rounded-lg bg-[#131E38] hover:bg-[#192748] border border-slate-700/80 text-left flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <HelpCircle className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-100">
                    Quiz Builder &amp; Importer
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono-tabular">
                    {completedQuestions}/{activeProject.quizQuestions.length} configured
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => setActiveModule('preview')}
              className="px-4 py-3 rounded-lg bg-[#D4AF37] hover:bg-[#E2BE48] text-[#080E1A] text-left flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <PlaySquare className="w-4 h-4 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-bold">Launch Animation Preview</div>
                  <div className="text-[11px] text-[#080E1A]/80 font-medium">
                    Test {activeProject.settings.aspectRatio} playback
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </section>

        {/* Right: Live Tactical Pitch Preview */}
        <section className="lg:col-span-5 bg-[#0F182D] border border-slate-800/80 rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h2 className="text-sm font-display font-semibold text-slate-100">
                Current Tactical Diagram
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {activeProject.fieldDesign.batterHand === 'right'
                  ? 'Right-handed batter'
                  : 'Left-handed batter'}{' '}
                · {activeProject.fieldDesign.ballPath.speedKmh} km/h{' '}
                {activeProject.fieldDesign.ballPath.deliveryType}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveModule('projects')}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
              >
                <FolderKanban className="w-3.5 h-3.5" />
                <span>{workspace.projects.length} projects</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveModule('field')}
                className="text-xs font-medium text-[#E5B94C] hover:underline whitespace-nowrap shrink-0"
              >
                Edit Pitch
              </button>
            </div>
          </div>

          <div className="aspect-square w-full max-w-[400px] mx-auto rounded-lg overflow-hidden border border-slate-800 bg-[#081312]">
            <CricketFieldSvg fieldDesign={activeProject.fieldDesign} className="w-full h-full" />
          </div>
        </section>
      </div>
    </div>
  );
}
