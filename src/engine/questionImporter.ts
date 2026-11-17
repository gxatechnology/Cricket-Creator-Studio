import type {
  QuizDifficulty,
  QuizOptionIndex,
  QuizQuestion,
} from '../types/studio';
import { MAX_QUIZ_QUESTIONS } from './timeline';

export type QuestionValidationIssue =
  | 'valid'
  | 'missing-answer'
  | 'missing-option'
  | 'duplicate-question'
  | 'invalid-correct-answer';

export interface ImportedQuestionRow {
  rowNumber: number;
  prompt: string;
  options: [string, string, string, string];
  correctIndex: QuizOptionIndex | null;
  explanation: string;
  category: string;
  difficulty: QuizDifficulty;
  countdownSec: number;
  issues: QuestionValidationIssue[];
  isValid: boolean;
}

export const CSV_TEMPLATE_HEADER =
  'question,optionA,optionB,optionC,optionD,correct,explanation,category,difficulty';

export function generateCsvTemplate(): string {
  return [
    CSV_TEMPLATE_HEADER,
    '"What is the length of a standard cricket pitch?","20 yards","22 yards","24 yards","18 yards","B","A regulation cricket pitch measures 22 yards from stump to stump.","Pitch Laws","easy"',
    '"How many fielders are allowed outside the 30-yard circle during ODI Powerplay 1?","2","3","4","5","A","Only 2 fielders can patrol the outfield during overs 1-10 in ODIs.","Fielding Rules","medium"',
  ].join('\n');
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCorrectToken(raw: string | number | undefined): QuizOptionIndex | null {
  if (typeof raw === 'number') {
    if (raw === 0 || raw === 1 || raw === 2 || raw === 3) return raw;
    if (raw === 1 || raw === 2 || raw === 3 || raw === 4) return (raw - 1) as QuizOptionIndex;
    return null;
  }
  const normalized = String(raw ?? '').trim().toUpperCase();
  if (normalized === 'A' || normalized === '0' || normalized === '1') return 0;
  if (normalized === 'B' || normalized === '2') return 1;
  if (normalized === 'C' || normalized === '3') return 2;
  if (normalized === 'D' || normalized === '4') return 3;
  return null;
}

function validateRow(
  rowNumber: number,
  prompt: string,
  options: [string, string, string, string],
  correctRaw: string | number | undefined,
  explanation: string,
  category: string,
  difficultyRaw: string | undefined,
  seenPrompts: Set<string>
): ImportedQuestionRow {
  const issues: QuestionValidationIssue[] = [];
  const trimmedPrompt = prompt.trim();
  const normalizedKey = trimmedPrompt.toLowerCase();

  if (!trimmedPrompt) {
    issues.push('missing-option');
  } else if (seenPrompts.has(normalizedKey)) {
    issues.push('duplicate-question');
  } else {
    seenPrompts.add(normalizedKey);
  }

  if (options.some((opt) => opt.trim().length === 0)) {
    if (!issues.includes('missing-option')) {
      issues.push('missing-option');
    }
  }

  let correctIndex: QuizOptionIndex | null = null;
  if (String(correctRaw ?? '').trim() === '') {
    issues.push('missing-answer');
  } else {
    correctIndex = parseCorrectToken(correctRaw);
    if (correctIndex === null) {
      issues.push('invalid-correct-answer');
    }
  }

  const diffLower = (difficultyRaw ?? '').trim().toLowerCase();
  const difficulty: QuizDifficulty =
    diffLower === 'easy' || diffLower === 'hard' ? diffLower : 'medium';

  if (issues.length === 0) {
    issues.push('valid');
  }

  return {
    rowNumber,
    prompt: trimmedPrompt,
    options: [
      options[0].trim(),
      options[1].trim(),
      options[2].trim(),
      options[3].trim(),
    ],
    correctIndex,
    explanation: explanation.trim(),
    category: category.trim() || 'Cricket Trivia',
    difficulty,
    countdownSec: 10,
    issues,
    isValid: issues.length === 1 && issues[0] === 'valid',
  };
}

export function parseQuestionsFromCsv(
  csvText: string,
  existingPrompts: string[] = []
): ImportedQuestionRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const seen = new Set(existingPrompts.map((p) => p.trim().toLowerCase()).filter(Boolean));
  const firstCols = parseCsvLine(lines[0]).map((c) => c.toLowerCase());
  const hasHeader =
    firstCols[0]?.includes('question') || firstCols[1]?.includes('optiona');
  const startIdx = hasHeader ? 1 : 0;

  const rows: ImportedQuestionRow[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    rows.push(
      validateRow(
        i + 1,
        cols[0] ?? '',
        [cols[1] ?? '', cols[2] ?? '', cols[3] ?? '', cols[4] ?? ''],
        cols[5],
        cols[6] ?? '',
        cols[7] ?? 'Cricket Trivia',
        cols[8],
        seen
      )
    );
  }
  return rows;
}

/**
 * Supports structured pasted blocks separated by blank lines:
 * Question line
 * A) Option 1
 * B) Option 2
 * C) Option 3
 * D) Option 4
 * Answer: B
 * Explanation: ...
 */
