import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  AspectRatio,
  BrandKit,
  CricketProject,
  ExportHistoryEntry,
  FieldDesign,
  QuizQuestion,
  StudioModuleId,
  StudioWorkspace,
} from '../types/studio';
import {
  createBenchmarkProject,
  createClientDemoProject,
  createInitialWorkspace,
  createRendererQaProject,
} from '../data/seedProjects';
import {
  WizardProjectParams,
  createBlankProject,
  createProjectFromWizard,
  createProjectSnapshot,
  loadWorkspaceFromStorage,
  migrateProjectToPhase2,
  restoreProjectFromSnapshot,
  saveWorkspaceToStorage,
} from '../engine/storage';
import {
  HistoryStack,
  createHistoryState,
  pushHistoryState,
  redoHistory,
  undoHistory,
} from '../engine/history';
import { DEFAULT_BRAND_PRESETS } from '../engine/brandDefaults';
import { migrateProjectAssetsToIndexedDB } from '../engine/assetBlobStore';
import { computeSequenceDuration } from '../engine/timeline';
import { runAssetPreflight } from '../render/audioRenderer';
import { ExportExecutionHandle, startVideoExport } from '../render/exportController';
import {
  createRenderJob,
  enqueueMultiFormatSuite,
  enqueueRenderJob,
  markJobCompleted,
  markJobFailed,
  markJobRendering,
  removeRenderJob,
  retryRenderJob,
} from '../render/renderQueue';
import type {
  AssetPreflightReport,
  RenderError,
  RenderJob,
  RenderProgress,
  RenderResult,
  RenderSettings,
} from '../render/rendererTypes';
import {
  cancelServerRenderJob,
  clearActiveRenderCheckpoint,
  fetchServerRenderJob,
  listServerRenderJobs,
  loadActiveRenderCheckpoint,
  type PersistedClientRenderCheckpoint,
  type ServerRenderJobRecord,
} from '../render/jobPersistence';

export interface RecoverableRenderCheckpoint {
  serverJob: ServerRenderJobRecord;
  clientCheckpoint: PersistedClientRenderCheckpoint | null;
}

export type SaveStatus = 'saved' | 'saving' | 'error';

