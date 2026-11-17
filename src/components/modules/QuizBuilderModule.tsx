import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Check,
  Download,
  Eraser,
  FileUp,
  Plus,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useStudio } from '../../context/StudioContext';
import type { QuizOptionIndex, TimelineClip } from '../../types/studio';
import {
  MAX_QUIZ_QUESTIONS,
  countCompleteQuestions,
  isQuizQuestionComplete,
  sortClips,
} from '../../engine/timeline';
import { CRICKET_SEED_QUESTIONS } from '../../data/seedProjects';
import { createEmptyQuizQuestion } from '../../engine/storage';
import {
  ImportedQuestionRow,
  generateCsvTemplate,
  mergeImportedQuestionsIntoProject,
  parseQuestionsFromCsv,
  parseQuestionsFromJson,
  parseQuestionsFromPasteText,
} from '../../engine/questionImporter';
import {
  AiAssistOutput,
  localAiContentAssistProvider,
} from '../../engine/aiAssist';
import { cloneFieldDesignFromPreset } from '../../engine/cricketField';

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

const QUIZ_CATEGORIES = [
  'Fielding Rules',
  'Fielding Positions',
  'Pitch Laws',
  'Cricket Laws',
  'Bowling Mechanics',
  'Spin Bowling',
  'Batting Technique',
  'World Cup History',
  'World Records',
  'Format Rules',
  'Cricket Basics',
  'Cricket Trivia',
  'Cricket Tactics',
];

