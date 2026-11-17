import React, { useEffect, useRef, useState } from 'react';
import {
  BookmarkPlus,
  Check,
  Copy,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useStudio } from '../../context/StudioContext';
import type {
  BallDeliveryType,
  FieldPoint,
  FieldRenderOptions,
  FieldSceneRecord,
  FielderPosition,
  FielderRole,
  ShotType,
} from '../../types/studio';
import {
  BALL_ANIMATION_PRESETS,
  FIELD_PRESETS,
  applyBallAnimationPreset,
  clampFieldPoint,
  classifyFieldingZone,
  cloneFieldDesignFromPreset,
  inferRoleFromPosition,
  roundCoord,
} from '../../engine/cricketField';
import { BallHandleKey, CricketFieldSvg } from '../CricketFieldSvg';

const DELIVERY_TYPES: BallDeliveryType[] = [
  'Yorker',
  'Good Length',
  'Bouncer',
  'Outswinger',
  'Inswinger',
  'Leg Spin',
  'Off Break',
  'Googly',
];

const SHOT_TYPES: ShotType[] = [
  'Straight Drive',
  'Cover Drive',
  'Pull Shot',
  'Hook Shot',
  'Square Cut',
  'Sweep',
  'Reverse Sweep',
  'Lofted Six',
  'Four',
  'Caught',
  'Bowled',
  'LBW',
  'Run Out',
  'Stumping',
  'Edge to Slip',
  'Misfield',
  'Boundary Save',
  'Leave',
];

const FIELDER_ROLES: { value: FielderRole; label: string }[] = [
  { value: 'bowler', label: 'Bowler' },
  { value: 'wicketkeeper', label: 'Wicketkeeper' },
  { value: 'close-catcher', label: 'Close Catcher' },
  { value: 'infield', label: 'Infield (30-yd)' },
  { value: 'boundary', label: 'Boundary Rider' },
];