interface StudioContextValue {
  workspace: StudioWorkspace;
  activeProject: CricketProject;
  activeModule: StudioModuleId;
  setActiveModule: (moduleId: StudioModuleId) => void;
  setActiveProjectId: (projectId: string) => void;
  updateActiveProject: (
    updater: (project: CricketProject) => CricketProject,
    recordHistory?: boolean
  ) => void;
  updateFieldDesign: (updater: (field: FieldDesign) => FieldDesign) => void;
  updateQuizQuestion: (
    questionIndex: number,
    updater: (question: QuizQuestion) => QuizQuestion
  ) => void;
  createProject: (title: string, presetId: string, aspectRatio: AspectRatio) => void;
  createWizardProject: (params: WizardProjectParams) => void;
  duplicateProject: (projectId: string) => void;
  deleteProject: (projectId: string) => void;
  importProject: (project: CricketProject, overwriteExisting?: boolean) => void;
  saveBrandPreset: (brand: BrandKit) => void;
  duplicateBrandPreset: (presetId: string) => void;
  deleteBrandPreset: (presetId: string) => void;
  createSnapshot: (name: string) => void;
  restoreSnapshot: (snapshotId: string) => void;
  duplicateSnapshot: (snapshotId: string) => void;
  deleteSnapshot: (snapshotId: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  saveStatus: SaveStatus;
  lastSavedAt: string | null;
  triggerImmediateSave: () => void;
  wizardOpen: boolean;
  setWizardOpen: (open: boolean) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  selectedQuizIndex: number;
  setSelectedQuizIndex: (idx: number) => void;
  // Phase 3 Render Pipeline & Queue
  renderQueue: RenderJob[];
  activeRenderJobId: string | null;
  isRendering: boolean;
  activeRenderProgress: RenderProgress | null;
  latestRenderResult: RenderResult | null;
  renderError: RenderError | null;
  lastPreflight: AssetPreflightReport | null;
  executeSingleRender: (
    settings: RenderSettings,
    customProject?: CricketProject
  ) => Promise<RenderResult | null>;
  enqueueExportJob: (settings: RenderSettings, label?: string) => RenderJob;
  enqueueAllFormats: (fps?: 30 | 60, format?: 'mp4' | 'webm') => void;
  startNextQueuedJob: () => Promise<void>;
  cancelActiveRender: () => void;
  retryQueueJob: (jobId: string) => void;
  removeQueueJob: (jobId: string) => void;
  refreshPreflight: () => Promise<AssetPreflightReport>;
  loadRendererQaProject: (aspectRatio?: AspectRatio) => CricketProject;
  loadClientDemoProject: (aspectRatio?: AspectRatio) => CricketProject;
  loadBenchmarkProject: (
    questionCount: 5 | 10 | 30,
    aspectRatio?: AspectRatio
  ) => CricketProject;
  clearRenderError: () => void;
  recoverableJob: RecoverableRenderCheckpoint | null;
  resumeRecoveredJob: () => Promise<RenderResult | null>;
  discardRecoveredJob: () => Promise<void>;
  refreshRecoverableJob: () => Promise<void>;
}

const StudioContext = createContext<StudioContextValue | null>(null);

export function StudioProvider({ children }: { children: React.ReactNode }) {
  const initialWorkspace = useMemo(
    () => loadWorkspaceFromStorage(createInitialWorkspace()),
    []
  );

  const [history, setHistory] = useState<HistoryStack<StudioWorkspace>>(() =>
    createHistoryState(initialWorkspace)
  );
  const workspace = history.present;

  const [activeModule, setActiveModule] = useState<StudioModuleId>('dashboard');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(() => new Date().toISOString());
  const [wizardOpen, setWizardOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [selectedQuizIndex, setSelectedQuizIndex] = useState(0);

  // Phase 3 Render State
  const [renderQueue, setRenderQueue] = useState<RenderJob[]>([]);
  const [activeRenderJobId, setActiveRenderJobId] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [activeRenderProgress, setActiveRenderProgress] =
    useState<RenderProgress | null>(null);
  const [latestRenderResult, setLatestRenderResult] = useState<RenderResult | null>(null);
  const [renderError, setRenderError] = useState<RenderError | null>(null);
  const [lastPreflight, setLastPreflight] = useState<AssetPreflightReport | null>(null);
  const [recoverableJob, setRecoverableJob] =
    useState<RecoverableRenderCheckpoint | null>(null);

  const renderHandleRef = useRef<ExportExecutionHandle | null>(null);
  const renderQueueRef = useRef<RenderJob[]>([]);
  renderQueueRef.current = renderQueue;
  const isRenderingRef = useRef(false);
  isRenderingRef.current = isRendering;

  const isFirstMount = useRef(true);
  const saveTimerRef = useRef<number | null>(null);

  const triggerImmediateSave = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const ok = saveWorkspaceToStorage(workspace);
    if (ok) {
      setSaveStatus('saved');
      setLastSavedAt(new Date().toISOString());
    } else {
      setSaveStatus('error');
    }
  }, [workspace]);

