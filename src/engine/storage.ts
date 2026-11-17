import type {
  AspectRatio,
  BrandKit,
  ContentType,
  CricketProject,
  ProjectSnapshot,
  ProjectTemplateType,
  QuizOptionIndex,
  QuizQuestion,
  StudioWorkspace,
} from '../types/studio';
import { cloneFieldDesignFromPreset } from './cricketField';
import {
  DEFAULT_TIMELINE_TRACKS,
  MAX_QUIZ_QUESTIONS,
  QUIZ_QUESTION_COUNT,
} from './timeline';
import {
  DEFAULT_AUTO_EPISODE_TIMING,
  DEFAULT_AUTO_SFX_SETTINGS,
  buildAutoEpisodeTimeline,
} from './autoEpisode';
import {
  DEFAULT_BRAND_PRESETS,
  THUMBNAIL_TEMPLATES,
  cloneBrandPreset,
  createDefaultBroadcastGraphics,
  createDefaultYouTubeMetadata,
} from './brandDefaults';

export const WORKSPACE_STORAGE_KEY = 'cricket_creator_studio_workspace_v1';

export function createEmptyQuizQuestion(index: number): QuizQuestion {
  return {
    id: `q-${index + 1}`,
    index,
    prompt: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    countdownSec: 10,
    explanation: '',
    category: 'Cricket Rules',
    difficulty: 'medium',
    includeFieldOverlay: false,
  };
}

export function normalizeQuizQuestions(
  raw: Partial<QuizQuestion>[] | undefined,
  minLength = QUIZ_QUESTION_COUNT
): QuizQuestion[] {
  const targetLen = Math.min(
    MAX_QUIZ_QUESTIONS,
    Math.max(minLength, raw?.length ?? QUIZ_QUESTION_COUNT)
  );
  const result: QuizQuestion[] = [];
  for (let i = 0; i < targetLen; i++) {
    const existing = raw?.[i];
    const base = createEmptyQuizQuestion(i);
    if (!existing) {
      result.push(base);
      continue;
    }
    const opts = Array.isArray(existing.options) ? existing.options : ['', '', '', ''];
    const correctIdx =
      existing.correctIndex === 0 ||
      existing.correctIndex === 1 ||
      existing.correctIndex === 2 ||
      existing.correctIndex === 3
        ? (existing.correctIndex as QuizOptionIndex)
        : 0;

    result.push({
      id: typeof existing.id === 'string' && existing.id ? existing.id : base.id,
      index: i,
      prompt: typeof existing.prompt === 'string' ? existing.prompt : '',
      options: [
        typeof opts[0] === 'string' ? opts[0] : '',
        typeof opts[1] === 'string' ? opts[1] : '',
        typeof opts[2] === 'string' ? opts[2] : '',
        typeof opts[3] === 'string' ? opts[3] : '',
      ],
      correctIndex: correctIdx,
      countdownSec:
        typeof existing.countdownSec === 'number' &&
        existing.countdownSec >= 3 &&
        existing.countdownSec <= 30
          ? Math.round(existing.countdownSec)
          : 10,
      explanation: typeof existing.explanation === 'string' ? existing.explanation : '',
      category:
        typeof existing.category === 'string' && existing.category.trim()
          ? existing.category
          : 'Cricket Rules',
      difficulty:
        existing.difficulty === 'easy' ||
        existing.difficulty === 'hard' ||
        existing.difficulty === 'medium'
          ? existing.difficulty
          : 'medium',
      includeFieldOverlay: Boolean(existing.includeFieldOverlay),
    });
  }
  return result;
}

/**
 * Migrates any Phase 1 project JSON or partial project object into full Phase 2 structure
 * while preserving all existing fielders, ball paths, and quiz questions.
 */