export function parseQuestionsFromPasteText(
  rawText: string,
  existingPrompts: string[] = []
): ImportedQuestionRow[] {
  const blocks = rawText
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  const seen = new Set(existingPrompts.map((p) => p.trim().toLowerCase()).filter(Boolean));

  return blocks.map((block, idx) => {
    const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let prompt = '';
    const opts: [string, string, string, string] = ['', '', '', ''];
    let correctRaw = '';
    let explanation = '';
    let category = 'Cricket Trivia';

    for (const line of lines) {
      if (/^A[\).\:\-]\s*/i.test(line)) {
        opts[0] = line.replace(/^A[\).\:\-]\s*/i, '');
      } else if (/^B[\).\:\-]\s*/i.test(line)) {
        opts[1] = line.replace(/^B[\).\:\-]\s*/i, '');
      } else if (/^C[\).\:\-]\s*/i.test(line)) {
        opts[2] = line.replace(/^C[\).\:\-]\s*/i, '');
      } else if (/^D[\).\:\-]\s*/i.test(line)) {
        opts[3] = line.replace(/^D[\).\:\-]\s*/i, '');
      } else if (/^(Answer|Correct)\s*:\s*/i.test(line)) {
        correctRaw = line.replace(/^(Answer|Correct)\s*:\s*/i, '');
      } else if (/^Explanation\s*:\s*/i.test(line)) {
        explanation = line.replace(/^Explanation\s*:\s*/i, '');
      } else if (/^Category\s*:\s*/i.test(line)) {
        category = line.replace(/^Category\s*:\s*/i, '');
      } else if (!prompt) {
        prompt = line.replace(/^\d+[\).\:\-]\s*/, '');
      }
    }

    return validateRow(
      idx + 1,
      prompt,
      opts,
      correctRaw,
      explanation,
      category,
      'medium',
      seen
    );
  });
}

export function parseQuestionsFromJson(
  jsonText: string,
  existingPrompts: string[] = []
): { ok: true; rows: ImportedQuestionRow[] } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(jsonText);
    const items = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.questions)
      ? parsed.questions
      : Array.isArray(parsed?.quizQuestions)
      ? parsed.quizQuestions
      : null;
    if (!items) {
      return {
        ok: false,
        error: 'JSON must be an array of questions or an object with a "questions" array.',
      };
    }

    const seen = new Set(existingPrompts.map((p) => p.trim().toLowerCase()).filter(Boolean));
    const rows: ImportedQuestionRow[] = items.map((item: Record<string, unknown>, idx: number) => {
      const optsRaw = Array.isArray(item.options)
        ? item.options
        : [item.optionA, item.optionB, item.optionC, item.optionD];
      return validateRow(
        idx + 1,
        String(item.prompt ?? item.question ?? ''),
        [
          String(optsRaw[0] ?? ''),
          String(optsRaw[1] ?? ''),
          String(optsRaw[2] ?? ''),
          String(optsRaw[3] ?? ''),
        ],
        (item.correctIndex ?? item.correct ?? item.answer) as string | number | undefined,
        String(item.explanation ?? ''),
        String(item.category ?? 'Cricket Trivia'),
        String(item.difficulty ?? 'medium'),
        seen
      );
    });

    return { ok: true, rows };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Invalid JSON syntax.',
    };
  }
}

export function mergeImportedQuestionsIntoProject(
  existing: QuizQuestion[],
  imported: ImportedQuestionRow[],
  mode: 'fill-empty' | 'append' | 'replace'
): QuizQuestion[] {
  const validRows = imported.filter((r) => r.isValid && r.correctIndex !== null);
  const toQuestion = (row: ImportedQuestionRow, index: number): QuizQuestion => ({
    id: `q-${index + 1}-${Date.now().toString(36)}`,
    index,
    prompt: row.prompt,
    options: [...row.options],
    correctIndex: row.correctIndex ?? 0,
    countdownSec: row.countdownSec,
    explanation: row.explanation,
    category: row.category,
    difficulty: row.difficulty,
    includeFieldOverlay: false,
  });

  if (mode === 'replace') {
    const capped = validRows.slice(0, MAX_QUIZ_QUESTIONS);
    const result = capped.map((row, idx) => toQuestion(row, idx));
    return result;
  }

  const next = existing.map((q) => ({ ...q }));
  let rowCursor = 0;

  if (mode === 'fill-empty') {
    for (let i = 0; i < next.length && rowCursor < validRows.length; i++) {
      if (!next[i].prompt.trim()) {
        next[i] = toQuestion(validRows[rowCursor], i);
        rowCursor++;
      }
    }
  }

  while (rowCursor < validRows.length && next.length < MAX_QUIZ_QUESTIONS) {
    const idx = next.length;
    next.push(toQuestion(validRows[rowCursor], idx));
    rowCursor++;
  }

  return next.slice(0, MAX_QUIZ_QUESTIONS).map((q, idx) => ({ ...q, index: idx }));
}
