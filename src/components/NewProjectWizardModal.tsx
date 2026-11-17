import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import { useStudio } from '../context/StudioContext';
import type {
  AspectRatio,
  ContentType,
  ProjectTemplateType,
} from '../types/studio';
import { CRICKET_SEED_QUESTIONS } from '../data/seedProjects';
import { DEFAULT_BRAND_PRESETS } from '../engine/brandDefaults';

const CONTENT_TYPES: { id: ContentType; label: string; desc: string }[] = [
  { id: 'quiz', label: 'Quiz Video', desc: 'Interactive countdown trivia & explanations' },
  { id: 'field-analysis', label: 'Field Analysis', desc: 'Tactical fielding placements & ball arcs' },
  { id: 'match-breakdown', label: 'Match Breakdown', desc: 'Over-by-over momentum & key moments' },
  { id: 'player-analysis', label: 'Player Analysis', desc: 'Strengths, release points & scoring zones' },
  { id: 'cricket-explainer', label: 'Cricket Explainer', desc: 'Concept walkthrough with visual boards' },
  { id: 'rules-explainer', label: 'Rules Explainer', desc: 'ICC playing conditions & law breakdowns' },
  { id: 'short-reel', label: 'Short / Reel', desc: 'Fast-paced 9:16 vertical broadcast cut' },
  { id: 'custom', label: 'Custom Project', desc: 'Start with flexible custom settings' },
];

const FORMAT_OPTIONS: {
  id: AspectRatio;
  label: string;
  resolution: string;
  desc: string;
}[] = [
  {
    id: '16:9',
    label: 'YouTube Landscape',
    resolution: '1920 × 1080',
    desc: 'Standard horizontal broadcast widescreen',
  },
  {
    id: '9:16',
    label: 'YouTube Shorts',
    resolution: '1080 × 1920',
    desc: 'Vertical Shorts / Reels framing',
  },
  {
    id: '1:1',
    label: 'Square',
    resolution: '1080 × 1080',
    desc: 'Feed square format',
  },
];

const TEMPLATES: { id: ProjectTemplateType; label: string; desc: string }[] = [
  { id: 'blank', label: 'Blank', desc: 'Empty 30-question slots & clean field' },
  { id: 'quiz-30', label: 'Quiz 30 Questions', desc: 'Pre-seeded 30-question cricket bank' },
  { id: 'quiz-10', label: 'Quiz 10 Questions', desc: 'Focused 10-question rapid episode' },
  { id: 'powerplay-breakdown', label: 'Powerplay Breakdown', desc: '2-slip powerplay ring + outswinger arc' },
  { id: 'death-overs-analysis', label: 'Death Overs Analysis', desc: '5 boundary riders + wide yorker plan' },
  { id: 'field-placement-explanation', label: 'Field Placement Explanation', desc: '3-slip red-ball cordon diagram' },
  { id: 'player-technique-breakdown', label: 'Player Technique Breakdown', desc: 'Shot-making trajectory & scoring angles' },
  { id: 'custom', label: 'Custom', desc: 'Balanced setup for manual editing' },
];

