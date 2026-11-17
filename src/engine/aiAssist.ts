import type {
  QuizQuestion,
  TimelineClip,
} from '../types/studio';
import { BALL_ANIMATION_PRESETS } from './cricketField';

export interface AiSuggestedScene {
  title: string;
  durationSec: number;
  type: TimelineClip['type'];
  notes: string;
}

export interface AiAssistOutput {
  keyPoints: string[];
  suggestedScenes: AiSuggestedScene[];
  suggestedQuestions: Omit<QuizQuestion, 'id' | 'index'>[];
  suggestedFieldPresetId: string;
  suggestedFieldReason: string;
  timelineOutline: string[];
}

/**
 * Clean abstraction for future external LLM/API integration (Phase 3+).
 * Currently uses deterministic local text analysis without any API keys.
 */
export interface AiContentAssistProvider {
  analyzeSourceText(sourceText: string): Promise<AiAssistOutput> | AiAssistOutput;
}

export function extractKeyPoints(rawText: string): string[] {
  const sentences = rawText
    .split(/(?<=[.!?])\s+|\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 18);

  if (sentences.length === 0) {
    return ['Paste match notes, commentary, or a script to extract key tactical beats.'];
  }

  const scored = sentences.map((sentence) => {
    let score = 0;
    if (/\d+/.test(sentence)) score += 3;
    if (/(yorker|powerplay|slip|spin|swing|chase|wicket|over|boundary|strike rate|economy)/i.test(sentence)) {
      score += 4;
    }
    return { sentence, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((item) => item.sentence);
}

export function suggestFieldDiagramFromNotes(rawText: string): {
  presetId: string;
  reason: string;
} {
  const lower = rawText.toLowerCase();
  if (/death|yorker|slog|19th|20th|18th/.test(lower)) {
    return {
      presetId: 'death-overs-defend',
      reason: 'Detected death-overs / yorker cues; matched Death Overs Boundary Protection.',
    };
  }
  if (/test|slip|cordon|red ball|outswing|edge/.test(lower)) {
    return {
      presetId: 'test-slip-cordon',
      reason: 'Detected red-ball / slip cordon cues; matched Test Match Slip Cordon.',
    };
  }
  if (/spin|googly|leg break|off break|short leg|sweep/.test(lower)) {
    return {
      presetId: 'spin-chokehold',
      reason: 'Detected spin / close-catching cues; matched Spin Chokehold.',
    };
  }
  return {
    presetId: 'powerplay-attack',
    reason: 'Defaulted to Powerplay Attack (2 Slips) for opening-overs tactical framing.',
  };
}

export function suggestScenesFromNotes(rawText: string): AiSuggestedScene[] {
  const points = extractKeyPoints(rawText);
  const scenes: AiSuggestedScene[] = [
    {
      title: 'Cold Open Hook',
      durationSec: 5,
      type: 'intro',
      notes: points[0] ?? 'Introduce the match moment or tactical question.',
    },
    {
      title: 'Tactical Pitch Breakdown',
      durationSec: 8,
      type: 'field-scene',
      notes: points[1] ?? 'Walk through field placement and bowling plan.',
    },
  ];

  points.slice(2, 5).forEach((pt, idx) => {
    scenes.push({
      title: `Key Beat ${idx + 1}`,
      durationSec: 6,
      type: 'explanation',
      notes: pt,
    });
  });

  scenes.push({
    title: 'Subscriber Question & Outro',
    durationSec: 5,
    type: 'outro',
    notes: 'Prompt viewers to share their tactical take in the comments.',
  });

  return scenes;
}

export function suggestQuizQuestionsFromNotes(
  rawText: string
): Omit<QuizQuestion, 'id' | 'index'>[] {
  const lower = rawText.toLowerCase();
  const suggestions: Omit<QuizQuestion, 'id' | 'index'>[] = [];

  if (/yorker|death|19th|20th/.test(lower)) {
    suggestions.push({
      prompt: 'Where is a bowler aiming when executing a classic death-overs yorker?',
      options: [
        'Short at chest height',
        'At the batter’s popping crease / base of stumps',
        'Halfway down the pitch',
        'Wide outside leg stump',
      ],
      correctIndex: 1,
      countdownSec: 10,
      explanation: 'A yorker pitches right at the popping crease or toes to deny elevation.',
      category: 'Bowling Mechanics',
      difficulty: 'easy',
      includeFieldOverlay: true,
    });
  }

  if (/powerplay|circle|30-yard/.test(lower)) {
    suggestions.push({
      prompt: 'During ODI Powerplay 1 (overs 1–10), how many fielders may stand outside the 30-yard ring?',
      options: ['Maximum 2', 'Maximum 3', 'Maximum 4', 'Maximum 5'],
      correctIndex: 0,
      countdownSec: 10,
      explanation: 'Only 2 fielders are permitted outside the 30-yard circle in Powerplay 1.',
      category: 'Fielding Rules',
      difficulty: 'medium',
      includeFieldOverlay: true,
    });
  }

  if (/spin|googly|sweep/.test(lower)) {
    suggestions.push({
      prompt: 'Which spin variation turns into a right-handed batter despite being bowled with a leg-spin action?',
      options: ['Flipper', 'Top-spinner', 'Googly', 'Slider'],
      correctIndex: 2,
      countdownSec: 10,
      explanation: 'A googly breaks from off to leg, surprising batters expecting a leg-break.',
      category: 'Spin Bowling',
      difficulty: 'medium',
      includeFieldOverlay: false,
    });
  }

  if (suggestions.length === 0) {
    const matchedPreset =
      BALL_ANIMATION_PRESETS.find((p) => lower.includes(p.name.toLowerCase())) ??
      BALL_ANIMATION_PRESETS[2];
    suggestions.push({
      prompt: `In a ${matchedPreset.name} setup, which fielding area carries the highest catching priority?`,
      options: [
        'Slip cordon / close catching zone',
        'Deep fine leg boundary',
        'Mid-on straight circle',
        'Long-leg boundary',
      ],
      correctIndex: 0,
      countdownSec: 10,
      explanation: `${matchedPreset.name} scenarios prioritize close-catching or ring pressure around the strike zone.`,
      category: 'Cricket Tactics',
      difficulty: 'medium',
      includeFieldOverlay: true,
    });
  }

  return suggestions;
}

export function createTimelineOutlineFromNotes(rawText: string): string[] {
  const scenes = suggestScenesFromNotes(rawText);
  let t = 0;
  return scenes.map((sc) => {
    const line = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')} — ${sc.title} (${sc.durationSec}s)`;
    t += sc.durationSec;
    return line;
  });
}

export const localAiContentAssistProvider: AiContentAssistProvider = {
  analyzeSourceText(sourceText: string): AiAssistOutput {
    const fieldSuggestion = suggestFieldDiagramFromNotes(sourceText);
    return {
      keyPoints: extractKeyPoints(sourceText),
      suggestedScenes: suggestScenesFromNotes(sourceText),
      suggestedQuestions: suggestQuizQuestionsFromNotes(sourceText),
      suggestedFieldPresetId: fieldSuggestion.presetId,
      suggestedFieldReason: fieldSuggestion.reason,
      timelineOutline: createTimelineOutlineFromNotes(sourceText),
    };
  },
};