export function QuizBuilderModule() {
  const {
    activeProject,
    updateQuizQuestion,
    updateActiveProject,
    selectedQuizIndex,
    setSelectedQuizIndex,
    setActiveModule,
  } = useStudio();

  const [workspaceView, setWorkspaceView] = useState<'editor' | 'importer' | 'ai'>('editor');
  const [filterMode, setFilterMode] = useState<'all' | 'incomplete'>('all');
  const [previewPhase, setPreviewPhase] = useState<'countdown' | 'reveal'>('countdown');

  // Question Importer state
  const [importFormat, setImportFormat] = useState<'csv' | 'paste' | 'json'>('csv');
  const [importRawText, setImportRawText] = useState('');
  const [importMergeMode, setImportMergeMode] = useState<'fill-empty' | 'append' | 'replace'>(
    'fill-empty'
  );
  const [parsedRows, setParsedRows] = useState<ImportedQuestionRow[]>([]);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  // AI Content Assist state
  const [aiSourceText, setAiSourceText] = useState('');
  const [aiResult, setAiResult] = useState<AiAssistOutput | null>(null);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);

  const questions = activeProject.quizQuestions;
  const activeQuestion = questions[selectedQuizIndex] ?? questions[0];
  const completedCount = countCompleteQuestions(questions);

  useEffect(() => {
    if (selectedQuizIndex >= questions.length) {
      setSelectedQuizIndex(Math.max(0, questions.length - 1));
    }
  }, [questions.length, selectedQuizIndex, setSelectedQuizIndex]);

  const visibleSlots = questions.filter((q) =>
    filterMode === 'incomplete' ? !isQuizQuestionComplete(q) : true
  );

  const handleOptionChange = (optIdx: QuizOptionIndex, value: string) => {
    updateQuizQuestion(activeQuestion.index, (prev) => {
      const nextOpts: [string, string, string, string] = [...prev.options] as [
        string,
        string,
        string,
        string,
      ];
      nextOpts[optIdx] = value;
      return { ...prev, options: nextOpts };
    });
  };

  const handleFillRemainingFromBank = () => {
    updateActiveProject((prev) => ({
      ...prev,
      quizQuestions: prev.quizQuestions.map((q, idx) => {
        if (isQuizQuestionComplete(q)) return q;
        const seed = CRICKET_SEED_QUESTIONS[idx % CRICKET_SEED_QUESTIONS.length];
        return {
          ...q,
          prompt: seed.prompt,
          options: [...seed.options],
          correctIndex: seed.correctIndex,
          countdownSec: seed.countdownSec,
          explanation: seed.explanation,
          category: seed.category,
          includeFieldOverlay: Boolean(seed.includeFieldOverlay),
        };
      }),
    }));
  };

  const handleAddQuestionSlot = () => {
    if (questions.length >= MAX_QUIZ_QUESTIONS) return;
    const nextIdx = questions.length;
    updateActiveProject((prev) => ({
      ...prev,
      quizQuestions: [...prev.quizQuestions, createEmptyQuizQuestion(nextIdx)],
    }));
    setSelectedQuizIndex(nextIdx);
  };

  const handleClearCurrentQuestion = () => {
    updateQuizQuestion(activeQuestion.index, (prev) => ({
      ...prev,
      prompt: '',
      options: ['', '', '', ''],
      correctIndex: 0,
      explanation: '',
    }));
  };

  const handleDownloadCsvTemplate = () => {
    const csv = generateCsvTemplate();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'cricket-quiz-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleValidateImport = (textOverride?: string) => {
    const raw = textOverride ?? importRawText;
    const existingPrompts = questions.map((q) => q.prompt).filter(Boolean);
    setImportNotice(null);

    if (importFormat === 'csv') {
      setParsedRows(parseQuestionsFromCsv(raw, existingPrompts));
    } else if (importFormat === 'paste') {
      setParsedRows(parseQuestionsFromPasteText(raw, existingPrompts));
    } else {
      const res = parseQuestionsFromJson(raw, existingPrompts);
      if (res.ok === false) {
        setParsedRows([]);
        setImportNotice(res.error);
      } else {
        setParsedRows(res.rows);
      }
    }
  };

  const handleUploadImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const txt = typeof reader.result === 'string' ? reader.result : '';
      setImportRawText(txt);
      handleValidateImport(txt);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCommitValidImports = () => {
    const validCount = parsedRows.filter((r) => r.isValid).length;
    if (validCount === 0) {
      setImportNotice('No valid rows found to import.');
      return;
    }
    updateActiveProject((prev) => ({
      ...prev,
      quizQuestions: mergeImportedQuestionsIntoProject(
        prev.quizQuestions,
        parsedRows,
        importMergeMode
      ),
    }));
    setImportNotice(`Imported ${validCount} valid question(s) using "${importMergeMode}".`);
    setParsedRows([]);
    setImportRawText('');
    setWorkspaceView('editor');
  };

  const handleFixInvalidRowInline = (rowNumber: number, patch: Partial<ImportedQuestionRow>) => {
    setParsedRows((prev) =>
      prev.map((row) => {
        if (row.rowNumber !== rowNumber) return row;
        const next = { ...row, ...patch };
        const hasPrompt = next.prompt.trim().length > 0;
        const hasAllOpts = next.options.every((o) => o.trim().length > 0);
        const hasCorrect = next.correctIndex !== null;
        const issues: ImportedQuestionRow['issues'] = [];
        if (!hasPrompt || !hasAllOpts) issues.push('missing-option');
        if (!hasCorrect) issues.push('missing-answer');
        if (issues.length === 0) issues.push('valid');
        return {
          ...next,
          issues,
          isValid: issues.length === 1 && issues[0] === 'valid',
        };
      })
    );
  };

  const runAiAssist = async () => {
    const res = await localAiContentAssistProvider.analyzeSourceText(aiSourceText);
    setAiResult(res);
    setAiFeedback(null);
  };

  const handleAddSuggestedQuestion = (idx: number) => {
    if (!aiResult) return;
    const sug = aiResult.suggestedQuestions[idx];
    if (!sug) return;
    updateActiveProject((prev) => {
      const next = [...prev.quizQuestions];
      const emptySlot = next.findIndex((q) => !q.prompt.trim());
      if (emptySlot >= 0) {
        next[emptySlot] = {
          ...next[emptySlot],
          ...sug,
        };
        setSelectedQuizIndex(emptySlot);
      } else if (next.length < MAX_QUIZ_QUESTIONS) {
        const newIdx = next.length;
        next.push({
          id: `q-${newIdx + 1}-${Date.now().toString(36)}`,
          index: newIdx,
          ...sug,
        });
        setSelectedQuizIndex(newIdx);
      }
      return { ...prev, quizQuestions: next };
    });
    setAiFeedback(`Added "${sug.prompt.slice(0, 42)}..." to Quiz Builder.`);
  };

  const handleApplySuggestedOutlineToTimeline = () => {
    if (!aiResult) return;
    let cursor = 0;
    const clips: TimelineClip[] = aiResult.suggestedScenes.map((sc, idx) => {
      const clip: TimelineClip = {
        id: `ai-scene-${Date.now().toString(36)}-${idx}`,
        trackId: sc.type === 'field-scene' ? 'field' : 'video',
        name: sc.title,
        startSec: cursor,
        durationSec: sc.durationSec,
        type: sc.type,
        status: 'draft',
        notes: sc.notes,
      };
      cursor += sc.durationSec;
      return clip;
    });
    updateActiveProject((prev) => ({
      ...prev,
      timelineClips: sortClips(clips),
    }));
    setAiFeedback('Created timeline outline scenes on Timeline.');
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Top Quiz Workspace Mode Bar */}
      <div className="px-5 py-2.5 border-b border-slate-800/80 bg-[#0C1426] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center bg-[#080E1A] p-0.5 rounded-md border border-slate-800">
          <button
            type="button"
            onClick={() => setWorkspaceView('editor')}
            className={`px-3 py-1.5 rounded text-xs font-semibold ${
              workspaceView === 'editor'
                ? 'bg-[#172442] text-[#F4D57A]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Question Editor ({questions.length} slots)
          </button>
          <button
            type="button"
            onClick={() => setWorkspaceView('importer')}
            className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 ${
              workspaceView === 'importer'
                ? 'bg-[#172442] text-[#F4D57A]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileUp className="w-3.5 h-3.5" />
            <span>Question Importer (CSV / Paste / JSON)</span>
          </button>
          <button
            type="button"
            onClick={() => setWorkspaceView('ai')}
            className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 ${
              workspaceView === 'ai'
                ? 'bg-[#172442] text-[#F4D57A]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>AI Content Assist</span>
          </button>
        </div>

        <div className="text-xs font-mono-tabular text-slate-400">
          Ready: <span className="text-[#E5B94C] font-bold">{completedCount}</span> /{' '}
          {questions.length} (Max {MAX_QUIZ_QUESTIONS})
        </div>
      </div>

      {/* QUESTION EDITOR VIEW */}
      {workspaceView === 'editor' && (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
          {/* Left Rail: Episode Bank Navigator (up to 100 questions) */}
          <aside className="w-full lg:w-[272px] shrink-0 bg-[#0C1426] border-b lg:border-b-0 lg:border-r border-slate-800/80 flex flex-col min-h-0">
            <div className="p-4 border-b border-slate-800/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-display font-semibold text-slate-100">
                  Episode Questions
                </h2>
                <span className="text-xs font-mono-tabular text-[#E5B94C]">
                  {completedCount}/{questions.length}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1 p-0.5 bg-[#080E1A] rounded-md border border-slate-800">
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`py-1.5 rounded text-xs font-medium transition-colors ${
                    filterMode === 'all'
                      ? 'bg-[#172442] text-slate-100'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All ({questions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('incomplete')}
                  className={`py-1.5 rounded text-xs font-medium transition-colors ${
                    filterMode === 'incomplete'
                      ? 'bg-[#172442] text-slate-100'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Incomplete ({questions.length - completedCount})
                </button>
              </div>

              <div className="flex gap-1.5">
                {completedCount < questions.length && (
                  <button
                    type="button"
                    onClick={handleFillRemainingFromBank}
                    className="flex-1 py-1.5 px-2 rounded-md bg-[#131E38] hover:bg-[#19284A] border border-slate-700/80 text-[11px] font-medium text-[#F4D57A] flex items-center justify-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Fill Empty</span>
                  </button>
                )}
                {questions.length < MAX_QUIZ_QUESTIONS && (
                  <button
                    type="button"
                    onClick={handleAddQuestionSlot}
                    className="py-1.5 px-2.5 rounded-md bg-[#131E38] hover:bg-[#19284A] border border-slate-700/80 text-[11px] font-medium text-slate-200 flex items-center gap-1"
                    title="Add question slot (up to 100)"
                  >
                    <Plus className="w-3 h-3 text-[#D4AF37]" />
                    <span>+ Slot</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1 max-h-[220px] lg:max-h-none">
              {visibleSlots.length === 0 ? (
                <div className="p-4 text-xs text-slate-400 text-center">
                  All {questions.length} question slots are complete.
                </div>
              ) : (
                visibleSlots.map((q) => {
                  const isSelected = q.index === activeQuestion.index;
                  const complete = isQuizQuestionComplete(q);
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setSelectedQuizIndex(q.index)}
                      aria-current={isSelected ? 'true' : undefined}
                      className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2.5 transition-colors border ${
                        isSelected
                          ? 'bg-[#172442] border-[#D4AF37]/40 text-slate-100'
                          : 'bg-transparent border-transparent hover:bg-[#111B33] text-slate-300'
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded text-[11px] font-mono-tabular font-bold flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-[#D4AF37] text-[#080E1A]'
                            : complete
                            ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-700/40'
                            : 'bg-[#080E1A] text-slate-500 border border-slate-800'
                        }`}
                      >
                        {q.index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium truncate">
                          {q.prompt.trim() || `Question ${q.index + 1} (Empty)`}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono-tabular flex items-center gap-1.5 mt-0.5">
                          <span>{q.countdownSec}s</span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{q.category}</span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Center: Question Form Editor */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#080E1A]">
            <div className="max-w-3xl space-y-5">
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800/80">
                <div>
                  <h2 className="text-base font-display font-semibold text-slate-100">
                    Question {activeQuestion.index + 1} of {questions.length}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Configure prompt, four answer choices, correct option, countdown, and reveal note.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleClearCurrentQuestion}
                  className="px-3 py-1.5 rounded-md bg-[#0F182D] hover:bg-[#16223D] border border-slate-700/80 text-xs text-slate-300 flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>Clear Slot</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <div className="sm:col-span-1">
                  <label
                    htmlFor="quiz-category"
                    className="block text-xs font-medium text-slate-300 mb-1.5 whitespace-nowrap"
                  >
                    Topic Category
                  </label>
                  <select
                    id="quiz-category"
                    value={activeQuestion.category}
                    onChange={(e) =>
                      updateQuizQuestion(activeQuestion.index, (prev) => ({
                        ...prev,
                        category: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#0F182D] border border-slate-700/80 text-xs text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                  >
                    {QUIZ_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="quiz-countdown-sec"
                    className="block text-xs font-medium text-slate-300 mb-1.5 whitespace-nowrap"
                  >
                    Countdown (sec)
                  </label>
                  <input
                    id="quiz-countdown-sec"
                    type="number"
                    min={3}
                    max={30}
                    value={activeQuestion.countdownSec}
                    onChange={(e) =>
                      updateQuizQuestion(activeQuestion.index, (prev) => ({
                        ...prev,
                        countdownSec: Math.max(3, Math.min(30, Number(e.target.value) || 10)),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg bg-[#0F182D] border border-slate-700/80 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeQuestion.includeFieldOverlay}
                      onChange={(e) =>
                        updateQuizQuestion(activeQuestion.index, (prev) => ({
                          ...prev,
                          includeFieldOverlay: e.target.checked,
                        }))
                      }
                      className="accent-[#D4AF37]"
                    />
                    <span className="text-xs text-slate-200">Show Field Backdrop</span>
                  </label>
                </div>
              </div>

              <div>
                <label
                  htmlFor="quiz-prompt-input"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Question Prompt
                </label>
                <textarea
                  id="quiz-prompt-input"
                  rows={3}
                  value={activeQuestion.prompt}
                  onChange={(e) =>
                    updateQuizQuestion(activeQuestion.index, (prev) => ({
                      ...prev,
                      prompt: e.target.value,
                    }))
                  }
                  placeholder="Write the cricket trivia or tactical question..."
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#0F182D] border border-slate-700/80 text-sm text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-300">
                    Answer Options &amp; Correct Selection
                  </span>
                  <span className="text-xs text-[#E5B94C]">
                    Correct: Option {OPTION_LETTERS[activeQuestion.correctIndex]}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {([0, 1, 2, 3] as QuizOptionIndex[]).map((optIdx) => {
                    const letter = OPTION_LETTERS[optIdx];
                    const isCorrect = activeQuestion.correctIndex === optIdx;
                    return (
                      <div
                        key={letter}
                        className={`p-3 rounded-lg border transition-colors ${
                          isCorrect
                            ? 'bg-[#15223D] border-[#D4AF37]/60'
                            : 'bg-[#0F182D] border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <label
                            htmlFor={`quiz-opt-${letter}`}
                            className="text-xs font-mono-tabular font-semibold text-slate-200"
                          >
                            Option {letter}
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              updateQuizQuestion(activeQuestion.index, (prev) => ({
                                ...prev,
                                correctIndex: optIdx,
                              }))
                            }
                            aria-pressed={isCorrect}
                            aria-label={`Mark Option ${letter} as correct answer`}
                            className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                              isCorrect
                                ? 'bg-[#D4AF37] text-[#080E1A]'
                                : 'bg-[#080E1A] text-slate-400 hover:text-slate-100 border border-slate-700'
                            }`}
                          >
                            <Check className="w-3 h-3" />
                            <span>{isCorrect ? 'Correct Answer' : 'Set Correct'}</span>
                          </button>
                        </div>
                        <input
                          id={`quiz-opt-${letter}`}
                          type="text"
                          value={activeQuestion.options[optIdx]}
                          onChange={(e) => handleOptionChange(optIdx, e.target.value)}
                          placeholder={`Enter option ${letter}...`}
                          className="w-full px-3 py-1.5 rounded bg-[#080E1A] border border-slate-700/80 text-xs text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label
                  htmlFor="quiz-explanation-input"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Answer Reveal Explanation
                </label>
                <textarea
                  id="quiz-explanation-input"
                  rows={2}
                  value={activeQuestion.explanation}
                  onChange={(e) =>
                    updateQuizQuestion(activeQuestion.index, (prev) => ({
                      ...prev,
                      explanation: e.target.value,
                    }))
                  }
                  placeholder="Explain why the correct answer is right (displayed on reveal card)..."
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#0F182D] border border-slate-700/80 text-sm text-slate-100 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
            </div>
          </div>

          {/* Right: Live Broadcast Quiz Card Preview */}
          <aside className="w-full xl:w-[360px] shrink-0 bg-[#0C1426] border-t xl:border-t-0 xl:border-l border-slate-800/80 p-5 flex flex-col justify-between gap-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-display font-semibold text-slate-200">
                  Card State Inspector
                </h3>
                <div className="flex items-center bg-[#080E1A] p-0.5 rounded border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setPreviewPhase('countdown')}
                    className={`px-2 py-1 rounded text-[11px] font-medium ${
                      previewPhase === 'countdown'
                        ? 'bg-[#172442] text-[#F4D57A]'
                        : 'text-slate-400'
                    }`}
                  >
                    Countdown
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewPhase('reveal')}
                    className={`px-2 py-1 rounded text-[11px] font-medium ${
                      previewPhase === 'reveal'
                        ? 'bg-[#172442] text-[#F4D57A]'
                        : 'text-slate-400'
                    }`}
                  >
                    Reveal
                  </button>
                </div>
              </div>

              <div className="rounded-xl bg-[#070D19] border border-slate-700/80 p-4 space-y-4">
                <div className="flex items-center justify-between text-[11px] font-mono-tabular text-slate-400">
                  <span>
                    Q{activeQuestion.index + 1} · {activeQuestion.category}
                  </span>
                  <span className="text-[#E5B94C] font-bold">
                    {previewPhase === 'countdown'
                      ? `${activeQuestion.countdownSec}s`
                      : 'ANSWER'}
                  </span>
                </div>

                <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#D4AF37] transition-all"
                    style={{ width: previewPhase === 'countdown' ? '65%' : '100%' }}
                  />
                </div>

                <div className="text-sm font-display font-semibold text-slate-100 leading-snug">
                  {activeQuestion.prompt.trim() || 'Enter a question prompt to preview.'}
                </div>

                <div className="space-y-2">
                  {([0, 1, 2, 3] as QuizOptionIndex[]).map((idx) => {
                    const isWinner =
                      previewPhase === 'reveal' && activeQuestion.correctIndex === idx;
                    return (
                      <div
                        key={idx}
                        className={`px-3 py-2 rounded-md border text-xs flex items-center gap-2 ${
                          isWinner
                            ? 'bg-emerald-950/70 border-emerald-400 text-emerald-100 font-semibold'
                            : 'bg-[#101A30] border-slate-800 text-slate-200'
                        }`}
                      >
                        <span className="font-mono-tabular text-[#E5B94C] font-bold">
                          {OPTION_LETTERS[idx]}.
                        </span>
                        <span className="truncate">
                          {activeQuestion.options[idx].trim() || `Option ${OPTION_LETTERS[idx]}`}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {previewPhase === 'reveal' && activeQuestion.explanation.trim() && (
                  <div className="pt-2 border-t border-slate-800 text-xs text-slate-300 leading-relaxed">
                    {activeQuestion.explanation}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800/80">
              <button
                type="button"
                disabled={activeQuestion.index === 0}
                onClick={() => setSelectedQuizIndex(Math.max(0, activeQuestion.index - 1))}
                className="px-3 py-1.5 rounded-md bg-[#131E38] hover:bg-[#1B2A4D] text-xs text-slate-200 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs font-mono-tabular text-slate-400">
                Slot {activeQuestion.index + 1} / {questions.length}
              </span>
              <button
                type="button"
                disabled={activeQuestion.index === questions.length - 1}
                onClick={() =>
                  setSelectedQuizIndex(Math.min(questions.length - 1, activeQuestion.index + 1))
                }
                className="px-3 py-1.5 rounded-md bg-[#131E38] hover:bg-[#1B2A4D] text-xs text-slate-200 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* QUESTION IMPORTER VIEW */}
      {workspaceView === 'importer' && (
        <div className="flex-1 overflow-y-auto p-6 bg-[#080E1A]">
          <div className="max-w-5xl mx-auto space-y-5">
            <div className="bg-[#0F182D] border border-slate-800/80 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-display font-semibold text-slate-100">
                    Bulk Question Importer (Up to 100 Questions)
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Import via CSV, structured pasted text, or JSON with row-by-row validation.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadCsvTemplate}
                    className="px-3 py-1.5 rounded-md bg-[#131E38] hover:bg-[#1B2B4F] border border-slate-700 text-xs font-semibold text-[#F4D57A] flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download CSV Template</span>
                  </button>
                  <label className="px-3 py-1.5 rounded-md bg-[#D4AF37] text-[#080E1A] text-xs font-bold cursor-pointer flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload File</span>
                    <input
                      type="file"
                      accept=".csv,.txt,.json"
                      onChange={handleUploadImportFile}
                      className="sr-only"
                    />
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center bg-[#080E1A] p-0.5 rounded-md border border-slate-800">
                  {(
                    [
                      { id: 'csv', label: 'CSV' },
                      { id: 'paste', label: 'Paste Text' },
                      { id: 'json', label: 'JSON' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setImportFormat(f.id)}
                      className={`px-3 py-1 rounded text-xs font-semibold ${
                        importFormat === f.id
                          ? 'bg-[#172442] text-[#F4D57A]'
                          : 'text-slate-400'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <select
                  value={importMergeMode}
                  onChange={(e) =>
                    setImportMergeMode(
                      e.target.value as 'fill-empty' | 'append' | 'replace'
                    )
                  }
                  className="px-3 py-1.5 rounded-md bg-[#080E1A] border border-slate-800 text-xs text-slate-200"
                >
                  <option value="fill-empty">Fill Empty Slots First</option>
                  <option value="append">Append to End</option>
                  <option value="replace">Replace Existing Bank</option>
                </select>
              </div>

              <textarea
                rows={6}
                value={importRawText}
                onChange={(e) => setImportRawText(e.target.value)}
                placeholder={
                  importFormat === 'csv'
                    ? 'question,optionA,optionB,optionC,optionD,correct,explanation,category,difficulty'
                    : importFormat === 'paste'
                    ? 'Question text\nA) Option 1\nB) Option 2\nC) Option 3\nD) Option 4\nAnswer: B\nExplanation: ...'
                    : '[{ "prompt": "...", "options": ["...","...","...","..."], "correctIndex": 0 }]'
                }
                className="w-full px-3 py-2 rounded-lg bg-[#080E1A] border border-slate-800 text-xs font-mono-tabular text-slate-100"
              />

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => handleValidateImport()}
                  className="px-4 py-2 rounded-lg bg-[#131E38] hover:bg-[#1B2B4F] border border-slate-700 text-xs font-semibold text-slate-100"
                >
                  Validate Questions
                </button>

                {parsedRows.length > 0 && (
                  <button
                    type="button"
                    onClick={handleCommitValidImports}
                    className="px-4 py-2 rounded-lg bg-[#D4AF37] hover:bg-[#E2BE48] text-[#080E1A] text-xs font-bold"
                  >
                    Import Valid Only ({parsedRows.filter((r) => r.isValid).length} /{' '}
                    {parsedRows.length})
                  </button>
                )}
              </div>

              {importNotice && (
                <div className="p-3 rounded-lg bg-[#080E1A] border border-slate-800 text-xs text-amber-300">
                  {importNotice}
                </div>
              )}
            </div>

            {parsedRows.length > 0 && (
              <div className="bg-[#0F182D] border border-slate-800/80 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-display font-semibold text-slate-100">
                  Validation Results ({parsedRows.filter((r) => r.isValid).length} valid,{' '}
                  {parsedRows.filter((r) => !r.isValid).length} need attention)
                </h3>
                <div className="space-y-2.5">
                  {parsedRows.map((row) => (
                    <div
                      key={row.rowNumber}
                      className={`p-3 rounded-lg border space-y-2 ${
                        row.isValid
                          ? 'bg-[#080E1A] border-emerald-700/40'
                          : 'bg-amber-950/20 border-amber-500/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-mono-tabular text-slate-400">
                          Row {row.rowNumber}
                        </span>
                        <span
                          className={`font-semibold flex items-center gap-1 ${
                            row.isValid ? 'text-emerald-400' : 'text-amber-300'
                          }`}
                        >
                          {!row.isValid && <AlertTriangle className="w-3.5 h-3.5" />}
                          <span>{row.issues.join(', ')}</span>
                        </span>
                      </div>

                      <input
                        type="text"
                        value={row.prompt}
                        onChange={(e) =>
                          handleFixInvalidRowInline(row.rowNumber, { prompt: e.target.value })
                        }
                        placeholder="Fix question prompt..."
                        className="w-full px-2.5 py-1.5 rounded bg-[#0F182D] border border-slate-800 text-xs text-slate-100"
                      />

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {([0, 1, 2, 3] as const).map((i) => (
                          <input
                            key={i}
                            type="text"
                            value={row.options[i]}
                            onChange={(e) => {
                              const nextOpts: [string, string, string, string] = [
                                ...row.options,
                              ] as [string, string, string, string];
                              nextOpts[i] = e.target.value;
                              handleFixInvalidRowInline(row.rowNumber, { options: nextOpts });
                            }}
                            placeholder={`Opt ${OPTION_LETTERS[i]}`}
                            className="px-2 py-1 rounded bg-[#0F182D] border border-slate-800 text-[11px] text-slate-100"
                          />
                        ))}
                        <select
                          value={row.correctIndex ?? ''}
                          onChange={(e) =>
                            handleFixInvalidRowInline(row.rowNumber, {
                              correctIndex:
                                e.target.value === ''
                                  ? null
                                  : (Number(e.target.value) as QuizOptionIndex),
                            })
                          }
                          className="px-2 py-1 rounded bg-[#0F182D] border border-slate-800 text-[11px] text-slate-100"
                        >
                          <option value="">Correct?</option>
                          <option value="0">A</option>
                          <option value="1">B</option>
                          <option value="2">C</option>
                          <option value="3">D</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI CONTENT ASSIST VIEW (Local Deterministic Provider) */}
      {workspaceView === 'ai' && (
        <div className="flex-1 overflow-y-auto p-6 bg-[#080E1A]">
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
            <section className="lg:col-span-5 bg-[#0F182D] border border-slate-800/80 rounded-xl p-5 space-y-4">
              <div>
                <h2 className="text-base font-display font-semibold text-slate-100">
                  AI Content Assist (Script Prep)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Paste match notes, commentary, articles, or stats to extract beats, quiz questions, field setups, and timeline outlines locally.
                </p>
              </div>

              <textarea
                rows={11}
                value={aiSourceText}
                onChange={(e) => setAiSourceText(e.target.value)}
                placeholder="Paste cricket commentary, match stats, powerplay notes, or YouTube script..."
                className="w-full px-3 py-2.5 rounded-lg bg-[#080E1A] border border-slate-800 text-xs text-slate-100"
              />

              <button
                type="button"
                onClick={runAiAssist}
                className="w-full py-2.5 px-4 rounded-lg bg-[#D4AF37] hover:bg-[#E2BE48] text-[#080E1A] text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Analyze &amp; Suggest Production Beats</span>
              </button>

              {aiFeedback && (
                <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-500/40 text-xs text-emerald-200">
                  {aiFeedback}
                </div>
              )}
            </section>

            <section className="lg:col-span-7 space-y-4">
              {!aiResult ? (
                <div className="bg-[#0F182D] border border-slate-800/80 rounded-xl p-10 text-center text-xs text-slate-400">
                  Paste notes on the left and click &ldquo;Analyze &amp; Suggest Production Beats&rdquo;.
                </div>
              ) : (
                <>
                  <div className="bg-[#0F182D] border border-slate-800/80 rounded-xl p-4 space-y-2">
                    <h3 className="text-xs font-bold text-[#F4D57A] uppercase">
                      Extracted Key Points
                    </h3>
                    <ul className="space-y-1.5 text-xs text-slate-200 list-disc pl-4">
                      {aiResult.keyPoints.map((pt, i) => (
                        <li key={i}>{pt}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-[#0F182D] border border-slate-800/80 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-[#F4D57A] uppercase">
                        Suggested Field Diagram
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          const nextField = cloneFieldDesignFromPreset(
                            aiResult.suggestedFieldPresetId
                          );
                          updateActiveProject((prev) => ({
                            ...prev,
                            fieldDesign: nextField,
                          }));
                          setActiveModule('field');
                        }}
                        className="px-2.5 py-1 rounded bg-[#D4AF37] text-[#080E1A] text-[11px] font-bold"
                      >
                        Apply &amp; Open Field
                      </button>
                    </div>
                    <p className="text-xs text-slate-300">{aiResult.suggestedFieldReason}</p>
                  </div>

                  <div className="bg-[#0F182D] border border-slate-800/80 rounded-xl p-4 space-y-3">
                    <h3 className="text-xs font-bold text-[#F4D57A] uppercase">
                      Suggested Quiz Questions
                    </h3>
                    {aiResult.suggestedQuestions.map((sq, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg bg-[#080E1A] border border-slate-800 flex items-start justify-between gap-3"
                      >
                        <div className="text-xs text-slate-200">
                          <div className="font-semibold">{sq.prompt}</div>
                          <div className="text-[11px] text-slate-400 mt-1">
                            Answer: {sq.options[sq.correctIndex]}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddSuggestedQuestion(idx)}
                          className="px-2.5 py-1 rounded bg-[#172442] text-[#F4D57A] text-[11px] font-semibold shrink-0"
                        >
                          + Add to Quiz
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="bg-[#0F182D] border border-slate-800/80 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-[#F4D57A] uppercase">
                        Suggested Timeline Outline
                      </h3>
                      <button
                        type="button"
                        onClick={handleApplySuggestedOutlineToTimeline}
                        className="px-2.5 py-1 rounded bg-[#172442] text-[#F4D57A] text-[11px] font-semibold"
                      >
                        Create Timeline Outline
                      </button>
                    </div>
                    <div className="space-y-1 text-xs font-mono-tabular text-slate-300">
                      {aiResult.timelineOutline.map((line, i) => (
                        <div key={i}>{line}</div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