export function migrateProjectToPhase2(raw: Partial<CricketProject>): CricketProject {
  const now = new Date().toISOString();
  const fallbackField = cloneFieldDesignFromPreset('powerplay-attack');
  const fieldDesign = raw.fieldDesign
    ? {
        ...fallbackField,
        ...raw.fieldDesign,
        fielders: Array.isArray(raw.fieldDesign.fielders)
          ? raw.fieldDesign.fielders
          : fallbackField.fielders,
        ballPath: {
          ...fallbackField.ballPath,
          ...(raw.fieldDesign.ballPath ?? {}),
        },
      }
    : fallbackField;

  const brandKit: BrandKit = raw.brandKit
    ? { ...cloneBrandPreset('brand-default'), ...raw.brandKit }
    : cloneBrandPreset('brand-default');

  const quizQuestions = normalizeQuizQuestions(raw.quizQuestions);
  const aspectRatio: AspectRatio =
    raw.settings?.aspectRatio === '9:16'
      ? '9:16'
      : raw.settings?.aspectRatio === '1:1'
      ? '1:1'
      : '16:9';

  const baseProject: CricketProject = {
    id:
      typeof raw.id === 'string' && raw.id
        ? raw.id
        : `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    schemaVersion: 2,
    title:
      typeof raw.title === 'string' && raw.title.trim()
        ? raw.title.trim()
        : 'Untitled Cricket Episode',
    subtitle:
      typeof raw.subtitle === 'string'
        ? raw.subtitle
        : 'Tactical Breakdown & Broadcast Production',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : now,
    lastOpenedAt: typeof raw.lastOpenedAt === 'string' ? raw.lastOpenedAt : now,
    fieldDesign,
    fieldScenes:
      Array.isArray(raw.fieldScenes) && raw.fieldScenes.length > 0
        ? raw.fieldScenes
        : [
            {
              id: 'fscene-default',
              name: fieldDesign.activePresetName || 'Primary Field Setup',
              createdAt: now,
              fieldDesign,
              framing: { zoom: 1, panX: 0, panY: 0 },
              overlayIds: [],
            },
          ],
    quizQuestions,
    settings: {
      aspectRatio,
      fps: raw.settings?.fps === 60 ? 60 : 30,
      seriesName:
        typeof raw.settings?.seriesName === 'string'
          ? raw.settings.seriesName
          : 'Cricket Creator Lab',
      channelHandle:
        typeof raw.settings?.channelHandle === 'string'
          ? raw.settings.channelHandle
          : brandKit.youtubeHandle,
      showSafeZones: raw.settings?.showSafeZones ?? true,
      customResolution: raw.settings?.customResolution,
    },
    production: {
      contentType: raw.production?.contentType ?? 'quiz',
      templateType: raw.production?.templateType ?? 'quiz-30',
      episodeNumber: raw.production?.episodeNumber ?? '01',
      description:
        raw.production?.description ??
        'Complete cricket creator episode with tactical field graphics and interactive quiz.',
      targetPlatform: raw.production?.targetPlatform ?? 'YouTube',
      quizTargetCount: raw.production?.quizTargetCount ?? 30,
    },
    brandKit,
    broadcastGraphics:
      Array.isArray(raw.broadcastGraphics) && raw.broadcastGraphics.length > 0
        ? raw.broadcastGraphics
        : createDefaultBroadcastGraphics(brandKit.accentColor),
    assets: Array.isArray(raw.assets) ? raw.assets : [],
    audioAssets: Array.isArray(raw.audioAssets) ? raw.audioAssets : [],
    autoSfx: raw.autoSfx
      ? { ...DEFAULT_AUTO_SFX_SETTINGS, ...raw.autoSfx }
      : { ...DEFAULT_AUTO_SFX_SETTINGS },
    audioMix: raw.audioMix ?? {
      masterMuted: false,
      voiceVolume: 1,
      musicVolume: 0.35,
      sfxVolume: 0.85,
    },
    timelineTracks:
      Array.isArray(raw.timelineTracks) && raw.timelineTracks.length > 0
        ? raw.timelineTracks
        : DEFAULT_TIMELINE_TRACKS.map((t) => ({ ...t })),
    timelineClips: Array.isArray(raw.timelineClips) ? raw.timelineClips : [],
    autoEpisodeTiming: raw.autoEpisodeTiming
      ? { ...DEFAULT_AUTO_EPISODE_TIMING, ...raw.autoEpisodeTiming }
      : { ...DEFAULT_AUTO_EPISODE_TIMING },
    voiceoverSegments: Array.isArray(raw.voiceoverSegments)
      ? raw.voiceoverSegments
      : [],
    youtubeMetadata:
      raw.youtubeMetadata ??
      createDefaultYouTubeMetadata(
        typeof raw.title === 'string' ? raw.title : 'Cricket Episode'
      ),
    thumbnailDesign:
      raw.thumbnailDesign ??
      JSON.parse(JSON.stringify(THUMBNAIL_TEMPLATES[0].design)),
    snapshots: Array.isArray(raw.snapshots) ? raw.snapshots : [],
    captionSettings: raw.captionSettings ?? {
      enabled: true,
      style: 'broadcast',
      fontSize: 28,
      showBackground: true,
      textOutline: true,
    },
    brandOverlay: raw.brandOverlay ?? {
      logoScale: 1,
      watermarkOpacity: 0.75,
      watermarkScale: 1,
      showWatermark: true,
      showChannelHandle: true,
    },
    fieldRenderOptions: raw.fieldRenderOptions ?? {
      showLabels: true,
      showTrajectoryTrail: true,
      showBounceMarker: true,
      showSpeedGraphic: true,
    },
    defaultTransition: raw.defaultTransition ?? {
      type: 'fade',
      durationSec: 0.4,
    },
  };

  if (baseProject.timelineClips.length === 0) {
    const autoBuilt = buildAutoEpisodeTimeline(baseProject);
    baseProject.timelineClips = autoBuilt.clips;
    if (baseProject.voiceoverSegments.length === 0) {
      baseProject.voiceoverSegments = autoBuilt.voiceoverSegments;
    }
  }

  return baseProject;
}

export interface WizardProjectParams {
  title: string;
  contentType: ContentType;
  aspectRatio: AspectRatio;
  brandPreset: BrandKit;
  seriesName: string;
  episodeNumber: string;
  description: string;
  targetPlatform: 'YouTube' | 'YouTube Shorts' | 'Instagram Reels' | 'Multi-Platform';
  fps: 30 | 60;
  templateType: ProjectTemplateType;
  seedQuestions?: Partial<QuizQuestion>[];
}

export function createProjectFromWizard(params: WizardProjectParams): CricketProject {
  const now = new Date().toISOString();
  const fieldPresetId =
    params.templateType === 'death-overs-analysis'
      ? 'death-overs-defend'
      : params.templateType === 'field-placement-explanation'
      ? 'test-slip-cordon'
      : 'powerplay-attack';

  const quizTargetCount =
    params.templateType === 'quiz-10'
      ? 10
      : params.templateType === 'quiz-30'
      ? 30
      : params.contentType === 'quiz'
      ? 30
      : 10;

  const fieldDesign = cloneFieldDesignFromPreset(fieldPresetId);

  const raw: Partial<CricketProject> = {
    id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: params.title.trim() || 'Untitled Cricket Episode',
    subtitle: params.description.trim() || `${params.seriesName} · Episode ${params.episodeNumber}`,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
    fieldDesign,
    quizQuestions: normalizeQuizQuestions(params.seedQuestions ?? [], 30),
    settings: {
      aspectRatio: params.aspectRatio,
      fps: params.fps,
      seriesName: params.seriesName.trim() || params.brandPreset.channelName,
      channelHandle: params.brandPreset.youtubeHandle,
      showSafeZones: true,
    },
    production: {
      contentType: params.contentType,
      templateType: params.templateType,
      episodeNumber: params.episodeNumber.trim() || '01',
      description: params.description.trim(),
      targetPlatform: params.targetPlatform,
      quizTargetCount,
    },
    brandKit: { ...params.brandPreset },
  };

  return migrateProjectToPhase2(raw);
}

export function createBlankProject(
  title: string,
  presetId = 'powerplay-attack',
  aspectRatio: AspectRatio = '16:9'
): CricketProject {
  const now = new Date().toISOString();
  return migrateProjectToPhase2({
    id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: title.trim() || 'Untitled Cricket Episode',
    subtitle: 'Tactical Breakdown & 30-Question Broadcast Quiz',
    createdAt: now,
    updatedAt: now,
    fieldDesign: cloneFieldDesignFromPreset(presetId),
    quizQuestions: normalizeQuizQuestions([]),
    settings: {
      aspectRatio,
      fps: 30,
      seriesName: 'Cricket Creator Lab',
      channelHandle: '@CricketCreator',
      showSafeZones: true,
    },
  });
}

export function createProjectSnapshot(
  project: CricketProject,
  name: string
): ProjectSnapshot {
  // Strip nested snapshots inside the snapshot payload to avoid exponential storage growth
  const { snapshots: _omit, ...cleanProject } = project;
  return {
    id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || `Snapshot ${new Date().toLocaleTimeString()}`,
    createdAt: new Date().toISOString(),
    projectDataJson: JSON.stringify(cleanProject),
  };
}

export function restoreProjectFromSnapshot(
  currentProject: CricketProject,
  snapshot: ProjectSnapshot
): CricketProject | null {
  try {
    const parsed = JSON.parse(snapshot.projectDataJson) as Partial<CricketProject>;
    const migrated = migrateProjectToPhase2(parsed);
    return {
      ...migrated,
      id: currentProject.id,
      snapshots: currentProject.snapshots,
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function parseImportedProjectJson(jsonText: string):
  | { ok: true; project: CricketProject }
  | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(jsonText) as Partial<CricketProject>;
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, error: 'JSON root must be an object.' };
    }
    if (typeof parsed.title !== 'string' || !parsed.title.trim()) {
      return { ok: false, error: 'Project JSON must include a valid "title" string.' };
    }
    if (!parsed.fieldDesign || !Array.isArray(parsed.fieldDesign.fielders)) {
      return { ok: false, error: 'Project JSON is missing "fieldDesign.fielders".' };
    }
    if (!Array.isArray(parsed.quizQuestions)) {
      return { ok: false, error: 'Project JSON is missing "quizQuestions" array.' };
    }

    const migrated = migrateProjectToPhase2(parsed);
    return { ok: true, project: migrated };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Invalid JSON syntax.',
    };
  }
}

export function loadWorkspaceFromStorage(fallback: StudioWorkspace): StudioWorkspace {
  if (typeof window === 'undefined' || !window.localStorage) {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<StudioWorkspace>;
    if (!parsed || !Array.isArray(parsed.projects) || parsed.projects.length === 0) {
      return fallback;
    }
    const normalizedProjects = parsed.projects.map((p) => migrateProjectToPhase2(p));
    const activeExists = normalizedProjects.some((p) => p.id === parsed.activeProjectId);
    const brandPresets =
      Array.isArray(parsed.brandPresets) && parsed.brandPresets.length > 0
        ? parsed.brandPresets
        : DEFAULT_BRAND_PRESETS.map((b) => ({ ...b }));

    return {
      version: 3,
      activeProjectId: activeExists
        ? (parsed.activeProjectId as string)
        : normalizedProjects[0].id,
      projects: normalizedProjects,
      brandPresets,
      exportHistory: Array.isArray(parsed.exportHistory) ? parsed.exportHistory : [],
    };
  } catch {
    return fallback;
  }
}

export function saveWorkspaceToStorage(workspace: StudioWorkspace): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }
  try {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
    return true;
  } catch {
    return false;
  }
}