  // Debounced autosave (350ms) so typing or dragging never writes synchronously every keystroke
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      saveWorkspaceToStorage(workspace);
      return;
    }
    setSaveStatus('saving');
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      const ok = saveWorkspaceToStorage(workspace);
      if (ok) {
        setSaveStatus('saved');
        setLastSavedAt(new Date().toISOString());
      } else {
        setSaveStatus('error');
      }
      saveTimerRef.current = null;
    }, 350);

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [workspace]);

  const activeProject = useMemo(() => {
    return (
      workspace.projects.find((p) => p.id === workspace.activeProjectId) ??
      workspace.projects[0]
    );
  }, [workspace]);

  const commitWorkspace = useCallback(
    (updater: (prev: StudioWorkspace) => StudioWorkspace, recordHistory = true) => {
      setHistory((prevStack) => {
        const nextWs = updater(prevStack.present);
        if (recordHistory) {
          return pushHistoryState(prevStack, nextWs);
        }
        return { ...prevStack, present: nextWs };
      });
    },
    []
  );

  const undo = useCallback(() => {
    setHistory((prev) => undoHistory(prev));
  }, []);

  const redo = useCallback(() => {
    setHistory((prev) => redoHistory(prev));
  }, []);

  // Global keyboard shortcuts (Ctrl+K, Ctrl+S, Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTextInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((open) => !open);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        triggerImmediateSave();
        return;
      }

      if (isTextInput) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y')
      ) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo, triggerImmediateSave]);

  const setActiveProjectId = useCallback(
    (projectId: string) => {
      commitWorkspace((prev) => {
        if (!prev.projects.some((p) => p.id === projectId)) return prev;
        const now = new Date().toISOString();
        return {
          ...prev,
          activeProjectId: projectId,
          projects: prev.projects.map((p) =>
            p.id === projectId ? { ...p, lastOpenedAt: now } : p
          ),
        };
      }, false);
    },
    [commitWorkspace]
  );

  const updateActiveProject = useCallback(
    (updater: (project: CricketProject) => CricketProject, recordHistory = true) => {
      commitWorkspace((prev) => {
        const nextProjects = prev.projects.map((p) => {
          if (p.id !== prev.activeProjectId) return p;
          const updated = updater(p);
          return {
            ...updated,
            updatedAt: new Date().toISOString(),
          };
        });
        return { ...prev, projects: nextProjects };
      }, recordHistory);
    },
    [commitWorkspace]
  );

  const updateFieldDesign = useCallback(
    (updater: (field: FieldDesign) => FieldDesign) => {
      updateActiveProject((project) => ({
        ...project,
        fieldDesign: updater(project.fieldDesign),
      }));
    },
    [updateActiveProject]
  );

  const updateQuizQuestion = useCallback(
    (questionIndex: number, updater: (question: QuizQuestion) => QuizQuestion) => {
      updateActiveProject((project) => ({
        ...project,
        quizQuestions: project.quizQuestions.map((q) =>
          q.index === questionIndex ? updater(q) : q
        ),
      }));
    },
    [updateActiveProject]
  );

  const createProject = useCallback(
    (title: string, presetId: string, aspectRatio: AspectRatio) => {
      const next = createBlankProject(title, presetId, aspectRatio);
      commitWorkspace((prev) => ({
        ...prev,
        activeProjectId: next.id,
        projects: [next, ...prev.projects],
      }));
    },
    [commitWorkspace]
  );

  const createWizardProject = useCallback(
    (params: WizardProjectParams) => {
      const next = createProjectFromWizard(params);
      commitWorkspace((prev) => ({
        ...prev,
        activeProjectId: next.id,
        projects: [next, ...prev.projects],
      }));
      setWizardOpen(false);
      setActiveModule('dashboard');
    },
    [commitWorkspace]
  );

  const duplicateProject = useCallback(
    (projectId: string) => {
      commitWorkspace((prev) => {
        const source = prev.projects.find((p) => p.id === projectId);
        if (!source) return prev;
        const now = new Date().toISOString();
        const copy = migrateProjectToPhase2({
          ...JSON.parse(JSON.stringify(source)),
          id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: `${source.title} (Copy)`,
          createdAt: now,
          updatedAt: now,
          lastOpenedAt: now,
        });
        return {
          ...prev,
          activeProjectId: copy.id,
          projects: [copy, ...prev.projects],
        };
      });
    },
    [commitWorkspace]
  );

  const deleteProject = useCallback(
    (projectId: string) => {
      commitWorkspace((prev) => {
        if (prev.projects.length <= 1) return prev;
        const remaining = prev.projects.filter((p) => p.id !== projectId);
        const nextActive =
          prev.activeProjectId === projectId ? remaining[0].id : prev.activeProjectId;
        return {
          ...prev,
          activeProjectId: nextActive,
          projects: remaining,
        };
      });
    },
    [commitWorkspace]
  );

  const importProject = useCallback(
    (project: CricketProject, overwriteExisting = false) => {
      const migrated = migrateProjectToPhase2(project);
      commitWorkspace((prev) => {
        const exists = prev.projects.some((p) => p.id === migrated.id);
        if (exists && overwriteExisting) {
          return {
            ...prev,
            activeProjectId: migrated.id,
            projects: prev.projects.map((p) => (p.id === migrated.id ? migrated : p)),
          };
        }
        const safeProject = exists
          ? {
              ...migrated,
              id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            }
          : migrated;
        return {
          ...prev,
          activeProjectId: safeProject.id,
          projects: [safeProject, ...prev.projects],
        };
      });
    },
    [commitWorkspace]
  );

  const saveBrandPreset = useCallback(
    (brand: BrandKit) => {
      commitWorkspace((prev) => {
        const existing = prev.brandPresets ?? DEFAULT_BRAND_PRESETS;
        const idx = existing.findIndex((b) => b.id === brand.id);
        const nextPresets =
          idx >= 0
            ? existing.map((b) => (b.id === brand.id ? { ...brand } : b))
            : [{ ...brand }, ...existing];
        return { ...prev, brandPresets: nextPresets };
      });
    },
    [commitWorkspace]
  );

  const duplicateBrandPreset = useCallback(
    (presetId: string) => {
      commitWorkspace((prev) => {
        const existing = prev.brandPresets ?? DEFAULT_BRAND_PRESETS;
        const source = existing.find((b) => b.id === presetId);
        if (!source) return prev;
        const copy: BrandKit = {
          ...source,
          id: `brand-${Date.now()}`,
          name: `${source.name} (Copy)`,
        };
        return { ...prev, brandPresets: [copy, ...existing] };
      });
    },
    [commitWorkspace]
  );

  const deleteBrandPreset = useCallback(
    (presetId: string) => {
      commitWorkspace((prev) => {
        const existing = prev.brandPresets ?? DEFAULT_BRAND_PRESETS;
        if (existing.length <= 1) return prev;
        return {
          ...prev,
          brandPresets: existing.filter((b) => b.id !== presetId),
        };
      });
    },
    [commitWorkspace]
  );

  const createSnapshot = useCallback(
    (name: string) => {
      updateActiveProject((proj) => {
        const snap = createProjectSnapshot(proj, name);
        return {
          ...proj,
          snapshots: [snap, ...(proj.snapshots ?? [])].slice(0, 20),
        };
      });
    },
    [updateActiveProject]
  );

  const restoreSnapshot = useCallback(
    (snapshotId: string) => {
      updateActiveProject((proj) => {
        const snap = proj.snapshots?.find((s) => s.id === snapshotId);
        if (!snap) return proj;
        const restored = restoreProjectFromSnapshot(proj, snap);
        return restored ?? proj;
      });
    },
    [updateActiveProject]
  );

  const duplicateSnapshot = useCallback(
    (snapshotId: string) => {
      updateActiveProject((proj) => {
        const snap = proj.snapshots?.find((s) => s.id === snapshotId);
        if (!snap) return proj;
        const copy = {
          ...snap,
          id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          name: `${snap.name} (Copy)`,
          createdAt: new Date().toISOString(),
        };
        return {
          ...proj,
          snapshots: [copy, ...(proj.snapshots ?? [])],
        };
      });
    },
    [updateActiveProject]
  );

  const deleteSnapshot = useCallback(
    (snapshotId: string) => {
      updateActiveProject((proj) => ({
        ...proj,
        snapshots: (proj.snapshots ?? []).filter((s) => s.id !== snapshotId),
      }));
    },
    [updateActiveProject]
  );

  // Migrate legacy inline Data URLs to IndexedDB AssetBlobStore once on startup
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let totalMigrated = 0;
      const migratedProjects: CricketProject[] = [];
      for (const p of workspace.projects) {
        const res = await migrateProjectAssetsToIndexedDB(p);
        totalMigrated += res.migratedCount;
        migratedProjects.push(res.project);
      }
      if (!cancelled && totalMigrated > 0) {
        commitWorkspace(
          (prev) => ({
            ...prev,
            projects: migratedProjects,
          }),
          false
        );
      }
    })();
    return () => {
      cancelled = true;
    };
    // Run once on initial mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const appendExportHistory = useCallback(
    (entry: ExportHistoryEntry) => {
      commitWorkspace(
        (prev) => ({
          ...prev,
          exportHistory: [entry, ...(prev.exportHistory ?? [])].slice(0, 30),
        }),
        false
      );
    },
    [commitWorkspace]
  );

  const refreshPreflight = useCallback(async () => {
    const report = await runAssetPreflight(activeProject);
    setLastPreflight(report);
    return report;
  }, [activeProject]);

  const refreshRecoverableJob = useCallback(async () => {
    const clientCp = loadActiveRenderCheckpoint();
    let serverJob: ServerRenderJobRecord | null = null;
    if (clientCp?.jobId) {
      serverJob = await fetchServerRenderJob(clientCp.jobId);
    }
    if (!serverJob) {
      const jobs = await listServerRenderJobs();
      serverJob =
        jobs.find(
          (j) =>
            j.status === 'interrupted' ||
            j.status === 'rendering' ||
            (j.status === 'failed' && j.verifiedSegments > 0)
        ) ?? null;
    }
    if (
      serverJob &&
      serverJob.status !== 'completed' &&
      serverJob.status !== 'cancelled' &&
      serverJob.totalSegments > 0
    ) {
      setRecoverableJob({
        serverJob,
        clientCheckpoint:
          clientCp && clientCp.jobId === serverJob.jobId ? clientCp : null,
      });
    } else {
      if (clientCp && (!serverJob || serverJob.status === 'completed' || serverJob.status === 'cancelled')) {
        clearActiveRenderCheckpoint();
      }
      setRecoverableJob(null);
    }
  }, []);

  useEffect(() => {
    void refreshRecoverableJob();
  }, [refreshRecoverableJob]);

  const runRenderJobInternal = useCallback(
    async (
      job: RenderJob,
      targetProject: CricketProject,
      resumeJobId?: string
    ): Promise<RenderResult | null> => {
      isRenderingRef.current = true;
      setIsRendering(true);
      setActiveRenderJobId(job.id);
      setRenderError(null);
      setRecoverableJob(null);
      setActiveRenderProgress({
        stage: 'preparing-assets',
        stageLabel: resumeJobId ? 'Resuming Render Checkpoint' : 'Preparing Render Pipeline',
        percent: 1,
        currentFrame: 0,
        totalFrames: Math.max(
          1,
          Math.round(
            Math.max(1, computeSequenceDuration(targetProject, 'timeline')) *
              job.settings.fps
          )
        ),
        elapsedMs: 0,
        estimatedRemainingMs: null,
        currentSceneName: 'Initializing',
      });

      const handle = startVideoExport(targetProject, job.settings, {
        resumeJobId,
        onProgress: (prog) => {
          setActiveRenderProgress(prog);
          setRenderQueue((prev) => markJobRendering(prev, job.id, prog));
        },
        onPreflight: (pf) => {
          setLastPreflight(pf);
        },
      });
      renderHandleRef.current = handle;

      try {
        const result = await handle.promise;
        renderHandleRef.current = null;
        setLatestRenderResult(result);
        setRenderQueue((prev) => markJobCompleted(prev, job.id, result));
        appendExportHistory({
          id: `hist-${Date.now().toString(36)}`,
          projectId: targetProject.id,
          projectTitle: targetProject.title,
          exportedAt: new Date().toISOString(),
          resolution: `${result.width}×${result.height}`,
          aspectRatio: job.settings.aspectRatio,
          fps: result.fps,
          durationSec: result.durationSec,
          format: result.container,
          fileSizeBytes: result.fileSizeBytes,
          status: 'completed',
        });
        isRenderingRef.current = false;
        setIsRendering(false);
        setActiveRenderJobId(null);
        return result;
      } catch (err) {
        renderHandleRef.current = null;
        const rErr: RenderError =
          err && typeof err === 'object' && 'code' in err
            ? (err as RenderError)
            : {
                code: 'ENCODE_FAILED',
                message: err instanceof Error ? err.message : String(err),
              };
        setRenderError(rErr);
        if (rErr.code === 'CANCELLED') {
          setActiveRenderProgress(null);
        }
        setRenderQueue((prev) => markJobFailed(prev, job.id, rErr));
        appendExportHistory({
          id: `hist-${Date.now().toString(36)}`,
          projectId: targetProject.id,
          projectTitle: targetProject.title,
          exportedAt: new Date().toISOString(),
          resolution: `${job.settings.width}×${job.settings.height}`,
          aspectRatio: job.settings.aspectRatio,
          fps: job.settings.fps,
          durationSec: Math.max(1, computeSequenceDuration(targetProject, 'timeline')),
          format: job.settings.format,
          fileSizeBytes: 0,
          status: rErr.code === 'CANCELLED' ? 'cancelled' : 'failed',
        });
        isRenderingRef.current = false;
        setIsRendering(false);
        setActiveRenderJobId(null);
        void refreshRecoverableJob();
        return null;
      }
    },
    [appendExportHistory, refreshRecoverableJob]
  );

  const resumeRecoveredJob = useCallback(async (): Promise<RenderResult | null> => {
    if (isRenderingRef.current || !recoverableJob) return null;
    const { serverJob, clientCheckpoint } = recoverableJob;
    const targetProj =
      workspace.projects.find((p) => p.id === serverJob.projectId) ?? activeProject;
    const settings: RenderSettings = clientCheckpoint?.settings ?? {
      outputPresetId:
        serverJob.resolution.width === 1280
          ? 'draft-720p'
          : serverJob.resolution.height > serverJob.resolution.width
          ? 'shorts-1080x1920'
          : 'youtube-1080p',
      qualityPresetId: serverJob.resolution.width === 1280 ? 'draft' : 'standard',
      aspectRatio:
        serverJob.resolution.height > serverJob.resolution.width
          ? '9:16'
          : serverJob.resolution.width === serverJob.resolution.height
          ? '1:1'
          : '16:9',
      width: serverJob.resolution.width,
      height: serverJob.resolution.height,
      fps: serverJob.fps,
      format: serverJob.codecConfig.container,
      videoBitrateBps: serverJob.codecConfig.videoBitrateBps,
      audioBitrateBps: serverJob.codecConfig.audioBitrateBps,
      audioEnabled: serverJob.codecConfig.audioEnabled,
      normalizeAudio: true,
      outputName: serverJob.outputFilename.replace(/\.(mp4|webm)$/i, ''),
    };
    const job = createRenderJob(targetProj, settings, `Resumed: ${serverJob.projectTitle}`);
    setRenderQueue((prev) => enqueueRenderJob(prev, job));
    return runRenderJobInternal(job, targetProj, serverJob.jobId);
  }, [activeProject, recoverableJob, runRenderJobInternal, workspace.projects]);

  const discardRecoveredJob = useCallback(async () => {
    if (!recoverableJob) {
      clearActiveRenderCheckpoint();
      return;
    }
    await cancelServerRenderJob(recoverableJob.serverJob.jobId);
    clearActiveRenderCheckpoint();
    setRecoverableJob(null);
  }, [recoverableJob]);

  const executeSingleRender = useCallback(
    async (
      settings: RenderSettings,
      customProject?: CricketProject
    ): Promise<RenderResult | null> => {
      if (isRenderingRef.current) return null;
      const proj = customProject ?? activeProject;
      const job = createRenderJob(proj, settings);
      setRenderQueue((prev) => enqueueRenderJob(prev, job));
      return runRenderJobInternal(job, proj);
    },
    [activeProject, runRenderJobInternal]
  );

  const enqueueExportJob = useCallback(
    (settings: RenderSettings, label?: string) => {
      const job = createRenderJob(activeProject, settings, label);
      setRenderQueue((prev) => enqueueRenderJob(prev, job));
      return job;
    },
    [activeProject]
  );

  const enqueueAllFormats = useCallback(
    (fps: 30 | 60 = 30, format: 'mp4' | 'webm' = 'mp4') => {
      setRenderQueue((prev) => enqueueMultiFormatSuite(prev, activeProject, fps, format));
    },
    [activeProject]
  );

  const startNextQueuedJob = useCallback(async () => {
    if (isRenderingRef.current) return;
    while (!isRenderingRef.current) {
      const next = renderQueueRef.current.find((j) => j.status === 'queued');
      if (!next) break;
      const targetProj =
        workspace.projects.find((p) => p.id === next.projectId) ?? activeProject;
      const res = await runRenderJobInternal(next, targetProj);
      if (!res) break; // Stop queue on cancel or error so user can inspect
    }
  }, [activeProject, runRenderJobInternal, workspace.projects]);

  const cancelActiveRender = useCallback(() => {
    renderHandleRef.current?.cancel();
    setActiveRenderProgress(null);
  }, []);

  const retryQueueJob = useCallback((jobId: string) => {
    setRenderQueue((prev) => retryRenderJob(prev, jobId));
  }, []);

  const removeQueueJob = useCallback((jobId: string) => {
    setRenderQueue((prev) => {
      const target = prev.find((j) => j.id === jobId);
      if (target?.result?.objectUrl) {
        URL.revokeObjectURL(target.result.objectUrl);
      }
      return removeRenderJob(prev, jobId);
    });
  }, []);

  const upsertSpecialProject = useCallback(
    (proj: CricketProject) => {
      commitWorkspace((prev) => {
        const existingIdx = prev.projects.findIndex((p) => p.id === proj.id);
        if (existingIdx >= 0) {
          return {
            ...prev,
            activeProjectId: proj.id,
            projects: prev.projects.map((p) => (p.id === proj.id ? proj : p)),
          };
        }
        return {
          ...prev,
          activeProjectId: proj.id,
          projects: [proj, ...prev.projects],
        };
      }, false);
      return proj;
    },
    [commitWorkspace]
  );

  const loadRendererQaProject = useCallback(
    (aspectRatio: AspectRatio = '16:9') =>
      upsertSpecialProject(createRendererQaProject(aspectRatio)),
    [upsertSpecialProject]
  );

  const loadClientDemoProject = useCallback(
    (aspectRatio: AspectRatio = '16:9') =>
      upsertSpecialProject(createClientDemoProject(aspectRatio)),
    [upsertSpecialProject]
  );

  const loadBenchmarkProject = useCallback(
    (questionCount: 5 | 10 | 30, aspectRatio: AspectRatio = '16:9') =>
      upsertSpecialProject(createBenchmarkProject(questionCount, aspectRatio)),
    [upsertSpecialProject]
  );

  const clearRenderError = useCallback(() => {
    setRenderError(null);
  }, []);

  const value: StudioContextValue = {
    workspace,
    activeProject,
    activeModule,
    setActiveModule,
    setActiveProjectId,
    updateActiveProject,
    updateFieldDesign,
    updateQuizQuestion,
    createProject,
    createWizardProject,
    duplicateProject,
    deleteProject,
    importProject,
    saveBrandPreset,
    duplicateBrandPreset,
    deleteBrandPreset,
    createSnapshot,
    restoreSnapshot,
    duplicateSnapshot,
    deleteSnapshot,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    saveStatus,
    lastSavedAt,
    triggerImmediateSave,
    wizardOpen,
    setWizardOpen,
    commandPaletteOpen,
    setCommandPaletteOpen,
    selectedQuizIndex,
    setSelectedQuizIndex,
    renderQueue,
    activeRenderJobId,
    isRendering,
    activeRenderProgress,
    latestRenderResult,
    renderError,
    lastPreflight,
    executeSingleRender,
    enqueueExportJob,
    enqueueAllFormats,
    startNextQueuedJob,
    cancelActiveRender,
    retryQueueJob,
    removeQueueJob,
    refreshPreflight,
    loadRendererQaProject,
    loadClientDemoProject,
    loadBenchmarkProject,
    clearRenderError,
    recoverableJob,
    resumeRecoveredJob,
    discardRecoveredJob,
    refreshRecoverableJob,
  };

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio(): StudioContextValue {
  const ctx = useContext(StudioContext);
  if (!ctx) {
    throw new Error('useStudio must be used inside StudioProvider');
  }
  return ctx;
}
