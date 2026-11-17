import React, { useState } from 'react';
import {
  Archive,
  Check,
  Copy,
  Download,
  FolderArchive,
  History,
  Image as ImageIcon,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Youtube,
} from 'lucide-react';
import { useStudio } from '../../context/StudioContext';
import type { AssetCategory, CricketProject, StudioAsset } from '../../types/studio';
import { AssetBlobStore } from '../../engine/assetBlobStore';
import { generateYouTubeChaptersFromTimeline } from '../../engine/timeline';
import {
  ProjectPackageManifest,
  buildProjectPackageZip,
  hasProjectIdConflict,
  parseProjectPackageZip,
} from '../../engine/packaging';

const ASSET_CATEGORIES: { id: AssetCategory; label: string }[] = [
  { id: 'logos', label: 'Logos' },
  { id: 'player-images', label: 'Player Images' },
  { id: 'team-logos', label: 'Team Logos' },
  { id: 'backgrounds', label: 'Backgrounds' },
  { id: 'audio', label: 'Audio' },
  { id: 'music', label: 'Music' },
  { id: 'sfx', label: 'SFX' },
  { id: 'cricket-graphics', label: 'Cricket Graphics' },
  { id: 'custom-media', label: 'Custom Media' },
];

export function PublishAndAssetsModule() {
  const {
    workspace,
    activeProject,
    updateActiveProject,
    createSnapshot,
    restoreSnapshot,
    duplicateSnapshot,
    deleteSnapshot,
    importProject,
  } = useStudio();

  const [subTab, setSubTab] = useState<'youtube' | 'assets' | 'snapshots' | 'package'>(
    'youtube'
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Assets state
  const [uploadCat, setUploadCat] = useState<AssetCategory>('logos');
  const [assetFilterCat, setAssetFilterCat] = useState<'all' | AssetCategory>('all');
  const [assetSearch, setAssetSearch] = useState('');
  const [assetError, setAssetError] = useState<string | null>(null);

  // Snapshots state
  const [snapshotName, setSnapshotName] = useState('');

  // ZIP package state
  const [packageStatus, setPackageStatus] = useState<string | null>(null);
  const [pendingZipImport, setPendingZipImport] = useState<{
    project: CricketProject;
    manifest: ProjectPackageManifest | null;
    conflict: boolean;
  } | null>(null);

  const yt = activeProject.youtubeMetadata;

  const copyText = (key: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(null), 1600);
  };

  const handleUploadAsset = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const fingerprint = `${file.name}:${file.size}:${file.lastModified}`;
    if (activeProject.assets.some((a) => a.fingerprint === fingerprint)) {
      setAssetError(`"${file.name}" is already in the Asset Library.`);
      return;
    }
    setAssetError(null);
    const id = `ast-${Date.now().toString(36)}`;
    const blobKey = `blob-${id}`;
    await AssetBlobStore.putAsset(blobKey, file, {
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
    });

    let inlinePreviewUrl: string | undefined;
    if (file.type.startsWith('image/') && file.size < 65_536) {
      inlinePreviewUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      });
    }

    const newAsset: StudioAsset = {
      id,
      assetId: blobKey,
      name: file.name,
      category: uploadCat,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      dataUrl: inlinePreviewUrl || undefined,
      createdAt: new Date().toISOString(),
      fingerprint,
    };
    updateActiveProject((prev) => ({
      ...prev,
      assets: [newAsset, ...prev.assets],
    }));
  };

  const handleExportZip = async () => {
    const { blob, filename, manifest } = await buildProjectPackageZip(activeProject);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    setPackageStatus(
      `Exported ${filename} (${manifest.counts.timelineClips} clips, ${manifest.counts.quizQuestions} quiz slots).`
    );
  };

  const handleImportZipFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    const res = await parseProjectPackageZip(buf);
    e.target.value = '';
    if (res.ok === false) {
      setPackageStatus(`Import failed: ${res.error}`);
      return;
    }
    const conflict = hasProjectIdConflict(res.project.id, workspace.projects);
    if (conflict) {
      setPendingZipImport({
        project: res.project,
        manifest: res.manifest,
        conflict: true,
      });
    } else {
      importProject(res.project, false);
      setPackageStatus(`Imported ZIP package "${res.project.title}".`);
    }
  };

  const filteredAssets = activeProject.assets.filter((a) => {
    const catOk = assetFilterCat === 'all' || a.category === assetFilterCat;
    const qOk =
      !assetSearch.trim() ||
      a.name.toLowerCase().includes(assetSearch.toLowerCase());
    return catOk && qOk;
  });

  return (
    <div className="h-full flex flex-col bg-[#080E1A] overflow-hidden">
      {/* Sub-navigation */}
      <div className="px-6 py-3 border-b border-slate-800/80 bg-[#0C1426] flex items-center justify-between gap-4">
        <div className="flex flex-wrap items-center bg-[#080E1A] p-0.5 rounded-md border border-slate-800">
          <button
            type="button"
            onClick={() => setSubTab('youtube')}
            className={`px-3.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 ${
              subTab === 'youtube' ? 'bg-[#172442] text-[#F4D57A]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Youtube className="w-3.5 h-3.5" />
            <span>YouTube Package</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('assets')}
            className={`px-3.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 ${
              subTab === 'assets' ? 'bg-[#172442] text-[#F4D57A]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Asset Library ({activeProject.assets.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('snapshots')}
            className={`px-3.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 ${
              subTab === 'snapshots' ? 'bg-[#172442] text-[#F4D57A]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Version Snapshots ({activeProject.snapshots.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('package')}
            className={`px-3.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 ${
              subTab === 'package' ? 'bg-[#172442] text-[#F4D57A]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>ZIP Package</span>
          </button>
        </div>
      </div>

      {/* YOUTUBE METADATA PACKAGE */}
      {subTab === 'youtube' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto bg-[#0F182D] border border-slate-800/80 rounded-xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-display font-semibold text-slate-100">
                  YouTube Episode Package
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Copy-ready title, description, tags, hashtags, pinned comment, and auto-generated timeline chapters.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const full = `${yt.videoTitle}\n\n${yt.description}\n\nChapters:\n${yt.chapterMarkersText}\n\n${yt.hashtags.join(' ')}\n\nPinned Comment: ${yt.pinnedComment}`;
                  copyText('full', full);
                }}
                className="px-3 py-1.5 rounded-md bg-[#D4AF37] text-[#080E1A] text-xs font-bold flex items-center gap-1.5"
              >
                {copiedKey === 'full' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'full' ? 'Copied Package' : 'Copy Full Package'}</span>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-300">Video Title</label>
                  <button
                    type="button"
                    onClick={() => copyText('title', yt.videoTitle)}
                    className="text-[11px] text-[#E5B94C] hover:underline"
                  >
                    {copiedKey === 'title' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <input
                  type="text"
                  value={yt.videoTitle}
                  onChange={(e) =>
                    updateActiveProject((prev) => ({
                      ...prev,
                      youtubeMetadata: { ...prev.youtubeMetadata, videoTitle: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#080E1A] border border-slate-800 text-xs text-slate-100"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-300">Description</label>
                  <button
                    type="button"
                    onClick={() => copyText('desc', yt.description)}
                    className="text-[11px] text-[#E5B94C] hover:underline"
                  >
                    {copiedKey === 'desc' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={yt.description}
                  onChange={(e) =>
                    updateActiveProject((prev) => ({
                      ...prev,
                      youtubeMetadata: { ...prev.youtubeMetadata, description: e.target.value },
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#080E1A] border border-slate-800 text-xs text-slate-100"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-300">
                    Timeline Chapter Markers
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const chapters = generateYouTubeChaptersFromTimeline(
                          activeProject.timelineClips
                        );
                        updateActiveProject((prev) => ({
                          ...prev,
                          youtubeMetadata: {
                            ...prev.youtubeMetadata,
                            chapterMarkersText: chapters,
                          },
                        }));
                      }}
                      className="text-[11px] text-[#F4D57A] flex items-center gap-1 hover:underline"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Generate from Timeline</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => copyText('chapters', yt.chapterMarkersText)}
                      className="text-[11px] text-[#E5B94C] hover:underline"
                    >
                      {copiedKey === 'chapters' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
                <textarea
                  rows={4}
                  value={yt.chapterMarkersText}
                  onChange={(e) =>
                    updateActiveProject((prev) => ({
                      ...prev,
                      youtubeMetadata: {
                        ...prev.youtubeMetadata,
                        chapterMarkersText: e.target.value,
                      },
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#080E1A] border border-slate-800 text-xs font-mono-tabular text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    value={yt.tags.join(', ')}
                    onChange={(e) =>
                      updateActiveProject((prev) => ({
                        ...prev,
                        youtubeMetadata: {
                          ...prev.youtubeMetadata,
                          tags: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#080E1A] border border-slate-800 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Hashtags (space separated)
                  </label>
                  <input
                    type="text"
                    value={yt.hashtags.join(' ')}
                    onChange={(e) =>
                      updateActiveProject((prev) => ({
                        ...prev,
                        youtubeMetadata: {
                          ...prev.youtubeMetadata,
                          hashtags: e.target.value.split(/\s+/).filter(Boolean),
                        },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#080E1A] border border-slate-800 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Pinned Comment
                  </label>
                  <input
                    type="text"
                    value={yt.pinnedComment}
                    onChange={(e) =>
                      updateActiveProject((prev) => ({
                        ...prev,
                        youtubeMetadata: { ...prev.youtubeMetadata, pinnedComment: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#080E1A] border border-slate-800 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Thumbnail Hook Text
                  </label>
                  <input
                    type="text"
                    value={yt.thumbnailText}
                    onChange={(e) =>
                      updateActiveProject((prev) => ({
                        ...prev,
                        youtubeMetadata: { ...prev.youtubeMetadata, thumbnailText: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#080E1A] border border-slate-800 text-xs text-slate-100"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ASSET LIBRARY */}
      {subTab === 'assets' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto space-y-5">
            <div className="bg-[#0F182D] border border-slate-800/80 rounded-xl p-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={uploadCat}
                  onChange={(e) => setUploadCat(e.target.value as AssetCategory)}
                  className="px-3 py-2 rounded-lg bg-[#080E1A] border border-slate-800 text-xs text-slate-100"
                >
                  {ASSET_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>

                <label className="px-3.5 py-2 rounded-lg bg-[#D4AF37] hover:bg-[#E2BE48] text-[#080E1A] text-xs font-bold cursor-pointer flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Asset</span>
                  <input
                    type="file"
                    accept="image/*,audio/*"
                    onChange={handleUploadAsset}
                    className="sr-only"
                  />
                </label>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={assetSearch}
                    onChange={(e) => setAssetSearch(e.target.value)}
                    placeholder="Search assets..."
                    className="pl-8 pr-3 py-1.5 rounded-lg bg-[#080E1A] border border-slate-800 text-xs text-slate-100"
                  />
                </div>
                <select
                  value={assetFilterCat}
                  onChange={(e) =>
                    setAssetFilterCat(e.target.value as 'all' | AssetCategory)
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-[#080E1A] border border-slate-800 text-xs text-slate-200"
                >
                  <option value="all">All Categories</option>
                  {ASSET_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {assetError && (
              <div className="p-3 rounded-lg bg-amber-950/60 border border-amber-500/40 text-xs text-amber-200">
                {assetError}
              </div>
            )}

            {filteredAssets.length === 0 ? (
              <div className="bg-[#0F182D] border border-slate-800/80 rounded-xl p-10 text-center text-xs text-slate-400">
                No assets match your filter. Upload logos, player cutouts, backgrounds, or audio cues.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="bg-[#0F182D] border border-slate-800/80 rounded-xl p-4 space-y-3"
                  >
                    {asset.mimeType.startsWith('image/') && asset.dataUrl && (
                      <div className="h-28 rounded-lg bg-[#080E1A] border border-slate-800 flex items-center justify-center overflow-hidden p-2">
                        <img
                          src={asset.dataUrl}
                          alt={asset.name}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    )}
                    {asset.mimeType.startsWith('audio/') && asset.dataUrl && (
                      <audio controls src={asset.dataUrl} className="w-full h-8" />
                    )}

                    <input
                      type="text"
                      value={asset.name}
                      onChange={(e) =>
                        updateActiveProject((prev) => ({
                          ...prev,
                          assets: prev.assets.map((a) =>
                            a.id === asset.id ? { ...a, name: e.target.value } : a
                          ),
                        }))
                      }
                      className="w-full px-2.5 py-1 rounded bg-[#080E1A] border border-slate-800 text-xs font-medium text-slate-100"
                    />

                    <div className="flex items-center justify-between text-[11px] font-mono-tabular text-slate-400">
                      <span>{asset.category} · {asset.assetId ? 'IndexedDB' : 'Inline'}</span>
                      <span>{Math.max(1, Math.round(asset.sizeBytes / 1024))} KB</span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      {asset.mimeType.startsWith('image/') && (
                        <button
                          type="button"
                          onClick={() =>
                            updateActiveProject((prev) => ({
                              ...prev,
                              brandKit: { ...prev.brandKit, logoAssetId: asset.id },
                            }))
                          }
                          className="text-[11px] text-[#E5B94C] hover:underline"
                        >
                          Use as Brand Logo
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          void AssetBlobStore.deleteAsset(asset.assetId || asset.id);
                          updateActiveProject((prev) => ({
                            ...prev,
                            assets: prev.assets.filter((a) => a.id !== asset.id),
                          }));
                        }}
                        aria-label={`Delete ${asset.name}`}
                        className="ml-auto p-1 text-slate-400 hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VERSION SNAPSHOTS */}
      {subTab === 'snapshots' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-5">
            <div className="bg-[#0F182D] border border-slate-800/80 rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-display font-semibold text-slate-100">
                Create Project Snapshot
              </h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={snapshotName}
                  onChange={(e) => setSnapshotName(e.target.value)}
                  placeholder="e.g. Before Final Timeline Polish"
                  className="flex-1 px-3 py-2 rounded-lg bg-[#080E1A] border border-slate-800 text-xs text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => {
                    createSnapshot(
                      snapshotName.trim() ||
                        `Checkpoint ${activeProject.snapshots.length + 1}`
                    );
                    setSnapshotName('');
                  }}
                  className="px-4 py-2 rounded-lg bg-[#D4AF37] hover:bg-[#E2BE48] text-[#080E1A] text-xs font-bold"
                >
                  Save Snapshot
                </button>
              </div>
            </div>

            <div className="bg-[#0F182D] border border-slate-800/80 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-display font-semibold text-slate-100">
                Saved Snapshots ({activeProject.snapshots.length})
              </h3>
              {activeProject.snapshots.length === 0 ? (
                <div className="text-xs text-slate-400 py-6 text-center">
                  No snapshots created yet. Save a checkpoint before making major timeline changes.
                </div>
              ) : (
                <div className="space-y-2">
                  {activeProject.snapshots.map((snap) => (
                    <div
                      key={snap.id}
                      className="p-3.5 rounded-lg bg-[#080E1A] border border-slate-800 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-xs font-semibold text-slate-100">{snap.name}</div>
                        <div className="text-[11px] font-mono-tabular text-slate-400">
                          {new Date(snap.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => restoreSnapshot(snap.id)}
                          className="px-2.5 py-1 rounded bg-[#172442] hover:bg-[#1E2E54] text-[#F4D57A] text-xs font-semibold flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restore</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicateSnapshot(snap.id)}
                          className="p-1.5 rounded bg-[#131E38] text-slate-300"
                          title="Duplicate snapshot"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSnapshot(snap.id)}
                          className="p-1.5 rounded bg-[#131E38] text-slate-400 hover:text-red-400"
                          title="Delete snapshot"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PROJECT ZIP PACKAGE */}
      {subTab === 'package' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-5">
            <div className="bg-[#0F182D] border border-slate-800/80 rounded-xl p-6 space-y-4">
              <div className="flex items-start gap-3">
                <FolderArchive className="w-6 h-6 text-[#D4AF37] shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-base font-display font-semibold text-slate-100">
                    Renderer-Ready Project Package (.zip)
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Bundles <code className="text-[#E5B94C]">project.json</code>,{' '}
                    <code className="text-[#E5B94C]">manifest.json</code>,{' '}
                    <code className="text-[#E5B94C]">branding.json</code>,{' '}
                    <code className="text-[#E5B94C]">timeline.json</code>,{' '}
                    <code className="text-[#E5B94C]">quiz.json</code>,{' '}
                    <code className="text-[#E5B94C]">field-scenes.json</code>, and{' '}
                    <code className="text-[#E5B94C]">audio-metadata.json</code> for Phase 3 MP4 rendering or studio backup.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleExportZip}
                  className="px-4 py-2 rounded-lg bg-[#D4AF37] hover:bg-[#E2BE48] text-[#080E1A] text-xs font-bold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Project Package (.zip)</span>
                </button>

                <label className="px-4 py-2 rounded-lg bg-[#131E38] hover:bg-[#1B2B4F] border border-slate-700/80 text-xs font-semibold text-slate-100 cursor-pointer flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Import Project Package (.zip)</span>
                  <input
                    type="file"
                    accept=".zip,application/zip"
                    onChange={handleImportZipFile}
                    className="sr-only"
                  />
                </label>
              </div>

              {packageStatus && (
                <div className="p-3 rounded-lg bg-[#080E1A] border border-slate-800 text-xs text-emerald-300">
                  {packageStatus}
                </div>
              )}

              {pendingZipImport && (
                <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 space-y-3">
                  <div className="text-xs font-semibold text-amber-200">
                    Project ID Conflict Detected: &ldquo;{pendingZipImport.project.title}&rdquo; matches an existing studio project.
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        importProject(pendingZipImport.project, false);
                        setPackageStatus(
                          `Imported "${pendingZipImport.project.title}" as a safe new copy.`
                        );
                        setPendingZipImport(null);
                      }}
                      className="px-3 py-1.5 rounded bg-[#D4AF37] text-[#080E1A] text-xs font-bold"
                    >
                      Import as New Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        importProject(pendingZipImport.project, true);
                        setPackageStatus(
                          `Replaced existing project "${pendingZipImport.project.title}".`
                        );
                        setPendingZipImport(null);
                      }}
                      className="px-3 py-1.5 rounded bg-red-600 text-white text-xs font-semibold"
                    >
                      Overwrite Existing
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingZipImport(null)}
                      className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
