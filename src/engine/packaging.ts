import JSZip from 'jszip';
import type { CricketProject } from '../types/studio';
import { migrateProjectToPhase2 } from './storage';
import { AssetBlobStore, resolveAssetBlob } from './assetBlobStore';
import { generateSrtFromProject } from './captions';
import { generateYouTubeChaptersFromTimeline } from './timeline';

export interface ProjectPackageManifest {
  packageVersion: number;
  exportedAt: string;
  projectId: string;
  projectTitle: string;
  aspectRatio: string;
  fps: number;
  counts: {
    quizQuestions: number;
    timelineClips: number;
    fieldScenes: number;
    assets: number;
    audioAssets: number;
    broadcastGraphics: number;
  };
}

export function buildYouTubeDeliveryFiles(
  project: CricketProject
): Record<string, string> {
  const yt = project.youtubeMetadata;
  const chapters =
    yt.chapterMarkersText?.trim() ||
    generateYouTubeChaptersFromTimeline(project.timelineClips ?? []);
  return {
    'title.txt': yt.videoTitle || project.title,
    'description.txt': yt.description || project.subtitle || '',
    'tags.txt': (yt.tags ?? []).join(', '),
    'hashtags.txt': (yt.hashtags ?? []).join(' '),
    'chapters.txt': chapters,
    'pinned-comment.txt': yt.pinnedComment || '',
  };
}

export async function buildProjectPackageZip(project: CricketProject): Promise<{
  blob: Blob;
  filename: string;
  manifest: ProjectPackageManifest;
}> {
  const zip = new JSZip();
  const manifest: ProjectPackageManifest = {
    packageVersion: 3,
    exportedAt: new Date().toISOString(),
    projectId: project.id,
    projectTitle: project.title,
    aspectRatio: project.settings.aspectRatio,
    fps: project.settings.fps,
    counts: {
      quizQuestions: project.quizQuestions.length,
      timelineClips: project.timelineClips.length,
      fieldScenes: project.fieldScenes.length,
      assets: project.assets.length,
      audioAssets: project.audioAssets.length,
      broadcastGraphics: project.broadcastGraphics.length,
    },
  };

  zip.file('project.json', JSON.stringify(project, null, 2));
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('branding.json', JSON.stringify(project.brandKit, null, 2));
  zip.file(
    'timeline.json',
    JSON.stringify(
      {
        tracks: project.timelineTracks,
        clips: project.timelineClips,
        autoEpisodeTiming: project.autoEpisodeTiming,
      },
      null,
      2
    )
  );
  zip.file('quiz.json', JSON.stringify(project.quizQuestions, null, 2));
  zip.file('field-scenes.json', JSON.stringify(project.fieldScenes, null, 2));
  zip.file(
    'audio-metadata.json',
    JSON.stringify(
      {
        audioAssets: project.audioAssets.map(({ dataUrl: _omit, ...meta }) => meta),
        autoSfx: project.autoSfx,
        audioMix: project.audioMix,
        voiceoverSegments: project.voiceoverSegments,
      },
      null,
      2
    )
  );
  zip.file('subtitles.srt', generateSrtFromProject(project));

  const ytFiles = buildYouTubeDeliveryFiles(project);
  for (const [name, content] of Object.entries(ytFiles)) {
    zip.file(`youtube/${name}`, content);
  }

  for (const asset of project.assets ?? []) {
    const blob = await resolveAssetBlob(asset);
    if (blob) {
      zip.file(`assets/${asset.id}_${asset.name}`, blob);
    }
  }
  for (const aud of project.audioAssets ?? []) {
    const blob = await resolveAssetBlob(aud);
    if (blob) {
      zip.file(`audio/${aud.id}_${aud.name}`, blob);
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const slug = project.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return {
    blob,
    filename: `${slug || 'cricket-project'}-package.zip`,
    manifest,
  };
}

export async function buildFullDeliveryZip(
  project: CricketProject,
  options: {
    videoBlob?: Blob;
    videoFilename?: string;
    thumbnailBlob?: Blob;
  }
): Promise<{ blob: Blob; filename: string }> {
  const zip = new JSZip();
  zip.file('project.json', JSON.stringify(project, null, 2));
  zip.file('subtitles.srt', generateSrtFromProject(project));

  const ytFiles = buildYouTubeDeliveryFiles(project);
  for (const [name, content] of Object.entries(ytFiles)) {
    zip.file(`youtube/${name}`, content);
  }

  if (options.thumbnailBlob) {
    zip.file('thumbnail.png', options.thumbnailBlob);
  }

  if (options.videoBlob) {
    zip.file(options.videoFilename || 'episode.mp4', options.videoBlob);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const slug = project.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return {
    blob,
    filename: `${slug || 'cricket-episode'}-delivery.zip`,
  };
}

export async function parseProjectPackageZip(
  buffer: ArrayBuffer | Uint8Array
): Promise<
  | { ok: true; project: CricketProject; manifest: ProjectPackageManifest | null }
  | { ok: false; error: string }
> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const projectFile = zip.file('project.json');
    if (!projectFile) {
      return { ok: false, error: 'ZIP package is missing required project.json file.' };
    }
    const projectJsonText = await projectFile.async('string');
    const parsed = JSON.parse(projectJsonText) as Partial<CricketProject>;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.title !== 'string') {
      return { ok: false, error: 'project.json inside ZIP package is invalid.' };
    }

    let manifest: ProjectPackageManifest | null = null;
    const manifestFile = zip.file('manifest.json');
    if (manifestFile) {
      try {
        manifest = JSON.parse(await manifestFile.async('string')) as ProjectPackageManifest;
      } catch {
        manifest = null;
      }
    }

    const migrated = migrateProjectToPhase2(parsed);

    // Restore packaged binary assets & audio into AssetBlobStore (IndexedDB/memory)
    const restoredAssets = await Promise.all(
      (migrated.assets ?? []).map(async (asset) => {
        const entry = zip.file(`assets/${asset.id}_${asset.name}`);
        const blobKey = asset.assetId || `blob-${asset.id}`;
        if (entry) {
          const bytes = await entry.async('uint8array');
          const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
          const blob = new Blob([buf], { type: asset.mimeType || 'application/octet-stream' });
          await AssetBlobStore.putAsset(blobKey, blob, {
            name: asset.name,
            mimeType: asset.mimeType,
          });
          return { ...asset, assetId: blobKey };
        }
        return asset;
      })
    );

    const restoredAudio = await Promise.all(
      (migrated.audioAssets ?? []).map(async (aud) => {
        const entry = zip.file(`audio/${aud.id}_${aud.name}`);
        const blobKey = aud.assetId || `blob-${aud.id}`;
        if (entry) {
          const bytes = await entry.async('uint8array');
          const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
          const blob = new Blob([buf], { type: 'audio/mpeg' });
          await AssetBlobStore.putAsset(blobKey, blob, {
            name: aud.name,
            mimeType: 'audio/mpeg',
          });
          return { ...aud, assetId: blobKey };
        }
        return aud;
      })
    );

    return {
      ok: true,
      project: {
        ...migrated,
        assets: restoredAssets,
        audioAssets: restoredAudio,
      },
      manifest,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unable to read ZIP project package.',
    };
  }
}

export function hasProjectIdConflict(
  importedProjectId: string,
  existingProjects: CricketProject[]
): boolean {
  return existingProjects.some((p) => p.id === importedProjectId);
}
