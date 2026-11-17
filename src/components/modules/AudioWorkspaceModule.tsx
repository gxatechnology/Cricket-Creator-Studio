import React, { useState } from 'react';
import {
  Captions,
  Download,
  Mic,
  Music,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { useStudio } from '../../context/StudioContext';
import type {
  AudioAsset,
  AudioCategory,
  CaptionSettings,
  CaptionStyle,
  TimelineClip,
  VoiceoverSegment,
} from '../../types/studio';
import {
  buildAutoEpisodeTimeline,
  estimateNarrationDurationSec,
} from '../../engine/autoEpisode';
import { AssetBlobStore } from '../../engine/assetBlobStore';
import { generateSrtFromProject } from '../../engine/captions';
import { sortClips } from '../../engine/timeline';
import { TTS_PROVIDERS } from '../../render/ttsProvider';

const AUDIO_CATEGORIES: { id: AudioCategory; label: string }[] = [
  { id: 'voiceover', label: 'Voiceover' },
  { id: 'music', label: 'Background Music' },
  { id: 'crowd', label: 'Stadium Crowd' },
  { id: 'bat-hit', label: 'Bat Hit' },
  { id: 'ball-hit', label: 'Ball / Stump Hit' },
  { id: 'wicket', label: 'Wicket' },
  { id: 'appeal', label: 'Appeal' },
  { id: 'cheer', label: 'Boundary Cheer' },
  { id: 'countdown-tick', label: 'Quiz Countdown Tick' },
  { id: 'answer-correct', label: 'Answer Reveal Correct' },
  { id: 'answer-wrong', label: 'Answer Reveal Wrong' },
  { id: 'whoosh', label: 'Whoosh' },
  { id: 'transition', label: 'Transition Sting' },
  { id: 'custom', label: 'Custom Audio' },
];

export function AudioWorkspaceModule() {
  const { activeProject, updateActiveProject } = useStudio();
  const [subTab, setSubTab] = useState<'mixer' | 'autosfx' | 'voiceover'>('mixer');
  const [uploadCategory, setUploadCategory] = useState<AudioCategory>('music');
  const [filterCat, setFilterCat] = useState<'all' | AudioCategory>('all');
  const [ttsProviderId, setTtsProviderId] = useState<string>('manual');
  const [ttsLang, setTtsLang] = useState('en-US');
  const [ttsRate, setTtsRate] = useState(1);
  const [ttsStatusNote, setTtsStatusNote] = useState<string | null>(null);

  const audioClips = activeProject.timelineClips.filter(
    (c) => c.trackId === 'voiceover' || c.trackId === 'music' || c.trackId === 'sfx'
  );

  const mix = activeProject.audioMix;
  const autoSfx = activeProject.autoSfx;
  const voSegments = activeProject.voiceoverSegments;
  const captionSettings: CaptionSettings = activeProject.captionSettings ?? {
    enabled: true,
    style: 'broadcast',
    fontSize: 28,
    showBackground: true,
    textOutline: true,
  };

  const updateCaptions = (patch: Partial<CaptionSettings>) => {
    updateActiveProject((prev) => ({
      ...prev,
      captionSettings: {
        ...(prev.captionSettings ?? captionSettings),
        ...patch,
      },
    }));
  };

  const handleExportSrt = () => {
    const srt = generateSrtFromProject(activeProject);
    const blob = new Blob([srt], { type: 'application/x-subrip;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const slug =
      activeProject.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'cricket-episode';
    link.download = `${slug}-subtitles.srt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const readAudioDurationSec = (blob: Blob): Promise<number> =>
    new Promise((resolve) => {
      const objUrl = URL.createObjectURL(blob);
      const audioEl = new Audio(objUrl);
      const finish = (dur: number) => {
        URL.revokeObjectURL(objUrl);
        resolve(Number.isFinite(dur) && dur > 0 ? dur : 4);
      };
      audioEl.addEventListener('loadedmetadata', () => finish(audioEl.duration));
      audioEl.addEventListener('error', () => finish(4));
    });

  const handleUploadAudio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const id = `aud-${Date.now().toString(36)}`;
    const blobKey = `blob-${id}`;
    await AssetBlobStore.putAsset(blobKey, file, {
      name: file.name,
      mimeType: file.type || 'audio/mpeg',
    });
    const durationSec = await readAudioDurationSec(file);
    const asset: AudioAsset = {
      id,
      assetId: blobKey,
      name: file.name,
      category: uploadCategory,
      durationSec: Math.max(0.5, Math.round(durationSec * 10) / 10),
      sizeBytes: file.size,
      createdAt: new Date().toISOString(),
    };
    updateActiveProject((prev) => ({
      ...prev,
      audioAssets: [asset, ...prev.audioAssets],
    }));
  };

  const handleAddAudioAssetToTimeline = (asset: AudioAsset) => {
    const trackId =
      asset.category === 'voiceover'
        ? 'voiceover'
        : asset.category === 'music' || asset.category === 'crowd'
        ? 'music'
        : 'sfx';
    const clip: TimelineClip = {
      id: `clip-aud-${Date.now().toString(36)}`,
      trackId,
      name: asset.name,
      startSec: 0,
      durationSec: asset.durationSec,
      type: trackId,
      status: 'ready',
      audioAssetId: asset.id,
      audioCategory: asset.category,
      volume: trackId === 'music' ? 0.45 : 1,
      fadeInSec: trackId === 'music' ? 1 : 0,
      fadeOutSec: trackId === 'music' ? 1.5 : 0,
      loop: trackId === 'music',
    };
    updateActiveProject((prev) => ({
      ...prev,
      timelineClips: sortClips([...prev.timelineClips, clip]),
    }));
  };

  const handleUpdateAudioClip = (clipId: string, patch: Partial<TimelineClip>) => {
    updateActiveProject((prev) => ({
      ...prev,
      timelineClips: sortClips(
        prev.timelineClips.map((c) => (c.id === clipId ? { ...c, ...patch } : c))
      ),
    }));
  };

  const handleUpdateVoSegment = (id: string, patch: Partial<VoiceoverSegment>) => {
    updateActiveProject((prev) => ({
      ...prev,
      voiceoverSegments: prev.voiceoverSegments.map((seg) => {
        if (seg.id !== id) return seg;
        const nextText = patch.text ?? seg.text;
        const hasAudio = Boolean(patch.audioAssetId ?? seg.audioAssetId);
        const nextStatus =
          patch.status ??
          (hasAudio ? 'audio-attached' : nextText.trim() ? 'script-ready' : 'not-created');
        return {
          ...seg,
          ...patch,
          status: nextStatus,
          estimatedDurationSec: estimateNarrationDurationSec(nextText),
        };
      }),
    }));
  };

  const handleUploadVoForSegment = async (
    segId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const audId = `aud-vo-${Date.now().toString(36)}`;
    const blobKey = `blob-${audId}`;
    await AssetBlobStore.putAsset(blobKey, file, {
      name: file.name,
      mimeType: file.type || 'audio/mpeg',
    });
    const dur = await readAudioDurationSec(file);
    const asset: AudioAsset = {
      id: audId,
      assetId: blobKey,
      name: file.name,
      category: 'voiceover',
      durationSec: Math.max(0.5, Math.round(dur * 10) / 10),
      sizeBytes: file.size,
      createdAt: new Date().toISOString(),
    };
    updateActiveProject((prev) => ({
      ...prev,
      audioAssets: [asset, ...prev.audioAssets],
      voiceoverSegments: prev.voiceoverSegments.map((s) =>
        s.id === segId
          ? { ...s, audioAssetId: audId, status: 'audio-attached' }
          : s
      ),
    }));
  };

  const handleApplyAutoSfx = () => {
    const built = buildAutoEpisodeTimeline(
      activeProject,
      activeProject.autoEpisodeTiming,
      autoSfx
    );
    updateActiveProject((prev) => ({
      ...prev,
      timelineClips: built.clips,
      voiceoverSegments:
        prev.voiceoverSegments.length > 0
          ? prev.voiceoverSegments
          : built.voiceoverSegments,
    }));
  };

  const filteredLibrary = activeProject.audioAssets.filter((a) =>
    filterCat === 'all' ? true : a.category === filterCat
  );

  return (
    <div className="h-full flex flex-col bg-[#080E1A] overflow-hidden">
      {/* Sub-navigation */}
      <div className="px-6 py-3 border-b border-slate-800/80 bg-[#0C1426] flex items-center justify-between gap-4">
        <div className="flex items-center bg-[#080E1A] p-0.5 rounded-md border border-slate-800">
          <button
            type="button"
            onClick={() => setSubTab('mixer')}
            className={`px-3.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 ${
              subTab === 'mixer' ? 'bg-[#172442] text-[#F4D57A]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>Audio Library &amp; Mixer</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('autosfx')}
            className={`px-3.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 ${
              subTab === 'autosfx' ? 'bg-[#172442] text-[#F4D57A]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Auto SFX Automation</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('voiceover')}
            className={`px-3.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 ${
              subTab === 'voiceover' ? 'bg-[#172442] text-[#F4D57A]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Voiceover Prep ({voSegments.length})</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() =>
            updateActiveProject((prev) => ({
              ...prev,
              audioMix: { ...prev.audioMix, masterMuted: !prev.audioMix.masterMuted },
            }))
          }
          className={`px-3 py-1.5 rounded-md text-xs font-semibold border flex items-center gap-1.5 ${
            mix.masterMuted
              ? 'bg-red-950/60 border-red-500/40 text-red-200'
              : 'bg-[#131E38] border-slate-700 text-slate-200'
          }`}
        >
          {mix.masterMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          <span>{mix.masterMuted ? 'Master Muted' : 'Master Active'}</span>
        </button>
      </div>

      {/* AUDIO LIBRARY & MIXER */}
      {subTab === 'mixer' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-[1320px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Upload & Audio Asset Library */}
            <section className="lg:col-span-5 bg-[#0F182D] border border-slate-800/80 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-sm font-display font-semibold text-slate-100">
                  Audio Library (14 Categories)
                </h2>
                <span className="text-xs font-mono-tabular text-slate-400">
                  {activeProject.audioAssets.length} files
                </span>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value as AudioCategory)}
                  className="flex-1 px-2.5 py-2 rounded-lg bg-[#080E1A] border border-slate-800 text-xs text-slate-100"
                >
                  {AUDIO_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <label className="px-3 py-2 rounded-lg bg-[#D4AF37] hover:bg-[#E2BE48] text-[#080E1A] text-xs font-bold cursor-pointer flex items-center gap-1.5 shrink-0">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Audio</span>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleUploadAudio}
                    className="sr-only"
                  />
                </label>
              </div>

              <div>
                <select
                  value={filterCat}
                  onChange={(e) => setFilterCat(e.target.value as 'all' | AudioCategory)}
                  className="w-full px-2.5 py-1.5 rounded bg-[#080E1A] border border-slate-800 text-xs text-slate-300"
                >
                  <option value="all">Filter: All Categories</option>
                  {AUDIO_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 max-h-[380px] overflow-y-auto">
                {filteredLibrary.length === 0 ? (
                  <div className="text-xs text-slate-400 py-8 text-center">
                    No audio assets uploaded in this category yet. Upload MP3/WAV cues or use Auto SFX.
                  </div>
                ) : (
                  filteredLibrary.map((asset) => (
                    <div
                      key={asset.id}
                      className="p-3 rounded-lg bg-[#080E1A] border border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-100 truncate">
                            {asset.name}
                          </div>
                          <div className="text-[11px] font-mono-tabular text-slate-400">
                            {asset.category} · {asset.durationSec}s ·{' '}
                            {Math.round(asset.sizeBytes / 1024)} KB
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleAddAudioAssetToTimeline(asset)}
                            className="px-2 py-1 rounded bg-[#172442] text-[#F4D57A] text-[11px] font-semibold flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Timeline</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void AssetBlobStore.deleteAsset(asset.assetId || asset.id);
                              updateActiveProject((prev) => ({
                                ...prev,
                                audioAssets: prev.audioAssets.filter((a) => a.id !== asset.id),
                              }));
                            }}
                            aria-label={`Delete ${asset.name}`}
                            className="p-1 rounded text-slate-400 hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {asset.dataUrl ? (
                        <audio controls src={asset.dataUrl} className="w-full h-8" />
                      ) : (
                        <div className="text-[10px] font-mono-tabular text-emerald-400/90">
                          Ready in IndexedDB Audio Store
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Right: Master Bus & Clip Mix Controls */}
            <section className="lg:col-span-7 space-y-5">
              <div className="bg-[#0F182D] border border-slate-800/80 rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-display font-semibold text-slate-100">
                  Master Audio Bus Levels
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {(
                    [
                      { key: 'voiceVolume', label: 'Voiceover Bus' },
                      { key: 'musicVolume', label: 'Music Bus' },
                      { key: 'sfxVolume', label: 'SFX Bus' },
                    ] as const
                  ).map((bus) => {
                    const val = mix[bus.key];
                    return (
                      <div
                        key={bus.key}
                        className="p-3 rounded-lg bg-[#080E1A] border border-slate-800 space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-300 font-medium">{bus.label}</span>
                          <span
                            className={`font-mono-tabular font-bold ${
                              val > 1.05 ? 'text-amber-400' : 'text-[#E5B94C]'
                            }`}
                          >
                            {Math.round(val * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={1.2}
                          step={0.05}
                          value={val}
                          onChange={(e) =>
                            updateActiveProject((prev) => ({
                              ...prev,
                              audioMix: {
                                ...prev.audioMix,
                                [bus.key]: Number(e.target.value),
                              },
                            }))
                          }
                          className="w-full accent-[#D4AF37]"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-[#0F182D] border border-slate-800/80 rounded-xl p-5 space-y-3">
                <h2 className="text-sm font-display font-semibold text-slate-100">
                  Timeline Audio Clips ({audioClips.length})
                </h2>
                <div className="space-y-2.5 max-h-[340px] overflow-y-auto">
                  {audioClips.length === 0 ? (
                    <div className="text-xs text-slate-400 py-6 text-center">
                      No audio clips on timeline yet. Run Auto Build Episode or add from library.
                    </div>
                  ) : (
                    audioClips.map((clip) => (
                      <div
                        key={clip.id}
                        className="p-3 rounded-lg bg-[#080E1A] border border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center text-xs"
                      >
                        <div className="sm:col-span-4 min-w-0">
                          <div className="font-semibold text-slate-100 truncate">{clip.name}</div>
                          <div className="text-[11px] font-mono-tabular text-slate-400">
                            {clip.trackId.toUpperCase()} · {clip.startSec}s ({clip.durationSec}s)
                          </div>
                        </div>

                        <div className="sm:col-span-3 flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400">Vol</span>
                          <input
                            type="range"
                            min={0}
                            max={1.2}
                            step={0.05}
                            value={clip.volume ?? 1}
                            onChange={(e) =>
                              handleUpdateAudioClip(clip.id, { volume: Number(e.target.value) })
                            }
                            className="w-full accent-[#D4AF37]"
                          />
                        </div>

                        <div className="sm:col-span-2 flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400 shrink-0">Fade</span>
                          <input
                            type="number"
                            min={0}
                            max={5}
                            step={0.2}
                            value={clip.fadeInSec ?? 0}
                            onChange={(e) =>
                              handleUpdateAudioClip(clip.id, {
                                fadeInSec: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                            title="Fade in (s)"
                            aria-label="Fade in seconds"
                            className="w-full px-2 py-1 rounded bg-[#0F182D] border border-slate-800 text-[11px] font-mono-tabular text-slate-100"
                          />
                        </div>

                        <div className="sm:col-span-3 flex items-center justify-end gap-2">
                          <label className="flex items-center gap-1 text-[11px] text-slate-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(clip.loop)}
                              onChange={(e) =>
                                handleUpdateAudioClip(clip.id, { loop: e.target.checked })
                              }
                              className="accent-[#D4AF37]"
                            />
                            <span>Loop</span>
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateAudioClip(clip.id, { muted: !clip.muted })
                            }
                            className={`px-2 py-1 rounded text-[11px] ${
                              clip.muted
                                ? 'bg-red-950 text-red-300'
                                : 'bg-[#131E38] text-slate-300'
                            }`}
                          >
                            {clip.muted ? 'Muted' : 'On'}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* AUTO SFX AUTOMATION */}
      {subTab === 'autosfx' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto bg-[#0F182D] border border-slate-800/80 rounded-xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-base font-display font-semibold text-slate-100">
                  Sound Effect Automation
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Automatically places deterministic countdown ticks, answer reveals, bat hits, cheers, and transitions on the SFX track.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  updateActiveProject((prev) => ({
                    ...prev,
                    autoSfx: { ...prev.autoSfx, enabled: !prev.autoSfx.enabled },
                  }))
                }
                aria-pressed={autoSfx.enabled}
                className={`px-4 py-1.5 rounded-md text-xs font-bold ${
                  autoSfx.enabled
                    ? 'bg-[#D4AF37] text-[#080E1A]'
                    : 'bg-[#080E1A] border border-slate-700 text-slate-400'
                }`}
              >
                {autoSfx.enabled ? 'Auto SFX ON' : 'Auto SFX OFF'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(
                [
                  { key: 'countdownTick', label: 'Countdown Tick on Quiz Timer' },
                  { key: 'correctSting', label: 'Answer Reveal Correct Sting' },
                  { key: 'wrongSting', label: 'Wrong Option Tone' },
                  { key: 'boundaryCheer', label: 'Boundary Six/Four Crowd Cheer' },
                  { key: 'wicketSting', label: 'Wicket Dismissal Impact' },
                  { key: 'batImpact', label: 'Bat-on-Ball Impact Sync' },
                  { key: 'sceneWhoosh', label: 'Scene Transition Whoosh' },
                ] as const
              ).map((item) => (
                <label
                  key={item.key}
                  className="p-3.5 rounded-lg bg-[#080E1A] border border-slate-800 flex items-center justify-between gap-3 cursor-pointer"
                >
                  <span className="text-xs font-medium text-slate-200">{item.label}</span>
                  <input
                    type="checkbox"
                    checked={autoSfx[item.key]}
                    disabled={!autoSfx.enabled}
                    onChange={(e) =>
                      updateActiveProject((prev) => ({
                        ...prev,
                        autoSfx: { ...prev.autoSfx, [item.key]: e.target.checked },
                      }))
                    }
                    className="accent-[#D4AF37]"
                  />
                </label>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleApplyAutoSfx}
                className="px-4 py-2 rounded-lg bg-[#D4AF37] hover:bg-[#E2BE48] text-[#080E1A] text-xs font-bold flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Sync Auto SFX to Episode Timeline</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VOICEOVER PREP, CAPTIONS & TTS PROVIDER */}
      {subTab === 'voiceover' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Captions & Subtitle Render Config + SRT Export */}
            <div className="bg-[#0F182D] border border-slate-800/80 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Captions className="w-4 h-4 text-[#D4AF37]" />
                  <div>
                    <h2 className="text-sm font-display font-semibold text-slate-100">
                      Burned-In Captions &amp; SRT Subtitles
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      Renders directly onto MP4 frames and exports deterministic .SRT timecodes.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateCaptions({ enabled: !captionSettings.enabled })}
                    aria-pressed={captionSettings.enabled}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold ${
                      captionSettings.enabled
                        ? 'bg-[#D4AF37] text-[#080E1A]'
                        : 'bg-[#080E1A] border border-slate-700 text-slate-400'
                    }`}
                  >
                    {captionSettings.enabled ? 'Captions ON' : 'Captions OFF'}
                  </button>
                  <button
                    type="button"
                    onClick={handleExportSrt}
                    className="px-3 py-1.5 rounded-md bg-[#131E38] hover:bg-[#1B2B4F] border border-slate-700 text-xs font-semibold text-slate-100 flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>Export .SRT</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-xs">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Caption Style</label>
                  <select
                    value={captionSettings.style}
                    onChange={(e) => updateCaptions({ style: e.target.value as CaptionStyle })}
                    className="w-full px-2.5 py-1.5 rounded bg-[#080E1A] border border-slate-800 text-xs text-slate-100"
                  >
                    <option value="broadcast">Broadcast Bar</option>
                    <option value="minimal">Minimal Clean</option>
                    <option value="bold-shorts">Bold Shorts Yellow</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Font Size (px)</label>
                  <input
                    type="number"
                    min={18}
                    max={52}
                    value={captionSettings.fontSize}
                    onChange={(e) =>
                      updateCaptions({
                        fontSize: Math.max(18, Math.min(52, Number(e.target.value) || 28)),
                      })
                    }
                    className="w-full px-2.5 py-1.5 rounded bg-[#080E1A] border border-slate-800 text-xs font-mono-tabular text-slate-100"
                  />
                </div>
                <label className="flex items-center gap-2 pt-4 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={captionSettings.showBackground}
                    onChange={(e) => updateCaptions({ showBackground: e.target.checked })}
                    className="accent-[#D4AF37]"
                  />
                  <span>Backing Box</span>
                </label>
                <label className="flex items-center gap-2 pt-4 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={captionSettings.textOutline}
                    onChange={(e) => updateCaptions({ textOutline: e.target.checked })}
                    className="accent-[#D4AF37]"
                  />
                  <span>Text Outline</span>
                </label>
              </div>
            </div>

            {/* TTS Provider Abstraction Bar */}
            <div className="bg-[#0F182D] border border-slate-800/80 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-display font-bold uppercase tracking-wider text-slate-200">
                    Voiceover / TTS Provider Adapter
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Manual upload &amp; browser speech preview active; cloud TTS adapters ready without credentials.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
                <select
                  aria-label="TTS Provider"
                  value={ttsProviderId}
                  onChange={(e) => {
                    setTtsProviderId(e.target.value);
                    setTtsStatusNote(null);
                  }}
                  className="sm:col-span-2 px-2.5 py-1.5 rounded bg-[#080E1A] border border-slate-800 text-slate-100"
                >
                  {TTS_PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  aria-label="TTS Language"
                  value={ttsLang}
                  onChange={(e) => setTtsLang(e.target.value)}
                  placeholder="en-US"
                  className="px-2.5 py-1.5 rounded bg-[#080E1A] border border-slate-800 font-mono-tabular text-slate-100"
                />
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">Rate</span>
                  <input
                    type="number"
                    aria-label="TTS Rate"
                    min={0.6}
                    max={1.6}
                    step={0.1}
                    value={ttsRate}
                    onChange={(e) => setTtsRate(Number(e.target.value) || 1)}
                    className="w-full px-2 py-1.5 rounded bg-[#080E1A] border border-slate-800 font-mono-tabular text-slate-100"
                  />
                </div>
              </div>
              {ttsStatusNote && (
                <div className="text-[11px] text-[#F4D57A] bg-[#080E1A] border border-slate-800 rounded px-3 py-1.5">
                  {ttsStatusNote}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between bg-[#0F182D] border border-slate-800/80 rounded-xl p-4">
              <div>
                <h2 className="text-sm font-display font-semibold text-slate-100">
                  Voiceover Script &amp; Narration Track Prep
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Write scene narration, set caption timing windows, or attach recorded voiceover audio.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  updateActiveProject((prev) => ({
                    ...prev,
                    voiceoverSegments: [
                      ...prev.voiceoverSegments,
                      {
                        id: `vo-${Date.now().toString(36)}`,
                        sceneClipId: '',
                        label: `Custom Narration ${prev.voiceoverSegments.length + 1}`,
                        text: '',
                        status: 'not-created',
                        estimatedDurationSec: 0,
                      },
                    ],
                  }))
                }
                className="px-3 py-1.5 rounded-md bg-[#D4AF37] text-[#080E1A] text-xs font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Script Block</span>
              </button>
            </div>

            {voSegments.map((seg) => (
              <div
                key={seg.id}
                className="bg-[#0F182D] border border-slate-800/80 rounded-xl p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-display font-bold text-slate-100">
                      {seg.label}
                    </span>
                    <span
                      className={`text-[11px] font-mono-tabular font-semibold ${
                        seg.status === 'audio-attached'
                          ? 'text-emerald-400'
                          : seg.status === 'script-ready'
                          ? 'text-[#E5B94C]'
                          : 'text-slate-400'
                      }`}
                    >
                      {seg.status === 'audio-attached'
                        ? 'Audio Attached'
                        : seg.status === 'script-ready'
                        ? 'Script Ready'
                        : 'Not Created'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono-tabular text-slate-400">
                      Est. {seg.estimatedDurationSec}s
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        const provider =
                          TTS_PROVIDERS.find((p) => p.id === ttsProviderId) ??
                          TTS_PROVIDERS[0];
                        const res = await provider.generateSpeech(
                          seg.text || seg.label,
                          '',
                          { rate: ttsRate, pitch: 1, lang: ttsLang }
                        );
                        setTtsStatusNote(`${provider.name}: ${res.note}`);
                      }}
                      className="px-2.5 py-1 rounded bg-[#172442] hover:bg-[#1E2E54] text-[#F4D57A] text-xs font-semibold"
                    >
                      Test TTS
                    </button>
                    <label className="px-2.5 py-1 rounded bg-[#131E38] hover:bg-[#1B2B4F] border border-slate-700 text-xs text-slate-200 cursor-pointer flex items-center gap-1">
                      <Upload className="w-3 h-3 text-[#D4AF37]" />
                      <span>Upload VO Audio</span>
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={(e) => handleUploadVoForSegment(seg.id, e)}
                        className="sr-only"
                      />
                    </label>
                  </div>
                </div>

                <textarea
                  rows={2}
                  value={seg.text}
                  onChange={(e) => handleUpdateVoSegment(seg.id, { text: e.target.value })}
                  placeholder="Enter narration script for this scene..."
                  className="w-full px-3 py-2 rounded-lg bg-[#080E1A] border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                />

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                  <div className="sm:col-span-8">
                    <input
                      type="text"
                      value={seg.captionText ?? ''}
                      onChange={(e) =>
                        handleUpdateVoSegment(seg.id, { captionText: e.target.value })
                      }
                      placeholder="Optional caption text override (defaults to narration script)"
                      className="w-full px-2.5 py-1.5 rounded bg-[#080E1A] border border-slate-800 text-[11px] text-slate-200"
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-1">
                    <span className="text-[10px] text-slate-500">Start</span>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={seg.startSec ?? ''}
                      onChange={(e) =>
                        handleUpdateVoSegment(seg.id, {
                          startSec: e.target.value === '' ? undefined : Number(e.target.value),
                        })
                      }
                      placeholder="auto"
                      className="w-full px-2 py-1 rounded bg-[#080E1A] border border-slate-800 text-[11px] font-mono-tabular text-slate-200"
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-1">
                    <span className="text-[10px] text-slate-500">End</span>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={seg.endSec ?? ''}
                      onChange={(e) =>
                        handleUpdateVoSegment(seg.id, {
                          endSec: e.target.value === '' ? undefined : Number(e.target.value),
                        })
                      }
                      placeholder="auto"
                      className="w-full px-2 py-1 rounded bg-[#080E1A] border border-slate-800 text-[11px] font-mono-tabular text-slate-200"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