export function NewProjectWizardModal() {
  const { wizardOpen, setWizardOpen, workspace, createWizardProject } = useStudio();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [contentType, setContentType] = useState<ContentType>('quiz');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [selectedBrandId, setSelectedBrandId] = useState<string>(
    workspace.brandPresets?.[0]?.id ?? DEFAULT_BRAND_PRESETS[0].id
  );
  const [title, setTitle] = useState('');
  const [seriesName, setSeriesName] = useState('Cricket Creator Series');
  const [episodeNumber, setEpisodeNumber] = useState('01');
  const [description, setDescription] = useState('');
  const [targetPlatform, setTargetPlatform] = useState<
    'YouTube' | 'YouTube Shorts' | 'Instagram Reels' | 'Multi-Platform'
  >('YouTube');
  const [fps, setFps] = useState<30 | 60>(30);
  const [templateType, setTemplateType] = useState<ProjectTemplateType>('quiz-30');
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!wizardOpen) return null;

  const brandPresets = workspace.brandPresets ?? DEFAULT_BRAND_PRESETS;
  const chosenBrand =
    brandPresets.find((b) => b.id === selectedBrandId) ?? brandPresets[0];

  const handleFinish = () => {
    const resolvedTitle = title.trim() || `Episode ${episodeNumber}: ${CONTENT_TYPES.find((c) => c.id === contentType)?.label}`;
    const seedQuestions =
      templateType === 'quiz-30'
        ? CRICKET_SEED_QUESTIONS.map((q, idx) => ({ ...q, id: `wiz-q-${idx + 1}`, index: idx }))
        : templateType === 'quiz-10'
        ? CRICKET_SEED_QUESTIONS.slice(0, 10).map((q, idx) => ({
            ...q,
            id: `wiz-q-${idx + 1}`,
            index: idx,
          }))
        : undefined;

    createWizardProject({
      title: resolvedTitle,
      contentType,
      aspectRatio,
      brandPreset: chosenBrand,
      seriesName,
      episodeNumber,
      description,
      targetPlatform,
      fps,
      templateType,
      seedQuestions,
    });
    setStep(1);
    setTitle('');
    setDescription('');
    setValidationError(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wizard-dialog-title"
    >
      <div className="w-full max-w-3xl bg-[#0C1426] border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-4">
          <div>
            <h2 id="wizard-dialog-title" className="text-base font-display font-bold text-slate-100">
              New Episode Project Wizard
            </h2>
            <p className="text-xs text-slate-400 font-mono-tabular mt-0.5">
              Step {step} of 5 ·{' '}
              {step === 1
                ? 'Content Type'
                : step === 2
                ? 'Format'
                : step === 3
                ? 'Brand Preset'
                : step === 4
                ? 'Project Details'
                : 'Starting Template'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setWizardOpen(false)}
            aria-label="Close New Project Wizard"
            className="p-1.5 rounded-md bg-[#131E38] hover:bg-[#1B2B4F] text-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stepper Indicator */}
        <div className="px-6 py-2.5 bg-[#09101E] border-b border-slate-800/80 grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => setStep(num as 1 | 2 | 3 | 4 | 5)}
              className={`py-1.5 px-2 rounded text-[11px] font-mono-tabular font-semibold transition-colors ${
                step === num
                  ? 'bg-[#D4AF37] text-[#080E1A]'
                  : step > num
                  ? 'bg-[#172442] text-[#E5B94C]'
                  : 'bg-[#0F182D] text-slate-400'
              }`}
            >
              0{num}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {step === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CONTENT_TYPES.map((ct) => {
                const active = contentType === ct.id;
                return (
                  <button
                    key={ct.id}
                    type="button"
                    onClick={() => setContentType(ct.id)}
                    className={`p-3.5 rounded-lg border text-left transition-colors ${
                      active
                        ? 'bg-[#172442] border-[#D4AF37] text-slate-100'
                        : 'bg-[#080E1A] border-slate-800 hover:border-slate-600 text-slate-300'
                    }`}
                  >
                    <div className="text-sm font-display font-semibold">{ct.label}</div>
                    <div className="text-xs text-slate-400 mt-1">{ct.desc}</div>
                  </button>
                );
              })}
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {FORMAT_OPTIONS.map((fmt) => {
                const active = aspectRatio === fmt.id;
                return (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => {
                      setAspectRatio(fmt.id);
                      if (fmt.id === '9:16') setTargetPlatform('YouTube Shorts');
                    }}
                    className={`p-4 rounded-lg border text-left transition-colors flex flex-col justify-between ${
                      active
                        ? 'bg-[#172442] border-[#D4AF37] text-slate-100'
                        : 'bg-[#080E1A] border-slate-800 hover:border-slate-600 text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="text-lg font-display font-bold text-[#E5B94C] font-mono-tabular">
                        {fmt.id}
                      </div>
                      <div className="text-sm font-semibold mt-1">{fmt.label}</div>
                      <div className="text-xs text-slate-400 mt-1">{fmt.desc}</div>
                    </div>
                    <div className="text-[11px] font-mono-tabular text-slate-400 mt-4 pt-2 border-t border-slate-800">
                      {fmt.resolution}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {brandPresets.map((bp) => {
                  const active = selectedBrandId === bp.id;
                  return (
                    <button
                      key={bp.id}
                      type="button"
                      onClick={() => setSelectedBrandId(bp.id)}
                      className={`p-4 rounded-lg border text-left transition-colors ${
                        active
                          ? 'bg-[#172442] border-[#D4AF37] text-slate-100'
                          : 'bg-[#080E1A] border-slate-800 hover:border-slate-600 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-display font-semibold">{bp.name}</span>
                        <span
                          className="w-4 h-4 rounded-sm border border-white/20"
                          style={{ backgroundColor: bp.accentColor }}
                        />
                      </div>
                      <div className="text-xs text-slate-400 mt-1">{bp.youtubeHandle}</div>
                      <div className="text-[11px] text-slate-400 mt-2 truncate">{bp.ctaText}</div>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400">
                You can customize or add brand presets anytime in Brand Studio.
              </p>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="wiz-episode-title"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Episode Title
                </label>
                <input
                  id="wiz-episode-title"
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setValidationError(null);
                  }}
                  placeholder="e.g. Ep 16: Ultimate World Cup Fielding Quiz"
                  className="w-full px-3.5 py-2 rounded-lg bg-[#080E1A] border border-slate-700/80 text-sm text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                />
                {validationError && (
                  <p className="text-xs text-red-400 mt-1">{validationError}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="wiz-series-name"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Series Name
                  </label>
                  <input
                    id="wiz-series-name"
                    type="text"
                    value={seriesName}
                    onChange={(e) => setSeriesName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#080E1A] border border-slate-700/80 text-xs text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="wiz-episode-num"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Episode #
                  </label>
                  <input
                    id="wiz-episode-num"
                    type="text"
                    value={episodeNumber}
                    onChange={(e) => setEpisodeNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#080E1A] border border-slate-700/80 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="wiz-description"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Episode Description
                </label>
                <textarea
                  id="wiz-description"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief episode goal or tactical theme..."
                  className="w-full px-3 py-2 rounded-lg bg-[#080E1A] border border-slate-700/80 text-xs text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="wiz-platform"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Target Platform
                  </label>
                  <select
                    id="wiz-platform"
                    value={targetPlatform}
                    onChange={(e) =>
                      setTargetPlatform(
                        e.target.value as
                          | 'YouTube'
                          | 'YouTube Shorts'
                          | 'Instagram Reels'
                          | 'Multi-Platform'
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#080E1A] border border-slate-700/80 text-xs text-slate-100"
                  >
                    <option value="YouTube">YouTube</option>
                    <option value="YouTube Shorts">YouTube Shorts</option>
                    <option value="Instagram Reels">Instagram Reels</option>
                    <option value="Multi-Platform">Multi-Platform</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="wiz-fps"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Frame Rate
                  </label>
                  <select
                    id="wiz-fps"
                    value={fps}
                    onChange={(e) => setFps(Number(e.target.value) === 60 ? 60 : 30)}
                    className="w-full px-3 py-2 rounded-lg bg-[#080E1A] border border-slate-700/80 text-xs text-slate-100"
                  >
                    <option value={30}>30 fps</option>
                    <option value={60}>60 fps</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="wiz-aspect-confirm"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Aspect Ratio
                  </label>
                  <select
                    id="wiz-aspect-confirm"
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                    className="w-full px-3 py-2 rounded-lg bg-[#080E1A] border border-slate-700/80 text-xs text-slate-100"
                  >
                    <option value="16:9">16:9 Landscape</option>
                    <option value="9:16">9:16 Portrait</option>
                    <option value="1:1">1:1 Square</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TEMPLATES.map((tpl) => {
                const active = templateType === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setTemplateType(tpl.id)}
                    className={`p-3.5 rounded-lg border text-left transition-colors ${
                      active
                        ? 'bg-[#172442] border-[#D4AF37] text-slate-100'
                        : 'bg-[#080E1A] border-slate-800 hover:border-slate-600 text-slate-300'
                    }`}
                  >
                    <div className="text-sm font-display font-semibold">{tpl.label}</div>
                    <div className="text-xs text-slate-400 mt-1">{tpl.desc}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-[#09101E] flex items-center justify-between gap-4">
          <button
            type="button"
            disabled={step === 1}
            onClick={() => setStep((s) => Math.max(1, s - 1) as 1 | 2 | 3 | 4 | 5)}
            className="px-3.5 py-2 rounded-md bg-[#131E38] hover:bg-[#1B2B4F] text-xs font-medium text-slate-200 flex items-center gap-1.5 disabled:opacity-40"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          {step < 5 ? (
            <button
              type="button"
              onClick={() => {
                if (step === 4 && !title.trim()) {
                  setValidationError('Enter an episode title to continue.');
                  return;
                }
                setStep((s) => Math.min(5, s + 1) as 1 | 2 | 3 | 4 | 5);
              }}
              className="px-4 py-2 rounded-md bg-[#D4AF37] hover:bg-[#E2BE48] text-[#080E1A] text-xs font-bold flex items-center gap-1.5"
            >
              <span>Next Step</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              className="px-4 py-2 rounded-md bg-[#D4AF37] hover:bg-[#E2BE48] text-[#080E1A] text-xs font-bold flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Create &amp; Open Workspace</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