export function FieldDesignerModule() {
  const { activeProject, updateFieldDesign, updateActiveProject } = useStudio();
  const fieldDesign = activeProject.fieldDesign;

  const [selectedFielderId, setSelectedFielderId] = useState<string | null>(
    fieldDesign.fielders[0]?.id ?? null
  );
  const [inspectorTab, setInspectorTab] = useState<'fielder' | 'ball' | 'scenes'>('fielder');
  const [newSceneName, setNewSceneName] = useState('');

  // Local ball-path test playback
  const [isPlayingBall, setIsPlayingBall] = useState(false);
  const [ballProgress, setBallProgress] = useState(1);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlayingBall) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      lastFrameRef.current = null;
      return;
    }

    const step = (now: number) => {
      if (lastFrameRef.current === null) {
        lastFrameRef.current = now;
      }
      const dt = (now - lastFrameRef.current) / 1000;
      lastFrameRef.current = now;

      const duration = Math.max(0.8, fieldDesign.ballPath.durationSec);
      setBallProgress((prev) => {
        const next = prev + dt / duration;
        if (next >= 1) {
          setIsPlayingBall(false);
          return 1;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlayingBall, fieldDesign.ballPath.durationSec]);

  const selectedFielder =
    fieldDesign.fielders.find((f) => f.id === selectedFielderId) ??
    fieldDesign.fielders[0] ??
    null;

  const handleMoveFielder = (fielderId: string, point: FieldPoint) => {
    const clamped = clampFieldPoint(point);
    updateFieldDesign((prev) => ({
      ...prev,
      fielders: prev.fielders.map((f) =>
        f.id === fielderId
          ? {
              ...f,
              x: clamped.x,
              y: clamped.y,
              role: inferRoleFromPosition(clamped.x, clamped.y, f.role),
            }
          : f
      ),
    }));
  };

  const handleMoveBallHandle = (handle: BallHandleKey, point: FieldPoint) => {
    const clamped = clampFieldPoint(point);
    updateFieldDesign((prev) => ({
      ...prev,
      ballPath: {
        ...prev.ballPath,
        [handle]: clamped,
      },
    }));
  };

  const updateSelectedFielder = (patch: Partial<FielderPosition>) => {
    if (!selectedFielder) return;
    updateFieldDesign((prev) => ({
      ...prev,
      fielders: prev.fielders.map((f) =>
        f.id === selectedFielder.id ? { ...f, ...patch } : f
      ),
    }));
  };

  const handleAddFielder = () => {
    const nextNum = fieldDesign.fielders.length + 1;
    const newFielder: FielderPosition = {
      id: `f-${Date.now()}`,
      name: `Fielder ${nextNum}`,
      shortLabel: `F${nextNum}`,
      jerseyNumber: nextNum,
      x: 24,
      y: 22,
      role: 'infield',
      highlighted: false,
    };
    updateFieldDesign((prev) => ({
      ...prev,
      fielders: [...prev.fielders, newFielder],
    }));
    setSelectedFielderId(newFielder.id);
    setInspectorTab('fielder');
  };

  const handleRemoveFielder = (id: string) => {
    if (fieldDesign.fielders.length <= 2) return;
    const remaining = fieldDesign.fielders.filter((f) => f.id !== id);
    updateFieldDesign((prev) => ({
      ...prev,
      fielders: remaining,
    }));
    setSelectedFielderId(remaining[0]?.id ?? null);
  };

  const handleApplyPreset = (presetId: string) => {
    const next = cloneFieldDesignFromPreset(presetId);
    updateFieldDesign((prev) => ({
      ...next,
      batterHand: prev.batterHand,
      show30YardCircle: prev.show30YardCircle,
      showZoneLabels: prev.showZoneLabels,
      showGrid: prev.showGrid,
    }));
    setSelectedFielderId(next.fielders[0]?.id ?? null);
    setBallProgress(1);
    setIsPlayingBall(false);
  };

  const handleApplyAnimationPreset = (presetId: string) => {
    updateFieldDesign((prev) => applyBallAnimationPreset(prev, presetId));
    setBallProgress(0);
    setIsPlayingBall(true);
  };

  const handleSaveFieldScene = () => {
    const name =
      newSceneName.trim() ||
      `${fieldDesign.activePresetName} (${fieldDesign.ballPath.deliveryType})`;
    const scene: FieldSceneRecord = {
      id: `fscene-${Date.now().toString(36)}`,
      name,
      createdAt: new Date().toISOString(),
      fieldDesign: JSON.parse(JSON.stringify(fieldDesign)),
      framing: { zoom: 1, panX: 0, panY: 0 },
      overlayIds: [],
    };
    updateActiveProject((prev) => ({
      ...prev,
      fieldScenes: [scene, ...(prev.fieldScenes ?? [])],
    }));
    setNewSceneName('');
  };

  const handleLoadFieldScene = (scene: FieldSceneRecord) => {
    updateFieldDesign(() => JSON.parse(JSON.stringify(scene.fieldDesign)));
    setBallProgress(1);
    setIsPlayingBall(false);
  };

  const handleDuplicateFieldScene = (scene: FieldSceneRecord) => {
    const copy: FieldSceneRecord = {
      ...JSON.parse(JSON.stringify(scene)),
      id: `fscene-${Date.now().toString(36)}`,
      name: `${scene.name} (Copy)`,
      createdAt: new Date().toISOString(),
    };
    updateActiveProject((prev) => ({
      ...prev,
      fieldScenes: [copy, ...(prev.fieldScenes ?? [])],
    }));
  };

  const togglePlayBall = () => {
    if (isPlayingBall) {
      setIsPlayingBall(false);
    } else {
      if (ballProgress >= 0.99) {
        setBallProgress(0);
      }
      setIsPlayingBall(true);
    }
  };

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden">
      {/* Left/Center Interactive Pitch Canvas */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#080E1A]">
        {/* Designer Toolbar */}
        <div className="px-5 py-3 border-b border-slate-800/80 bg-[#0C1426] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="field-preset-select" className="text-xs text-slate-400">
              Field
            </label>
            <select
              id="field-preset-select"
              value={
                FIELD_PRESETS.find((p) => p.name === fieldDesign.activePresetName)?.id ?? ''
              }
              onChange={(e) => {
                if (e.target.value) handleApplyPreset(e.target.value);
              }}
              className="px-2.5 py-1.5 rounded-md bg-[#080E1A] border border-slate-700/80 text-xs text-slate-100 focus:outline-none focus:border-[#D4AF37]"
            >
              {FIELD_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>

            <label htmlFor="anim-preset-select" className="text-xs text-slate-400 ml-1">
              Animation
            </label>
            <select
              id="anim-preset-select"
              value={fieldDesign.ballPath.presetId ?? ''}
              onChange={(e) => {
                if (e.target.value) handleApplyAnimationPreset(e.target.value);
              }}
              className="px-2.5 py-1.5 rounded-md bg-[#080E1A] border border-slate-700/80 text-xs text-[#F4D57A] focus:outline-none focus:border-[#D4AF37]"
            >
              <option value="">23 Cricket Presets...</option>
              {(['Delivery', 'Shot', 'Dismissal', 'Fielding'] as const).map((cat) => (
                <optgroup key={cat} label={cat}>
                  {BALL_ANIMATION_PRESETS.filter((p) => p.category === cat).map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            <div className="h-4 w-px bg-slate-800 mx-1" aria-hidden="true" />

            <div className="flex items-center bg-[#080E1A] rounded-md p-0.5 border border-slate-800">
              <button
                type="button"
                onClick={() =>
                  updateFieldDesign((prev) => ({ ...prev, batterHand: 'right' }))
                }
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                  fieldDesign.batterHand === 'right'
                    ? 'bg-[#172442] text-[#F4D57A]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                RHB
              </button>
              <button
                type="button"
                onClick={() =>
                  updateFieldDesign((prev) => ({ ...prev, batterHand: 'left' }))
                }
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                  fieldDesign.batterHand === 'left'
                    ? 'bg-[#172442] text-[#F4D57A]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                LHB
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                updateFieldDesign((prev) => ({
                  ...prev,
                  show30YardCircle: !prev.show30YardCircle,
                }))
              }
              aria-pressed={fieldDesign.show30YardCircle}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap ${
                fieldDesign.show30YardCircle
                  ? 'bg-[#172442] border-[#D4AF37]/40 text-[#F4D57A]'
                  : 'bg-[#080E1A] border-slate-800 text-slate-400'
              }`}
            >
              30-Yard Ring
            </button>
            <button
              type="button"
              onClick={() =>
                updateFieldDesign((prev) => ({
                  ...prev,
                  showZoneLabels: !prev.showZoneLabels,
                }))
              }
              aria-pressed={fieldDesign.showZoneLabels}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap ${
                fieldDesign.showZoneLabels
                  ? 'bg-[#172442] border-[#D4AF37]/40 text-[#F4D57A]'
                  : 'bg-[#080E1A] border-slate-800 text-slate-400'
              }`}
            >
              Zone Labels
            </button>
            <button
              type="button"
              onClick={() =>
                updateFieldDesign((prev) => ({ ...prev, showGrid: !prev.showGrid }))
              }
              aria-pressed={fieldDesign.showGrid}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap ${
                fieldDesign.showGrid
                  ? 'bg-[#172442] border-[#D4AF37]/40 text-[#F4D57A]'
                  : 'bg-[#080E1A] border-slate-800 text-slate-400'
              }`}
            >
              Grid
            </button>
            <button
              type="button"
              onClick={handleAddFielder}
              className="px-2.5 py-1.5 rounded-md bg-[#131E38] hover:bg-[#1B2B4F] border border-slate-700/80 text-xs font-medium text-slate-200 flex items-center gap-1 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Add Fielder</span>
            </button>
          </div>
        </div>

        {/* Interactive SVG Canvas Area */}
        <div className="flex-1 min-h-0 p-4 flex items-center justify-center overflow-auto">
          <div className="w-full max-w-[600px] aspect-square rounded-xl overflow-hidden border border-slate-800 bg-[#081312] shadow-2xl">
            <CricketFieldSvg
              fieldDesign={fieldDesign}
              interactive
              selectedFielderId={selectedFielder?.id ?? null}
              onSelectFielder={(id) => {
                setSelectedFielderId(id);
                setInspectorTab('fielder');
              }}
              onMoveFielder={handleMoveFielder}
              onMoveBallHandle={handleMoveBallHandle}
              ballProgress={ballProgress}
              className="w-full h-full"
            />
          </div>
        </div>

        {/* Ball Path Animation Transport Bar */}
        <div className="px-5 py-3 border-t border-slate-800/80 bg-[#0C1426] flex items-center gap-4">
          <button
            type="button"
            onClick={togglePlayBall}
            className="px-3.5 py-1.5 rounded-md bg-[#D4AF37] hover:bg-[#E2BE48] text-[#080E1A] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            {isPlayingBall ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause Ball</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Animate Ball</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsPlayingBall(false);
              setBallProgress(0);
            }}
            aria-label="Reset ball path animation"
            className="p-1.5 rounded-md bg-[#131E38] hover:bg-[#1B2B4F] border border-slate-700/80 text-slate-300"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <div className="flex-1 flex items-center gap-3 min-w-0">
            <label htmlFor="ball-scrub" className="text-xs text-slate-400 whitespace-nowrap">
              Ball Progress
            </label>
            <input
              id="ball-scrub"
              type="range"
              min={0}
              max={100}
              value={Math.round(ballProgress * 100)}
              onChange={(e) => {
                setIsPlayingBall(false);
                setBallProgress(Number(e.target.value) / 100);
              }}
              className="flex-1 accent-[#D4AF37]"
            />
            <span className="text-xs font-mono-tabular text-slate-300 w-11 text-right">
              {Math.round(ballProgress * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Right Inspector Sidebar */}
      <aside className="w-full lg:w-[360px] shrink-0 bg-[#0C1426] border-t lg:border-t-0 lg:border-l border-slate-800/80 flex flex-col min-h-0">
        {/* Inspector Tabs */}
        <div className="p-2 border-b border-slate-800/80 grid grid-cols-3 gap-1 bg-[#09101E]">
          <button
            type="button"
            onClick={() => setInspectorTab('fielder')}
            className={`py-2 px-2 rounded-md text-xs font-semibold transition-colors ${
              inspectorTab === 'fielder'
                ? 'bg-[#172442] text-[#F4D57A]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Fielders ({fieldDesign.fielders.length})
          </button>
          <button
            type="button"
            onClick={() => setInspectorTab('ball')}
            className={`py-2 px-2 rounded-md text-xs font-semibold transition-colors ${
              inspectorTab === 'ball'
                ? 'bg-[#172442] text-[#F4D57A]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Ball Path
          </button>
          <button
            type="button"
            onClick={() => setInspectorTab('scenes')}
            className={`py-2 px-2 rounded-md text-xs font-semibold transition-colors ${
              inspectorTab === 'scenes'
                ? 'bg-[#172442] text-[#F4D57A]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Scenes ({activeProject.fieldScenes.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {inspectorTab === 'fielder' && (
            <>
              <div>
                <div className="text-xs font-medium text-slate-400 mb-2">
                  Select Fielder (drag on pitch or edit below)
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {fieldDesign.fielders.map((f) => {
                    const active = selectedFielder?.id === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setSelectedFielderId(f.id)}
                        className={`px-2 py-1.5 rounded text-xs font-mono-tabular font-semibold border transition-colors truncate ${
                          active
                            ? 'bg-[#D4AF37] text-[#080E1A] border-[#D4AF37]'
                            : 'bg-[#080E1A] text-slate-300 border-slate-800 hover:border-slate-600'
                        }`}
                        title={f.name}
                      >
                        {f.shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedFielder && (
                <div className="space-y-4 pt-3 border-t border-slate-800/80">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-display font-semibold text-slate-100">
                        {selectedFielder.name}
                      </div>
                      <div className="text-xs text-[#E5B94C]">
                        Zone:{' '}
                        {classifyFieldingZone(
                          selectedFielder.x,
                          selectedFielder.y,
                          fieldDesign.batterHand
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={fieldDesign.fielders.length <= 2}
                      onClick={() => handleRemoveFielder(selectedFielder.id)}
                      aria-label={`Remove ${selectedFielder.name}`}
                      className="p-2 rounded-md bg-[#080E1A] border border-slate-800 text-slate-400 hover:text-red-400 hover:border-red-500/40 disabled:opacity-40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div>
                    <label
                      htmlFor="fielder-name-input"
                      className="block text-xs font-medium text-slate-300 mb-1"
                    >
                      Position / Player Label
                    </label>
                    <input
                      id="fielder-name-input"
                      type="text"
                      value={selectedFielder.name}
                      onChange={(e) => updateSelectedFielder({ name: e.target.value })}
                      className="w-full px-3 py-2 rounded-md bg-[#080E1A] border border-slate-700/80 text-xs text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="fielder-code-input"
                        className="block text-xs font-medium text-slate-300 mb-1"
                      >
                        Short Code (3 chars)
                      </label>
                      <input
                        id="fielder-code-input"
                        type="text"
                        maxLength={4}
                        value={selectedFielder.shortLabel}
                        onChange={(e) =>
                          updateSelectedFielder({
                            shortLabel: e.target.value.toUpperCase(),
                          })
                        }
                        className="w-full px-3 py-2 rounded-md bg-[#080E1A] border border-slate-700/80 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="fielder-jersey-input"
                        className="block text-xs font-medium text-slate-300 mb-1"
                      >
                        Jersey #
                      </label>
                      <input
                        id="fielder-jersey-input"
                        type="number"
                        min={0}
                        max={999}
                        value={selectedFielder.jerseyNumber}
                        onChange={(e) =>
                          updateSelectedFielder({
                            jerseyNumber: Number(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 rounded-md bg-[#080E1A] border border-slate-700/80 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="fielder-role-select"
                      className="block text-xs font-medium text-slate-300 mb-1"
                    >
                      Fielding Role
                    </label>
                    <select
                      id="fielder-role-select"
                      value={selectedFielder.role}
                      onChange={(e) =>
                        updateSelectedFielder({
                          role: e.target.value as FielderRole,
                        })
                      }
                      className="w-full px-3 py-2 rounded-md bg-[#080E1A] border border-slate-700/80 text-xs text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                    >
                      {FIELDER_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="fielder-x-input"
                        className="block text-xs font-medium text-slate-300 mb-1"
                      >
                        X Coord (-94 to 94)
                      </label>
                      <input
                        id="fielder-x-input"
                        type="number"
                        step={1}
                        min={-94}
                        max={94}
                        value={roundCoord(selectedFielder.x)}
                        onChange={(e) =>
                          handleMoveFielder(selectedFielder.id, {
                            x: Number(e.target.value) || 0,
                            y: selectedFielder.y,
                          })
                        }
                        className="w-full px-3 py-2 rounded-md bg-[#080E1A] border border-slate-700/80 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="fielder-y-input"
                        className="block text-xs font-medium text-slate-300 mb-1"
                      >
                        Y Coord (-94 to 94)
                      </label>
                      <input
                        id="fielder-y-input"
                        type="number"
                        step={1}
                        min={-94}
                        max={94}
                        value={roundCoord(selectedFielder.y)}
                        onChange={(e) =>
                          handleMoveFielder(selectedFielder.id, {
                            x: selectedFielder.x,
                            y: Number(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 rounded-md bg-[#080E1A] border border-slate-700/80 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedFielder.highlighted}
                      onChange={(e) =>
                        updateSelectedFielder({ highlighted: e.target.checked })
                      }
                      className="rounded border-slate-600 accent-[#D4AF37]"
                    />
                    <span className="text-xs text-slate-200">
                      Highlight fielder in broadcast overlay
                    </span>
                  </label>
                </div>
              )}
            </>
          )}

          {inspectorTab === 'ball' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-400">
                Drag <span className="text-sky-400 font-mono-tabular">REL</span>,{' '}
                <span className="text-sky-400 font-mono-tabular">BNC</span>,{' '}
                <span className="text-amber-400 font-mono-tabular">IMP</span>, or{' '}
                <span className="text-[#E5B94C] font-mono-tabular">END</span> handles on the
                pitch or pick from 23 presets.
              </div>

              <div>
                <div className="text-xs font-medium text-slate-300 mb-1.5">
                  23 Cricket Animation Presets
                </div>
                <div className="grid grid-cols-2 gap-1.5 max-h-[160px] overflow-y-auto pr-1">
                  {BALL_ANIMATION_PRESETS.map((preset) => {
                    const active = fieldDesign.ballPath.presetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleApplyAnimationPreset(preset.id)}
                        className={`px-2 py-1.5 rounded text-left text-[11px] font-medium border truncate ${
                          active
                            ? 'bg-[#D4AF37] text-[#080E1A] border-[#D4AF37] font-bold'
                            : 'bg-[#080E1A] text-slate-300 border-slate-800 hover:border-slate-600'
                        }`}
                      >
                        {preset.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="ball-delivery-type"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Delivery Type
                  </label>
                  <select
                    id="ball-delivery-type"
                    value={fieldDesign.ballPath.deliveryType}
                    onChange={(e) =>
                      updateFieldDesign((prev) => ({
                        ...prev,
                        ballPath: {
                          ...prev.ballPath,
                          deliveryType: e.target.value as BallDeliveryType,
                        },
                      }))
                    }
                    className="w-full px-2.5 py-2 rounded-md bg-[#080E1A] border border-slate-700/80 text-xs text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                  >
                    {DELIVERY_TYPES.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="ball-shot-type"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Shot Outcome
                  </label>
                  <select
                    id="ball-shot-type"
                    value={fieldDesign.ballPath.shotType}
                    onChange={(e) =>
                      updateFieldDesign((prev) => ({
                        ...prev,
                        ballPath: {
                          ...prev.ballPath,
                          shotType: e.target.value as ShotType,
                        },
                      }))
                    }
                    className="w-full px-2.5 py-2 rounded-md bg-[#080E1A] border border-slate-700/80 text-xs text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                  >
                    {SHOT_TYPES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="ball-speed-kmh"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Delivery Speed (km/h)
                  </label>
                  <input
                    id="ball-speed-kmh"
                    type="number"
                    min={50}
                    max={165}
                    value={fieldDesign.ballPath.speedKmh}
                    onChange={(e) =>
                      updateFieldDesign((prev) => ({
                        ...prev,
                        ballPath: {
                          ...prev.ballPath,
                          speedKmh: Number(e.target.value) || 120,
                        },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-md bg-[#080E1A] border border-slate-700/80 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="ball-duration-sec"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Animation Duration (s)
                  </label>
                  <input
                    id="ball-duration-sec"
                    type="number"
                    step={0.2}
                    min={1}
                    max={10}
                    value={fieldDesign.ballPath.durationSec}
                    onChange={(e) =>
                      updateFieldDesign((prev) => ({
                        ...prev,
                        ballPath: {
                          ...prev.ballPath,
                          durationSec: Math.max(1, Number(e.target.value) || 3),
                        },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-md bg-[#080E1A] border border-slate-700/80 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                {(
                  [
                    { key: 'release', label: 'Bowler Release' },
                    { key: 'bounce', label: 'Pitch Bounce' },
                    { key: 'impact', label: 'Bat Contact' },
                    { key: 'end', label: 'Shot Destination' },
                  ] as const
                ).map((item) => {
                  const pt = fieldDesign.ballPath[item.key];
                  return (
                    <div
                      key={item.key}
                      className="grid grid-cols-12 items-center gap-2 text-xs"
                    >
                      <span className="col-span-5 text-slate-300">{item.label}</span>
                      <input
                        aria-label={`${item.label} X`}
                        type="number"
                        value={roundCoord(pt.x)}
                        onChange={(e) =>
                          handleMoveBallHandle(item.key, {
                            x: Number(e.target.value) || 0,
                            y: pt.y,
                          })
                        }
                        className="col-span-3 px-2 py-1 rounded bg-[#080E1A] border border-slate-800 font-mono-tabular text-slate-100"
                      />
                      <input
                        aria-label={`${item.label} Y`}
                        type="number"
                        value={roundCoord(pt.y)}
                        onChange={(e) =>
                          handleMoveBallHandle(item.key, {
                            x: pt.x,
                            y: Number(e.target.value) || 0,
                          })
                        }
                        className="col-span-3 px-2 py-1 rounded bg-[#080E1A] border border-slate-800 font-mono-tabular text-slate-100"
                      />
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fieldDesign.ballPath.showTrail}
                    onChange={(e) =>
                      updateFieldDesign((prev) => ({
                        ...prev,
                        ballPath: { ...prev.ballPath, showTrail: e.target.checked },
                      }))
                    }
                    className="accent-[#D4AF37]"
                  />
                  <span className="text-xs text-slate-200">Show trajectory trail line</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fieldDesign.ballPath.showBounceMarker}
                    onChange={(e) =>
                      updateFieldDesign((prev) => ({
                        ...prev,
                        ballPath: {
                          ...prev.ballPath,
                          showBounceMarker: e.target.checked,
                        },
                      }))
                    }
                    className="accent-[#D4AF37]"
                  />
                  <span className="text-xs text-slate-200">Show pitch bounce ring</span>
                </label>
              </div>

              <div className="space-y-2 pt-3 border-t border-slate-800/80">
                <div className="text-xs font-semibold text-slate-300">
                  MP4 Render Field Layer Options
                </div>
                {(
                  [
                    { key: 'showLabels', label: 'Render Fielder Labels' },
                    { key: 'showTrajectoryTrail', label: 'Render Ball Trajectory' },
                    { key: 'showBounceMarker', label: 'Render Bounce Marker' },
                    { key: 'showSpeedGraphic', label: 'Render Speed KM/H Badge' },
                  ] as { key: keyof FieldRenderOptions; label: string }[]
                ).map((opt) => {
                  const currentOpts: FieldRenderOptions =
                    activeProject.fieldRenderOptions ?? {
                      showLabels: true,
                      showTrajectoryTrail: true,
                      showBounceMarker: true,
                      showSpeedGraphic: true,
                    };
                  return (
                    <label key={opt.key} className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentOpts[opt.key]}
                        onChange={(e) =>
                          updateActiveProject((prev) => ({
                            ...prev,
                            fieldRenderOptions: {
                              ...(prev.fieldRenderOptions ?? currentOpts),
                              [opt.key]: e.target.checked,
                            },
                          }))
                        }
                        className="accent-[#D4AF37]"
                      />
                      <span className="text-xs text-slate-300">{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* FIELD SCENE LIBRARY TAB */}
          {inspectorTab === 'scenes' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-200">
                  Save Current Pitch Setup
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSceneName}
                    onChange={(e) => setNewSceneName(e.target.value)}
                    placeholder="e.g. Over 19 Wide Yorker Plan"
                    className="flex-1 px-2.5 py-1.5 rounded bg-[#080E1A] border border-slate-800 text-xs text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={handleSaveFieldScene}
                    className="px-3 py-1.5 rounded bg-[#D4AF37] text-[#080E1A] text-xs font-bold flex items-center gap-1 shrink-0"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t border-slate-800">
                <div className="text-xs font-semibold text-slate-300">
                  Saved Field Scenes ({activeProject.fieldScenes.length})
                </div>
                {activeProject.fieldScenes.map((scene) => (
                  <div
                    key={scene.id}
                    className="p-3 rounded-lg bg-[#080E1A] border border-slate-800 space-y-2"
                  >
                    <input
                      type="text"
                      value={scene.name}
                      onChange={(e) =>
                        updateActiveProject((prev) => ({
                          ...prev,
                          fieldScenes: prev.fieldScenes.map((s) =>
                            s.id === scene.id ? { ...s, name: e.target.value } : s
                          ),
                        }))
                      }
                      className="w-full px-2 py-1 rounded bg-[#0F182D] border border-slate-800 text-xs font-semibold text-slate-100"
                    />
                    <div className="text-[11px] font-mono-tabular text-slate-400">
                      {scene.fieldDesign.ballPath.deliveryType} ·{' '}
                      {scene.fieldDesign.ballPath.shotType} ·{' '}
                      {scene.fieldDesign.fielders.length} fielders
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleLoadFieldScene(scene)}
                        className="px-2.5 py-1 rounded bg-[#172442] text-[#F4D57A] text-[11px] font-semibold flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        <span>Load</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicateFieldScene(scene)}
                        className="p-1.5 rounded bg-[#131E38] text-slate-300"
                        title="Duplicate scene"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      {activeProject.fieldScenes.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            updateActiveProject((prev) => ({
                              ...prev,
                              fieldScenes: prev.fieldScenes.filter((s) => s.id !== scene.id),
                            }))
                          }
                          className="ml-auto p-1.5 rounded bg-[#131E38] text-slate-400 hover:text-red-400"
                          title="Delete scene"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
