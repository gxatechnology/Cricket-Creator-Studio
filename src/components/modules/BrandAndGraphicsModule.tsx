import React, { useMemo, useRef, useState } from 'react';
import {
  Copy,
  Download,
  Image as ImageIcon,
  Layers,
  Palette,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { useStudio } from '../../context/StudioContext';
import type {
  BrandKit,
  BrandOverlaySettings,
  BroadcastGraphicOverlay,
  BroadcastGraphicType,
  ThumbnailElement,
} from '../../types/studio';
import { THUMBNAIL_TEMPLATES } from '../../engine/brandDefaults';

const GRAPHIC_TYPES: { type: BroadcastGraphicType; label: string }[] = [
  { type: 'score-bug', label: 'Score Bug' },
  { type: 'player-card', label: 'Player Card' },
  { type: 'bowler-card', label: 'Bowler Card' },
  { type: 'batsman-card', label: 'Batsman Card' },
  { type: 'team-comparison', label: 'Team Comparison' },
  { type: 'stat-card', label: 'Stat Card' },
  { type: 'lower-third', label: 'Lower Third' },
  { type: 'match-situation', label: 'Match Situation Card' },
  { type: 'over-summary', label: 'Over Summary' },
  { type: 'required-run-rate', label: 'Required Run Rate' },
  { type: 'partnership', label: 'Partnership' },
  { type: 'wagon-wheel', label: 'Wagon Wheel Placeholder' },
  { type: 'field-position-labels', label: 'Field Position Labels' },
];

function wrapThumbnailText(text: string, maxWidth: number, fontSize: number): string[] {
  const approxCharWidth = Math.max(8, fontSize * 0.58);
  const maxCharsPerLine = Math.max(6, Math.floor(maxWidth / approxCharWidth));
  const lines: string[] = [];

  for (const rawParagraph of text.split('\n')) {
    const words = rawParagraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;
    let current = words[0];
    for (let i = 1; i < words.length; i += 1) {
      const candidate = `${current} ${words[i]}`;
      if (candidate.length <= maxCharsPerLine) {
        current = candidate;
      } else {
        lines.push(current);
        current = words[i];
      }
    }
    lines.push(current);
  }
  return lines.length > 0 ? lines : [text];
}

export function BrandAndGraphicsModule() {
  const {
    workspace,
    activeProject,
    updateActiveProject,
    saveBrandPreset,
    duplicateBrandPreset,
    deleteBrandPreset,
  } = useStudio();

  const [subTab, setSubTab] = useState<'brand' | 'graphics' | 'thumbnail'>('brand');
  const [selectedGraphicId, setSelectedGraphicId] = useState<string | null>(
    activeProject.broadcastGraphics[0]?.id ?? null
  );
  const [selectedThumbElementId, setSelectedThumbElementId] = useState<string | null>(
    activeProject.thumbnailDesign.elements[1]?.id ??
      activeProject.thumbnailDesign.elements[0]?.id ??
      null
  );
  const [newGraphicType, setNewGraphicType] = useState<BroadcastGraphicType>('score-bug');

  const brand = activeProject.brandKit;
  const presets = workspace.brandPresets;
  const logoAssets = activeProject.assets.filter(
    (a) => a.category === 'logos' || a.category === 'team-logos'
  );

  const selectedGraphic = useMemo(
    () =>
      activeProject.broadcastGraphics.find((g) => g.id === selectedGraphicId) ??
      activeProject.broadcastGraphics[0] ??
      null,
    [activeProject.broadcastGraphics, selectedGraphicId]
  );

  const selectedThumbElement = useMemo(
    () =>
      activeProject.thumbnailDesign.elements.find((el) => el.id === selectedThumbElementId) ??
      null,
    [activeProject.thumbnailDesign.elements, selectedThumbElementId]
  );

  const thumbDragRef = useRef<{
    elementId: string;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const brandOverlay: BrandOverlaySettings = activeProject.brandOverlay ?? {
    logoScale: 1,
    watermarkOpacity: 0.75,
    watermarkScale: 1,
    showWatermark: true,
    showChannelHandle: true,
  };

  const updateBrandOverlay = (patch: Partial<BrandOverlaySettings>) => {
    updateActiveProject((prev) => ({
      ...prev,
      brandOverlay: {
        ...(prev.brandOverlay ?? brandOverlay),
        ...patch,
      },
    }));
  };

  const updateBrand = (patch: Partial<BrandKit>) => {
    updateActiveProject((prev) => ({
      ...prev,
      brandKit: { ...prev.brandKit, ...patch },
      settings: {
        ...prev.settings,
        channelHandle: patch.youtubeHandle ?? prev.settings.channelHandle,
      },
    }));
  };

  const handleApplyBrandPreset = (preset: BrandKit) => {
    updateActiveProject((prev) => ({
      ...prev,
      brandKit: { ...preset },
      settings: { ...prev.settings, channelHandle: preset.youtubeHandle },
    }));
  };

  const handleAddGraphic = () => {
    const meta = GRAPHIC_TYPES.find((g) => g.type === newGraphicType) ?? GRAPHIC_TYPES[0];
    const next: BroadcastGraphicOverlay = {
      id: `gfx-${Date.now().toString(36)}`,
      type: newGraphicType,
      label: meta.label,
      title: meta.label.toUpperCase(),
      subtitle: `${brand.channelName} · Live Graphics`,
      valueText: newGraphicType === 'required-run-rate' ? 'RRR 9.45' : '142/3',
      teamName: 'IND',
      playerName: 'Batter / Bowler',
      accentColor: brand.accentColor,
      position: { x: 10, y: 78 },
      startSec: 0,
      durationSec: 6,
      enabled: true,
    };
    updateActiveProject((prev) => ({
      ...prev,
      broadcastGraphics: [...prev.broadcastGraphics, next],
    }));
    setSelectedGraphicId(next.id);
  };

  const updateGraphic = (id: string, patch: Partial<BroadcastGraphicOverlay>) => {
    updateActiveProject((prev) => ({
      ...prev,
      broadcastGraphics: prev.broadcastGraphics.map((g) =>
        g.id === id ? { ...g, ...patch } : g
      ),
    }));
  };

  const deleteGraphic = (id: string) => {
    updateActiveProject((prev) => ({
      ...prev,
      broadcastGraphics: prev.broadcastGraphics.filter((g) => g.id !== id),
    }));
    if (selectedGraphicId === id) setSelectedGraphicId(null);
  };

  const updateThumbElement = (id: string, patch: Partial<ThumbnailElement>) => {
    updateActiveProject((prev) => ({
      ...prev,
      thumbnailDesign: {
        ...prev.thumbnailDesign,
        elements: prev.thumbnailDesign.elements.map((el) =>
          el.id === id ? { ...el, ...patch } : el
        ),
      },
    }));
  };

  const addThumbElement = (kind: ThumbnailElement['kind']) => {
    const next: ThumbnailElement = {
      id: `th-${Date.now().toString(36)}`,
      kind,
      text:
        kind === 'text'
          ? 'CRICKET QUIZ'
          : kind === 'badge'
          ? 'NEW EPISODE'
          : kind === 'stat-badge'
          ? '145 KM/H'
          : kind === 'player-placeholder'
          ? 'PLAYER'
          : undefined,
      x: 160,
      y: 220,
      width: kind === 'circle' ? 180 : kind === 'player-placeholder' ? 300 : 380,
      height: kind === 'circle' ? 180 : kind === 'player-placeholder' ? 420 : 90,
      scale: 1,
      rotation: 0,
      fontSize: kind === 'text' ? 64 : 30,
      color: kind === 'badge' ? '#080E1A' : '#FFFFFF',
      bgColor: kind === 'badge' ? brand.accentColor : '#1E293B',
    };
    updateActiveProject((prev) => ({
      ...prev,
      thumbnailDesign: {
        ...prev.thumbnailDesign,
        elements: [...prev.thumbnailDesign.elements, next],
      },
    }));
    setSelectedThumbElementId(next.id);
  };

  const handleExportThumbnailPng = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const design = activeProject.thumbnailDesign;
    ctx.fillStyle = design.bgColor || '#0A1326';
    ctx.fillRect(0, 0, 1280, 720);

    for (const el of design.elements) {
      ctx.save();
      const cx = el.x + (el.width * el.scale) / 2;
      const cy = el.y + (el.height * el.scale) / 2;
      ctx.translate(cx, cy);
      ctx.rotate((el.rotation * Math.PI) / 180);
      ctx.scale(el.scale, el.scale);
      ctx.translate(-el.width / 2, -el.height / 2);

      if (el.kind === 'background') {
        ctx.fillStyle = el.bgColor || design.bgColor;
        ctx.fillRect(0, 0, el.width, el.height);
      } else if (el.kind === 'badge' || el.kind === 'stat-badge' || el.kind === 'player-placeholder') {
        ctx.fillStyle = el.bgColor || '#172442';
        ctx.fillRect(0, 0, el.width, el.height);
        ctx.strokeStyle = design.accentColor;
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, el.width, el.height);
        if (el.text) {
          ctx.fillStyle = el.color || '#FFFFFF';
          ctx.font = `800 ${el.fontSize || 32}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(el.text, el.width / 2, el.height / 2);
        }
      } else if (el.kind === 'circle') {
        ctx.strokeStyle = el.color || '#EF4444';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(el.width / 2, el.height / 2, Math.min(el.width, el.height) / 2 - 8, 0, Math.PI * 2);
        ctx.stroke();
      } else if (el.kind === 'arrow') {
        ctx.strokeStyle = el.color || '#FACC15';
        ctx.fillStyle = el.color || '#FACC15';
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.moveTo(10, el.height / 2);
        ctx.lineTo(el.width - 36, el.height / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(el.width - 8, el.height / 2);
        ctx.lineTo(el.width - 44, el.height / 2 - 22);
        ctx.lineTo(el.width - 44, el.height / 2 + 22);
        ctx.closePath();
        ctx.fill();
      } else if (el.kind === 'text' && el.text) {
        const fontSize = el.fontSize || 64;
        const lineHeight = Math.round(fontSize * 1.15);
        const lines = wrapThumbnailText(el.text, el.width, fontSize);
        ctx.fillStyle = el.color || '#FFFFFF';
        ctx.font = `900 ${fontSize}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        lines.forEach((line, idx) => {
          ctx.fillText(line, 0, idx * lineHeight, el.width);
        });
      }
      ctx.restore();
    }

    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeProject.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'cricket'}-thumbnail.png`;
    link.click();
  };

  return (
    <div className="h-full flex flex-col bg-[#080E1A] overflow-hidden">
      {/* Sub-navigation bar */}
      <div className="px-6 py-3 border-b border-slate-800/80 bg-[#0C1426] flex items-center justify-between gap-4">
        <div className="flex items-center bg-[#080E1A] p-0.5 rounded-md border border-slate-800">
          <button
            type="button"
            onClick={() => setSubTab('brand')}
            className={`px-3.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 ${
              subTab === 'brand' ? 'bg-[#172442] text-[#F4D57A]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Brand Studio</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('graphics')}
            className={`px-3.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 ${
              subTab === 'graphics' ? 'bg-[#172442] text-[#F4D57A]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Broadcast Graphics ({activeProject.broadcastGraphics.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('thumbnail')}
            className={`px-3.5 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 ${
              subTab === 'thumbnail' ? 'bg-[#172442] text-[#F4D57A]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Thumbnail Composer (1280×720)</span>
          </button>
        </div>
      </div>

      {/* BRAND STUDIO */}
      {subTab === 'brand' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-[1260px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
            <section className="lg:col-span-7 bg-[#0F182D] border border-slate-800/80 rounded-xl p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-base font-display font-semibold text-slate-100">
                    Channel Brand Kit
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Applies brand colors, watermark, fonts, and CTA across scenes and graphics.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    saveBrandPreset({
                      ...brand,
                      id: brand.id || `brand-${Date.now()}`,
                      name: brand.name || brand.brandName,
                    })
                  }
                  className="px-3 py-1.5 rounded-md bg-[#D4AF37] hover:bg-[#E2BE48] text-[#080E1A] text-xs font-bold flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Preset</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Preset Name</label>
                  <input
                    type="text"
                    value={brand.name}
                    onChange={(e) => updateBrand({ name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#080E1A] border border-slate-800 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Brand Name</label>
                  <input
                    type="text"
                    value={brand.brandName}
                    onChange={(e) => updateBrand({ brandName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#080E1A] border border-slate-800 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Channel Name</label>
                  <input
                    type="text"
                    value={brand.channelName}
                    onChange={(e) => updateBrand({ channelName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#080E1A] border border-slate-800 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">YouTube Handle</label>
                  <input
                    type="text"
                    value={brand.youtubeHandle}
                    onChange={(e) => updateBrand({ youtubeHandle: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#080E1A] border border-slate-800 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Watermark Text</label>
                  <input
                    type="text"
                    value={brand.watermarkText}
                    onChange={(e) => updateBrand({ watermarkText: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#080E1A] border border-slate-800 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Website</label>
                  <input
                    type="text"
                    value={brand.website}
                    onChange={(e) => updateBrand({ website: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[#080E1A] border border-slate-800 text-xs text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Logo Text Badge</label>
                  <input
                    type="text"
                    maxLength={5}
                    value={brand.logoTextFallback}
                    onChange={(e) => updateBrand({ logoTextFallback: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 rounded-lg bg-[#080E1A] border border-slate-800 text-xs font-mono-tabular text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Linked Logo Asset</label>
                  <select
                    value={brand.logoAssetId ?? ''}
                    onChange={(e) => updateBrand({ logoAssetId: e.target.value || null })}
                    className="w-full px-3 py-2 rounded-lg bg-[#080E1A] border border-slate-800 text-xs text-slate-100"
                  >
                    <option value="">Use Text Monogram ({brand.logoTextFallback})</option>
                    {logoAssets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                {(
                  [
                    { key: 'primaryColor', label: 'Primary' },
                    { key: 'secondaryColor', label: 'Secondary' },
                    { key: 'accentColor', label: 'Accent' },
                    { key: 'backgroundColor', label: 'Background' },
                  ] as const
                ).map((c) => (
                  <div key={c.key}>
                    <label className="block text-[11px] text-slate-400 mb-1">{c.label}</label>
                    <div className="flex items-center gap-2 bg-[#080E1A] border border-slate-800 rounded px-2 py-1">
                      <input
                        type="color"
                        value={brand[c.key]}
                        onChange={(e) => updateBrand({ [c.key]: e.target.value })}
                        className="w-6 h-6 rounded bg-transparent border-0 cursor-pointer"
                      />
                      <span className="text-[11px] font-mono-tabular text-slate-300">
                        {brand[c.key]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Default CTA Copy</label>
                <input
                  type="text"
                  value={brand.ctaText}
                  onChange={(e) => updateBrand({ ctaText: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#080E1A] border border-slate-800 text-xs text-slate-100"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 space-y-3">
                <div className="text-xs font-display font-semibold text-slate-200">
                  Video Render Overlay &amp; Watermark
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                      <span>Watermark Opacity</span>
                      <span className="font-mono-tabular">
                        {Math.round(brandOverlay.watermarkOpacity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.1}
                      max={1}
                      step={0.05}
                      value={brandOverlay.watermarkOpacity}
                      onChange={(e) =>
                        updateBrandOverlay({ watermarkOpacity: Number(e.target.value) })
                      }
                      className="w-full accent-[#D4AF37]"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                      <span>Watermark Scale</span>
                      <span className="font-mono-tabular">{brandOverlay.watermarkScale}x</span>
                    </div>
                    <input
                      type="range"
                      min={0.7}
                      max={1.6}
                      step={0.1}
                      value={brandOverlay.watermarkScale}
                      onChange={(e) =>
                        updateBrandOverlay({ watermarkScale: Number(e.target.value) })
                      }
                      className="w-full accent-[#D4AF37]"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                      <span>Corner Logo Scale</span>
                      <span className="font-mono-tabular">{brandOverlay.logoScale}x</span>
                    </div>
                    <input
                      type="range"
                      min={0.6}
                      max={1.8}
                      step={0.1}
                      value={brandOverlay.logoScale}
                      onChange={(e) =>
                        updateBrandOverlay({ logoScale: Number(e.target.value) })
                      }
                      className="w-full accent-[#D4AF37]"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-slate-300">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={brandOverlay.showWatermark}
                      onChange={(e) =>
                        updateBrandOverlay({ showWatermark: e.target.checked })
                      }
                      className="accent-[#D4AF37]"
                    />
                    <span>Show Watermark in Export</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={brandOverlay.showChannelHandle}
                      onChange={(e) =>
                        updateBrandOverlay({ showChannelHandle: e.target.checked })
                      }
                      className="accent-[#D4AF37]"
                    />
                    <span>Show Channel Handle</span>
                  </label>
                </div>
              </div>
            </section>

            {/* Right: Presets + Live Brand Identity Card */}
            <aside className="lg:col-span-5 space-y-5">
              <div className="bg-[#0F182D] border border-slate-800/80 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-display font-semibold text-slate-100">
                  Saved Brand Presets
                </h3>
                <div className="space-y-2">
                  {presets.map((preset) => {
                    const isCurrent = preset.id === brand.id;
                    return (
                      <div
                        key={preset.id}
                        className={`p-3 rounded-lg border flex items-center justify-between gap-2 ${
                          isCurrent
                            ? 'bg-[#172442] border-[#D4AF37]/50'
                            : 'bg-[#080E1A] border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold shrink-0"
                            style={{
                              backgroundColor: preset.accentColor,
                              color: preset.backgroundColor,
                            }}
                          >
                            {preset.logoTextFallback}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-100 truncate">
                              {preset.name}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              {preset.youtubeHandle}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleApplyBrandPreset(preset)}
                            className="px-2.5 py-1 rounded bg-[#D4AF37] text-[#080E1A] text-[11px] font-bold"
                          >
                            Apply
                          </button>
                          <button
                            type="button"
                            onClick={() => duplicateBrandPreset(preset.id)}
                            title="Duplicate brand preset"
                            className="p-1.5 rounded bg-[#131E38] border border-slate-700 text-slate-300"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          {presets.length > 1 && (
                            <button
                              type="button"
                              onClick={() => deleteBrandPreset(preset.id)}
                              title="Delete brand preset"
                              className="p-1.5 rounded bg-[#131E38] border border-slate-700 text-slate-400 hover:text-red-400"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Brand Live Broadcast Bumper Preview */}
              <div
                className="rounded-xl border border-slate-700/80 p-5 space-y-3"
                style={{ backgroundColor: brand.backgroundColor }}
              >
                <div className="text-[11px] font-mono-tabular text-slate-400">
                  Live Brand Bumper Preview
                </div>
                <div
                  className="p-4 rounded-lg border"
                  style={{
                    backgroundColor: brand.primaryColor,
                    borderColor: brand.accentColor,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm"
                      style={{
                        backgroundColor: brand.accentColor,
                        color: brand.backgroundColor,
                      }}
                    >
                      {brand.logoTextFallback}
                    </div>
                    <div>
                      <div className="text-sm font-display font-bold text-white">
                        {brand.channelName}
                      </div>
                      <div className="text-xs" style={{ color: brand.accentColor }}>
                        {brand.youtubeHandle} · {brand.website}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-white/10 text-xs text-slate-200">
                    {brand.ctaText}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}

      {/* BROADCAST GRAPHICS */}
      {subTab === 'graphics' && (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          <aside className="w-full lg:w-[290px] shrink-0 bg-[#0C1426] border-b lg:border-b-0 lg:border-r border-slate-800/80 p-4 flex flex-col gap-3 overflow-y-auto">
            <div className="flex gap-1.5">
              <select
                value={newGraphicType}
                onChange={(e) => setNewGraphicType(e.target.value as BroadcastGraphicType)}
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded bg-[#080E1A] border border-slate-800 text-xs text-slate-100"
              >
                {GRAPHIC_TYPES.map((g) => (
                  <option key={g.type} value={g.type}>
                    {g.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddGraphic}
                className="px-2.5 py-1.5 rounded bg-[#D4AF37] text-[#080E1A] text-xs font-bold flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>

            <div className="space-y-1.5">
              {activeProject.broadcastGraphics.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelectedGraphicId(g.id)}
                  className={`w-full text-left p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
                    selectedGraphic?.id === g.id
                      ? 'bg-[#172442] border-[#D4AF37]/50 text-slate-100'
                      : 'bg-[#080E1A] border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">{g.label}</div>
                    <div className="text-[10px] font-mono-tabular text-slate-400">
                      {g.startSec}s – {g.startSec + g.durationSec}s · {g.enabled ? 'ON' : 'OFF'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          {/* Center Safe-Area Broadcast Overlay Stage */}
          <div className="flex-1 p-6 flex items-center justify-center bg-[#060B15] overflow-auto">
            <div
              className={`relative rounded-xl border border-slate-700 bg-[#0A1324] overflow-hidden shadow-2xl ${
                activeProject.settings.aspectRatio === '9:16'
                  ? 'h-[520px] aspect-[9/16]'
                  : activeProject.settings.aspectRatio === '1:1'
                  ? 'h-[480px] aspect-square'
                  : 'w-full max-w-[780px] aspect-video'
              }`}
            >
              {/* Safe Frame Guides */}
              <div className="pointer-events-none absolute inset-[5%] border border-dashed border-sky-400/30 rounded" />
              <div className="pointer-events-none absolute inset-[10%] border border-dotted border-[#D4AF37]/30 rounded" />

              {activeProject.broadcastGraphics
                .filter((g) => g.enabled)
                .map((g) => (
                  <div
                    key={g.id}
                    onClick={() => setSelectedGraphicId(g.id)}
                    className={`absolute cursor-pointer px-3 py-2 rounded-lg border bg-[#0C162B]/95 shadow-lg max-w-[72%] ${
                      selectedGraphic?.id === g.id
                        ? 'ring-2 ring-[#D4AF37]'
                        : 'border-slate-700'
                    }`}
                    style={{
                      left: `${g.position.x}%`,
                      top: `${g.position.y}%`,
                      transform: 'translate(-10%, -50%)',
                      borderColor: g.accentColor,
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className="text-[10px] font-mono-tabular font-bold uppercase"
                        style={{ color: g.accentColor }}
                      >
                        {g.teamName} · {g.type.replace(/-/g, ' ')}
                      </span>
                      <span className="text-xs font-mono-tabular font-bold text-white">
                        {g.valueText}
                      </span>
                    </div>
                    <div className="text-xs font-display font-bold text-slate-100 mt-0.5">
                      {g.title}
                    </div>
                    <div className="text-[11px] text-slate-300">{g.subtitle}</div>
                  </div>
                ))}
            </div>
          </div>

          {/* Right Overlay Editor */}
          <aside className="w-full lg:w-[310px] shrink-0 bg-[#0C1426] border-t lg:border-t-0 lg:border-l border-slate-800/80 p-4 overflow-y-auto space-y-3">
            {!selectedGraphic ? (
              <div className="text-xs text-slate-400">Select or add a graphic overlay.</div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-100">Edit Graphic</span>
                  <button
                    type="button"
                    onClick={() => deleteGraphic(selectedGraphic.id)}
                    className="p-1.5 rounded bg-red-950/60 text-red-300 border border-red-500/40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedGraphic.enabled}
                    onChange={(e) =>
                      updateGraphic(selectedGraphic.id, { enabled: e.target.checked })
                    }
                    className="accent-[#D4AF37]"
                  />
                  <span>Overlay Enabled</span>
                </label>

                {(
                  [
                    { key: 'title', label: 'Headline / Title' },
                    { key: 'subtitle', label: 'Subtitle' },
                    { key: 'valueText', label: 'Primary Stat / Score' },
                    { key: 'teamName', label: 'Team Code' },
                    { key: 'playerName', label: 'Player Name' },
                  ] as const
                ).map((f) => (
                  <div key={f.key}>
                    <label className="block text-[11px] text-slate-400 mb-1">{f.label}</label>
                    <input
                      type="text"
                      value={selectedGraphic[f.key]}
                      onChange={(e) =>
                        updateGraphic(selectedGraphic.id, { [f.key]: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 rounded bg-[#080E1A] border border-slate-800 text-xs text-slate-100"
                    />
                  </div>
                ))}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">X Pos (%)</label>
                    <input
                      type="number"
                      min={5}
                      max={90}
                      value={selectedGraphic.position.x}
                      onChange={(e) =>
                        updateGraphic(selectedGraphic.id, {
                          position: {
                            ...selectedGraphic.position,
                            x: Math.max(5, Math.min(90, Number(e.target.value) || 10)),
                          },
                        })
                      }
                      className="w-full px-2 py-1 rounded bg-[#080E1A] border border-slate-800 text-xs font-mono-tabular text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Y Pos (%)</label>
                    <input
                      type="number"
                      min={8}
                      max={90}
                      value={selectedGraphic.position.y}
                      onChange={(e) =>
                        updateGraphic(selectedGraphic.id, {
                          position: {
                            ...selectedGraphic.position,
                            y: Math.max(8, Math.min(90, Number(e.target.value) || 75)),
                          },
                        })
                      }
                      className="w-full px-2 py-1 rounded bg-[#080E1A] border border-slate-800 text-xs font-mono-tabular text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Start (s)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={selectedGraphic.startSec}
                      onChange={(e) =>
                        updateGraphic(selectedGraphic.id, {
                          startSec: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="w-full px-2 py-1 rounded bg-[#080E1A] border border-slate-800 text-xs font-mono-tabular text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Duration (s)</label>
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={selectedGraphic.durationSec}
                      onChange={(e) =>
                        updateGraphic(selectedGraphic.id, {
                          durationSec: Math.max(0.5, Number(e.target.value) || 3),
                        })
                      }
                      className="w-full px-2 py-1 rounded bg-[#080E1A] border border-slate-800 text-xs font-mono-tabular text-slate-100"
                    />
                  </div>
                </div>
              </>
            )}
          </aside>
        </div>
      )}

      {/* THUMBNAIL COMPOSER (1280x720) */}
      {subTab === 'thumbnail' && (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          <aside className="w-full lg:w-[270px] shrink-0 bg-[#0C1426] border-b lg:border-b-0 lg:border-r border-slate-800/80 p-4 space-y-4 overflow-y-auto">
            <div>
              <div className="text-xs font-semibold text-slate-200 mb-2">
                Thumbnail Templates
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {THUMBNAIL_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() =>
                      updateActiveProject((prev) => ({
                        ...prev,
                        thumbnailDesign: JSON.parse(JSON.stringify(tpl.design)),
                      }))
                    }
                    className={`px-2.5 py-2 rounded text-[11px] font-medium border text-left ${
                      activeProject.thumbnailDesign.templateId === tpl.id
                        ? 'bg-[#172442] border-[#D4AF37]/50 text-[#F4D57A]'
                        : 'bg-[#080E1A] border-slate-800 text-slate-300'
                    }`}
                  >
                    {tpl.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-slate-200">Add Layer</div>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { kind: 'text', label: '+ Text' },
                    { kind: 'badge', label: '+ Badge' },
                    { kind: 'stat-badge', label: '+ Stat Box' },
                    { kind: 'player-placeholder', label: '+ Player' },
                    { kind: 'arrow', label: '+ Arrow' },
                    { kind: 'circle', label: '+ Circle' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.kind}
                    type="button"
                    onClick={() => addThumbElement(item.kind)}
                    className="px-2 py-1.5 rounded bg-[#131E38] hover:bg-[#1B2B4F] border border-slate-700/80 text-[11px] text-slate-200"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleExportThumbnailPng}
              className="w-full py-2 px-3 rounded-lg bg-[#D4AF37] hover:bg-[#E2BE48] text-[#080E1A] text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export 1280×720 PNG</span>
            </button>
          </aside>

          {/* Interactive 1280x720 Canvas */}
          <div
            className="flex-1 p-6 flex items-center justify-center bg-[#060B15] overflow-auto"
            onMouseMove={(e) => {
              const drag = thumbDragRef.current;
              if (!drag) return;
              // Container scaled from 1280px width to roughly 640px-800px
              const stage = document.getElementById('thumbnail-stage-1280');
              const ratio = stage ? 1280 / stage.getBoundingClientRect().width : 2;
              const dx = (e.clientX - drag.startClientX) * ratio;
              const dy = (e.clientY - drag.startClientY) * ratio;
              updateThumbElement(drag.elementId, {
                x: Math.round(drag.origX + dx),
                y: Math.round(drag.origY + dy),
              });
            }}
            onMouseUp={() => {
              thumbDragRef.current = null;
            }}
          >
            <svg
              id="thumbnail-stage-1280"
              viewBox="0 0 1280 720"
              className="w-full max-w-[780px] aspect-video rounded-xl border border-slate-700 shadow-2xl select-none"
              style={{ backgroundColor: activeProject.thumbnailDesign.bgColor }}
            >
              {activeProject.thumbnailDesign.elements.map((el) => {
                const isSel = el.id === selectedThumbElementId;
                const cx = el.x + (el.width * el.scale) / 2;
                const cy = el.y + (el.height * el.scale) / 2;
                const transform = `translate(${cx}, ${cy}) rotate(${el.rotation}) scale(${el.scale}) translate(${-el.width / 2}, ${-el.height / 2})`;
                return (
                  <g
                    key={el.id}
                    transform={transform}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setSelectedThumbElementId(el.id);
                      if (el.kind === 'background') return;
                      thumbDragRef.current = {
                        elementId: el.id,
                        startClientX: e.clientX,
                        startClientY: e.clientY,
                        origX: el.x,
                        origY: el.y,
                      };
                    }}
                    className={el.kind === 'background' ? '' : 'cursor-move'}
                  >
                    {el.kind === 'background' && (
                      <rect
                        width={el.width}
                        height={el.height}
                        fill={el.bgColor || activeProject.thumbnailDesign.bgColor}
                      />
                    )}
                    {(el.kind === 'badge' ||
                      el.kind === 'stat-badge' ||
                      el.kind === 'player-placeholder') && (
                      <>
                        <rect
                          width={el.width}
                          height={el.height}
                          rx={10}
                          fill={el.bgColor || '#172442'}
                          stroke={activeProject.thumbnailDesign.accentColor}
                          strokeWidth={4}
                        />
                        <text
                          x={el.width / 2}
                          y={el.height / 2}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill={el.color || '#FFFFFF'}
                          fontSize={el.fontSize || 32}
                          fontWeight="800"
                        >
                          {el.text}
                        </text>
                      </>
                    )}
                    {el.kind === 'text' && el.text && (() => {
                      const fontSize = el.fontSize || 64;
                      const lineHeight = Math.round(fontSize * 1.15);
                      const lines = wrapThumbnailText(el.text, el.width, fontSize);
                      return (
                        <text
                          x={0}
                          y={4}
                          dominantBaseline="hanging"
                          fill={el.color || '#FFFFFF'}
                          fontSize={fontSize}
                          fontWeight="900"
                        >
                          {lines.map((line, idx) => (
                            <tspan key={idx} x={0} dy={idx === 0 ? 0 : lineHeight}>
                              {line}
                            </tspan>
                          ))}
                        </text>
                      );
                    })()}
                    {el.kind === 'circle' && (
                      <circle
                        cx={el.width / 2}
                        cy={el.height / 2}
                        r={Math.min(el.width, el.height) / 2 - 8}
                        fill="none"
                        stroke={el.color || '#EF4444'}
                        strokeWidth={10}
                      />
                    )}
                    {el.kind === 'arrow' && (
                      <path
                        d={`M 10 ${el.height / 2} L ${el.width - 36} ${el.height / 2} M ${el.width - 10} ${el.height / 2} L ${el.width - 44} ${el.height / 2 - 22} L ${el.width - 44} ${el.height / 2 + 22} Z`}
                        stroke={el.color || '#FACC15'}
                        fill={el.color || '#FACC15'}
                        strokeWidth={14}
                      />
                    )}
                    {isSel && el.kind !== 'background' && (
                      <rect
                        width={el.width}
                        height={el.height}
                        fill="none"
                        stroke="#D4AF37"
                        strokeWidth={3}
                        strokeDasharray="10 6"
                      />
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Right Element Properties */}
          <aside className="w-full lg:w-[270px] shrink-0 bg-[#0C1426] border-t lg:border-t-0 lg:border-l border-slate-800/80 p-4 space-y-3 overflow-y-auto">
            <div className="text-xs font-bold text-slate-200">Element Inspector</div>
            {!selectedThumbElement || selectedThumbElement.kind === 'background' ? (
              <div className="space-y-3">
                <div className="text-xs text-slate-400">
                  Click any text, badge, arrow, or player frame on the thumbnail to drag or customize.
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Canvas Background</label>
                  <input
                    type="color"
                    value={activeProject.thumbnailDesign.bgColor}
                    onChange={(e) =>
                      updateActiveProject((prev) => ({
                        ...prev,
                        thumbnailDesign: {
                          ...prev.thumbnailDesign,
                          bgColor: e.target.value,
                        },
                      }))
                    }
                    className="w-full h-8 rounded bg-[#080E1A] border border-slate-800"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedThumbElement.text !== undefined && (
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Text</label>
                    <input
                      type="text"
                      value={selectedThumbElement.text}
                      onChange={(e) =>
                        updateThumbElement(selectedThumbElement.id, { text: e.target.value })
                      }
                      className="w-full px-2.5 py-1.5 rounded bg-[#080E1A] border border-slate-800 text-xs text-slate-100"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Scale</label>
                    <input
                      type="number"
                      min={0.4}
                      max={2.5}
                      step={0.1}
                      value={selectedThumbElement.scale}
                      onChange={(e) =>
                        updateThumbElement(selectedThumbElement.id, {
                          scale: Math.max(0.4, Number(e.target.value) || 1),
                        })
                      }
                      className="w-full px-2 py-1 rounded bg-[#080E1A] border border-slate-800 text-xs font-mono-tabular text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Rotation (deg)</label>
                    <input
                      type="number"
                      min={-180}
                      max={180}
                      value={selectedThumbElement.rotation}
                      onChange={(e) =>
                        updateThumbElement(selectedThumbElement.id, {
                          rotation: Number(e.target.value) || 0,
                        })
                      }
                      className="w-full px-2 py-1 rounded bg-[#080E1A] border border-slate-800 text-xs font-mono-tabular text-slate-100"
                    />
                  </div>
                </div>

                {selectedThumbElement.fontSize !== undefined && (
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Font Size</label>
                    <input
                      type="number"
                      min={16}
                      max={140}
                      value={selectedThumbElement.fontSize}
                      onChange={(e) =>
                        updateThumbElement(selectedThumbElement.id, {
                          fontSize: Math.max(12, Number(e.target.value) || 32),
                        })
                      }
                      className="w-full px-2 py-1 rounded bg-[#080E1A] border border-slate-800 text-xs font-mono-tabular text-slate-100"
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    updateActiveProject((prev) => ({
                      ...prev,
                      thumbnailDesign: {
                        ...prev.thumbnailDesign,
                        elements: prev.thumbnailDesign.elements.filter(
                          (el) => el.id !== selectedThumbElement.id
                        ),
                      },
                    }));
                    setSelectedThumbElementId(null);
                  }}
                  className="w-full py-1.5 rounded bg-red-950/60 border border-red-500/40 text-xs text-red-200"
                >
                  Remove Layer
                </button>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
