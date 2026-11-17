import type {
  AspectRatio,
  BroadcastGraphicOverlay,
  QuizOptionIndex,
  QuizQuestion,
  StudioWorkspace,
  TimelineClip,
  VoiceoverSegment,
} from '../types/studio';
import { cloneFieldDesignFromPreset } from '../engine/cricketField';
import { migrateProjectToPhase2, normalizeQuizQuestions } from '../engine/storage';
import { DEFAULT_BRAND_PRESETS, cloneBrandPreset } from '../engine/brandDefaults';

interface RawSeedQuestion {
  prompt: string;
  options: [string, string, string, string];
  correctIndex: QuizOptionIndex;
  countdownSec: number;
  explanation: string;
  category: string;
  includeFieldOverlay?: boolean;
}

export const CRICKET_SEED_QUESTIONS: RawSeedQuestion[] = [
  {
    prompt: 'During an ODI Powerplay 1 (overs 1–10), what is the maximum number of fielders allowed outside the 30-yard circle?',
    options: ['2 fielders', '3 fielders', '4 fielders', '5 fielders'],
    correctIndex: 0,
    countdownSec: 10,
    explanation: 'Only 2 fielders are permitted outside the 30-yard inner ring in Powerplay 1, encouraging attacking strokeplay.',
    category: 'Fielding Rules',
    includeFieldOverlay: true,
  },
  {
    prompt: 'Which fielding position sits directly between the wicketkeeper and gully on the off side?',
    options: ['Silly Point', 'Slip Cordon', 'Third Man', 'Fly Slip'],
    correctIndex: 1,
    countdownSec: 8,
    explanation: 'The slip cordon (1st, 2nd, 3rd slip) bridges the space from the wicketkeeper toward gully.',
    category: 'Fielding Positions',
    includeFieldOverlay: true,
  },
  {
    prompt: 'What is the official length of a cricket pitch from stump to stump?',
    options: ['20 yards', '22 yards', '24 yards', '18 yards'],
    correctIndex: 1,
    countdownSec: 8,
    explanation: 'A standard cricket pitch measures 22 yards (20.12 meters) between the two sets of stumps.',
    category: 'Pitch Laws',
  },
  {
    prompt: 'How many fielders are permitted behind square on the leg side at the moment of delivery?',
    options: ['Maximum 2', 'Maximum 3', 'Maximum 4', 'No limit'],
    correctIndex: 0,
    countdownSec: 10,
    explanation: 'Law 28.4 restricts teams to at most two fielders behind square on the leg side to prevent negative leg-theory bowling.',
    category: 'Cricket Laws',
    includeFieldOverlay: true,
  },
  {
    prompt: 'Which delivery curves away from a right-handed batter in the air before pitching?',
    options: ['Inswinger', 'Off-cutter', 'Outswinger', 'Doosra'],
    correctIndex: 2,
    countdownSec: 8,
    explanation: 'An outswinger moves toward the off-side slip cordon in flight, challenging the outside edge.',
    category: 'Bowling Mechanics',
    includeFieldOverlay: true,
  },
  {
    prompt: 'What is the width of the return creases measured from the center of the middle stump?',
    options: ['3 feet 4 inches', '4 feet 4 inches', '5 feet', '2 feet 6 inches'],
    correctIndex: 1,
    countdownSec: 12,
    explanation: 'Each return crease sits 4 feet 4 inches (1.32m) on either side of the center of the middle stump.',
    category: 'Pitch Laws',
  },
  {
    prompt: 'Which bowler holds the record for the fastest officially recorded delivery in international cricket (161.3 km/h)?',
    options: ['Brett Lee', 'Shaun Tait', 'Shoaib Akhtar', 'Mitchell Starc'],
    correctIndex: 2,
    countdownSec: 10,
    explanation: 'Shoaib Akhtar bowled 161.3 km/h (100.2 mph) against England during the 2003 World Cup.',
    category: 'World Records',
  },
  {
    prompt: 'In T20 cricket, how many overs can a single bowler deliver in a 20-over innings?',
    options: ['3 overs', '4 overs', '5 overs', '6 overs'],
    correctIndex: 1,
    countdownSec: 8,
    explanation: 'Each bowler is capped at 4 overs (20% of the innings) in standard 20-over matches.',
    category: 'Format Rules',
  },
  {
    prompt: 'A right-arm leg-spinner’s surprise delivery that turns from off to leg into a right-handed batter is called a:',
    options: ['Slider', 'Flipper', 'Googly', 'Carrom Ball'],
    correctIndex: 2,
    countdownSec: 10,
    explanation: 'A googly (or wrong-un) releases out of the back of the hand to spin opposite to the stock leg-break.',
    category: 'Spin Bowling',
  },
  {
    prompt: 'What happens immediately if a fielding team violates the maximum number of fielders outside the 30-yard circle?',
    options: ['5 penalty runs', 'Dead ball', 'No-ball and Free Hit', 'Warning only'],
    correctIndex: 2,
    countdownSec: 10,
    explanation: 'In white-ball cricket, an illegal fielding placement triggers a no-ball call followed by a free hit.',
    category: 'Fielding Rules',
    includeFieldOverlay: true,
  },
  {
    prompt: 'Which boundary fielding position protects the deep straight region on the off side?',
    options: ['Long-On', 'Long-Off', 'Deep Extra Cover', 'Cow Corner'],
    correctIndex: 1,
    countdownSec: 8,
    explanation: 'Long-Off patrols the straight boundary on the off side, mirroring Long-On on the leg side.',
    category: 'Fielding Positions',
    includeFieldOverlay: true,
  },
  {
    prompt: 'How tall are regulation cricket stumps from the ground to the top of the stumps (excluding bails)?',
    options: ['26 inches', '28 inches', '30 inches', '32 inches'],
    correctIndex: 1,
    countdownSec: 10,
    explanation: 'Law 8.2 specifies stumps must stand 28 inches (71.12 cm) above the playing surface.',
    category: 'Pitch Laws',
  },
  {
    prompt: 'Which batter scored the first double century in Men’s One Day International history?',
    options: ['Virender Sehwag', 'Rohit Sharma', 'Sachin Tendulkar', 'Chris Gayle'],
    correctIndex: 2,
    countdownSec: 8,
    explanation: 'Sachin Tendulkar scored an unbeaten 200 against South Africa in Gwalior in February 2010.',
    category: 'ODI History',
  },
  {
    prompt: 'What term describes "Cow Corner" in cricket field placement?',
    options: ['Deep Backward Point', 'Deep Mid-Wicket / Wide Long-On', 'Short Fine Leg', 'Deep Third Man'],
    correctIndex: 1,
    countdownSec: 10,
    explanation: 'Cow Corner refers to the deep boundary area between wide long-on and deep mid-wicket.',
    category: 'Fielding Positions',
  },
  {
    prompt: 'In Test cricket, how many overs must be bowled before a fielding side can request a new ball?',
    options: ['65 overs', '75 overs', '80 overs', '90 overs'],
    correctIndex: 2,
    countdownSec: 10,
    explanation: 'Under Law 4.4, the fielding captain can opt for a new ball once 80 overs have been completed.',
    category: 'Test Cricket',
  },
  {
    prompt: 'What is the minimum distance from the middle stump to the popping crease?',
    options: ['3 feet', '4 feet', '4 feet 6 inches', '5 feet'],
    correctIndex: 1,
    countdownSec: 10,
    explanation: 'The popping crease sits 4 feet (1.22m) in front of the bowling crease.',
    category: 'Pitch Laws',
  },
  {
    prompt: 'Which shot is played with a horizontal bat to a short delivery rising around chest height on the leg side?',
    options: ['Cover Drive', 'Pull Shot', 'Late Cut', 'On Drive'],
    correctIndex: 1,
    countdownSec: 8,
    explanation: 'The pull shot meets short-pitched deliveries around chest/waist height and dispatches them toward mid-wicket or square leg.',
    category: 'Batting Technique',
  },
  {
    prompt: 'Under modern LBW laws, can a batter be given out LBW if the ball pitches outside the leg stump?',
    options: ['Yes, if hitting middle stump', 'Yes, if no shot offered', 'No, never', 'Only in T20s'],
    correctIndex: 2,
    countdownSec: 10,
    explanation: 'If the ball pitches outside the line of leg stump, an LBW appeal cannot be upheld under Law 36.',
    category: 'Cricket Laws',
  },
  {
    prompt: 'How many runs are awarded automatically to the batting side if a thrown ball hits a fielding helmet resting on the ground?',
    options: ['4 runs', '5 penalty runs', '6 runs', 'Dead ball'],
    correctIndex: 1,
    countdownSec: 10,
    explanation: 'Striking a protective helmet placed behind the wicketkeeper awards 5 penalty runs to the batting team.',
    category: 'Cricket Laws',
  },
  {
    prompt: 'Which stadium has the largest seating capacity for cricket in the world?',
    options: ['Melbourne Cricket Ground', 'Lord’s Cricket Ground', 'Narendra Modi Stadium', 'Eden Gardens'],
    correctIndex: 2,
    countdownSec: 8,
    explanation: 'Narendra Modi Stadium in Ahmedabad holds over 132,000 spectators.',
    category: 'Venues & Trivia',
  },
  {
    prompt: 'What does a "Mankad" / non-striker run-out punish?',
    options: ['Obstructing the field', 'Backing up out of the crease before ball release', 'Double-hitting the ball', 'Stepping on the stumps'],
    correctIndex: 1,
    countdownSec: 10,
    explanation: 'Under Law 38.3, a bowler may run out the non-striker if they leave their ground before the bowler reaches the delivery stride.',
    category: 'Cricket Laws',
  },
  {
    prompt: 'Which bowling grip uses the middle finger flicked across the seam to spin the ball toward the off side?',
    options: ['Carrom Ball', 'Knuckleball', 'Reverse Swing', 'Top-spinner'],
    correctIndex: 0,
    countdownSec: 10,
    explanation: 'The carrom ball is snapped between thumb and bent middle finger, popularized by Ajantha Mendis and Ravichandran Ashwin.',
    category: 'Spin Bowling',
  },
  {
    prompt: 'When a bowler delivers a "yorker", where is the ball intended to pitch?',
    options: ['Halfway down the pitch', 'Right around the batter’s popping crease / toes', 'Three-quarters length', 'Outside the wide guideline'],
    correctIndex: 1,
    countdownSec: 8,
    explanation: 'A yorker targets the base of the stumps or the batter’s feet right at the popping crease.',
    category: 'Bowling Mechanics',
    includeFieldOverlay: true,
  },
  {
    prompt: 'How many players constitute a full starting XI on the field for one innings?',
    options: ['9 players', '10 players', '11 players', '12 players'],
    correctIndex: 2,
    countdownSec: 6,
    explanation: 'Each side fields 11 players (1 bowler, 1 wicketkeeper, and 9 outfielders).',
    category: 'Cricket Basics',
  },
  {
    prompt: 'In DRS (Decision Review System), what does "Umpire’s Call" signify on ball-tracking impact or wickets?',
    options: ['Automatic Not Out', 'The on-field decision stands without losing a review', 'Automatic Out', 'Ball is re-bowled'],
    correctIndex: 1,
    countdownSec: 10,
    explanation: 'When ball-tracking shows marginal contact within the margin of error, the original on-field call is retained and the review is preserved.',
    category: 'Broadcast Tech',
  },
  {
    prompt: 'Which fielding position is placed very close to the batter on the leg side specifically to catch bat-pad pop-ups?',
    options: ['Deep Fine Leg', 'Short Leg', 'Mid-On', 'Long-Leg'],
    correctIndex: 1,
    countdownSec: 8,
    explanation: 'Short leg stands helmeted just a couple of yards from the batter on the leg side to catch deflections off glove or pad.',
    category: 'Fielding Positions',
    includeFieldOverlay: true,
  },
  {
    prompt: 'What is the maximum number of bouncers allowed per over in a standard Men’s ODI innings?',
    options: ['1 bouncer', '2 bouncers', '3 bouncers', 'Unlimited'],
    correctIndex: 1,
    countdownSec: 10,
    explanation: 'ICC ODI playing conditions permit up to two shoulder-to-head height bouncers per over.',
    category: 'Format Rules',
  },
  {
    prompt: 'Which country won the inaugural ICC Men’s T20 World Cup in 2007?',
    options: ['Pakistan', 'Australia', 'India', 'Sri Lanka'],
    correctIndex: 2,
    countdownSec: 8,
    explanation: 'India defeated Pakistan by 5 runs in a dramatic 2007 final in Johannesburg.',
    category: 'World Cup History',
  },
  {
    prompt: 'If a batter hits the ball cleanly over the boundary rope without bouncing, how many runs are scored?',
    options: ['4 runs', '5 runs', '6 runs', '8 runs'],
    correctIndex: 2,
    countdownSec: 6,
    explanation: 'Clearing the boundary on the full scores 6 runs; touching the turf before crossing scores 4 runs.',
    category: 'Cricket Basics',
  },
  {
    prompt: 'Which type of swing occurs late in an innings when one side of the ball is polished shiny and the other is kept rough?',
    options: ['Conventional Swing', 'Reverse Swing', 'Drift', 'Seam Movement'],
    correctIndex: 1,
    countdownSec: 10,
    explanation: 'Reverse swing occurs with older balls at high pace, swinging toward the shiny side instead of the rough side.',
    category: 'Bowling Mechanics',
  },
];

export function createInitialWorkspace(): StudioWorkspace {
  const now = new Date().toISOString();
  const project1Questions: QuizQuestion[] = normalizeQuizQuestions(
    CRICKET_SEED_QUESTIONS.map((q, idx) => ({
      id: `ep14-q-${idx + 1}`,
      index: idx,
      prompt: q.prompt,
      options: [...q.options],
      correctIndex: q.correctIndex,
      countdownSec: q.countdownSec,
      explanation: q.explanation,
      category: q.category,
      includeFieldOverlay: Boolean(q.includeFieldOverlay),
    }))
  );

  const project2Questions: QuizQuestion[] = normalizeQuizQuestions(
    CRICKET_SEED_QUESTIONS.slice(0, 12).map((q, idx) => ({
      id: `ep15-q-${idx + 1}`,
      index: idx,
      prompt: q.prompt,
      options: [...q.options],
      correctIndex: q.correctIndex,
      countdownSec: q.countdownSec,
      explanation: q.explanation,
      category: q.category,
      includeFieldOverlay: Boolean(q.includeFieldOverlay),
    }))
  );

  const proj1 = migrateProjectToPhase2({
    id: 'proj-ep14-powerplay',
    title: 'Ep 14: Powerplay Tactical Masterclass & 30-Question Quiz',
    subtitle: 'Outswinger slip trap breakdown + full 30-question broadcast trivia bank',
    createdAt: now,
    updatedAt: now,
    fieldDesign: cloneFieldDesignFromPreset('powerplay-attack'),
    quizQuestions: project1Questions,
    settings: {
      aspectRatio: '16:9',
      fps: 30,
      seriesName: 'Tactical Cricket Breakdown',
      channelHandle: '@CricketCreator',
      showSafeZones: true,
    },
    production: {
      contentType: 'quiz',
      templateType: 'quiz-30',
      episodeNumber: '14',
      description: '30-question tactical & rules cricket quiz with powerplay field diagram.',
      targetPlatform: 'YouTube',
      quizTargetCount: 30,
    },
    brandKit: cloneBrandPreset('brand-default'),
  });

  const proj2 = migrateProjectToPhase2({
    id: 'proj-ep15-death-overs',
    title: 'Ep 15: Death Overs Yorker Blueprint (Shorts)',
    subtitle: 'Portrait 9:16 tactical sequence with wide yorker ring setup',
    createdAt: now,
    updatedAt: now,
    fieldDesign: cloneFieldDesignFromPreset('death-overs-defend'),
    quizQuestions: project2Questions,
    settings: {
      aspectRatio: '9:16',
      fps: 30,
      seriesName: 'Cricket Shorts Lab',
      channelHandle: '@YourCricketGuy',
      showSafeZones: true,
    },
    production: {
      contentType: 'field-analysis',
      templateType: 'death-overs-analysis',
      episodeNumber: '15',
      description: 'Death overs yorker setup breakdown for vertical shorts.',
      targetPlatform: 'YouTube Shorts',
      quizTargetCount: 10,
    },
    brandKit: cloneBrandPreset('brand-your-cricket-guy'),
  });

  return {
    version: 3,
    activeProjectId: 'proj-ep14-powerplay',
    projects: [proj1, proj2],
    brandPresets: DEFAULT_BRAND_PRESETS.map((b) => ({ ...b })),
    exportHistory: [],
  };
}

/**
 * Deterministic 24-second Renderer QA Project containing field animation, quiz countdown,
 * answer reveal, broadcast graphics, branding, voiceover captions, SFX, and transitions.
 */
export function createRendererQaProject(
  aspectRatio: '16:9' | '9:16' | '1:1' = '16:9'
): ReturnType<typeof migrateProjectToPhase2> {
  const now = new Date().toISOString();
  const q1 = CRICKET_SEED_QUESTIONS[0];
  const q2 = CRICKET_SEED_QUESTIONS[4];
  const fieldDesign = cloneFieldDesignFromPreset('powerplay-attack');

  const proj = migrateProjectToPhase2({
    id: `proj-renderer-qa-${aspectRatio.replace(':', 'x')}`,
    title: 'Renderer QA Scene: Yorker & Powerplay Quiz (24s)',
    subtitle: '24-second end-to-end production test: Field + Quiz + Graphics + SFX + Captions',
    createdAt: now,
    updatedAt: now,
    fieldDesign,
    quizQuestions: normalizeQuizQuestions([
      {
        id: 'qa-q-1',
        index: 0,
        prompt: q1.prompt,
        options: [...q1.options],
        correctIndex: q1.correctIndex,
        countdownSec: 4,
        explanation: q1.explanation,
        category: q1.category,
        difficulty: 'medium',
        includeFieldOverlay: true,
      },
      {
        id: 'qa-q-2',
        index: 1,
        prompt: q2.prompt,
        options: [...q2.options],
        correctIndex: q2.correctIndex,
        countdownSec: 4,
        explanation: q2.explanation,
        category: q2.category,
        difficulty: 'hard',
        includeFieldOverlay: true,
      },
    ]),
    settings: {
      aspectRatio,
      fps: 30,
      seriesName: 'QA Broadcast Suite',
      channelHandle: '@YourCricketGuy',
      showSafeZones: true,
    },
    production: {
      contentType: 'quiz',
      templateType: 'powerplay-breakdown',
      episodeNumber: 'QA',
      description: 'Short 24s QA project for rapid MP4/WebM renderer verification.',
      targetPlatform: aspectRatio === '9:16' ? 'YouTube Shorts' : 'YouTube',
      quizTargetCount: 1,
    },
    brandKit: cloneBrandPreset('brand-your-cricket-guy'),
    timelineClips: [
      {
        id: 'qa-intro',
        trackId: 'video',
        name: 'QA Broadcast Intro',
        startSec: 0,
        durationSec: 2.5,
        type: 'intro',
        status: 'ready',
        transitionType: 'cut',
        transitionDurationSec: 0.3,
      },
      {
        id: 'qa-field',
        trackId: 'field',
        name: 'Powerplay Outswinger Trap',
        startSec: 2.5,
        durationSec: 6.5,
        type: 'field-scene',
        status: 'ready',
        fieldSceneId: 'fscene-default',
        transitionType: 'slide-left',
        transitionDurationSec: 0.45,
      },
      {
        id: 'qa-q1-prompt',
        trackId: 'quiz',
        name: 'Q1 Prompt',
        startSec: 9,
        durationSec: 2,
        type: 'question',
        status: 'ready',
        questionIndex: 0,
        transitionType: 'broadcast-wipe',
        transitionDurationSec: 0.4,
      },
      {
        id: 'qa-q1-countdown',
        trackId: 'quiz',
        name: 'Q1 Countdown (4s)',
        startSec: 11,
        durationSec: 4,
        type: 'countdown',
        status: 'ready',
        questionIndex: 0,
      },
      {
        id: 'qa-q1-reveal',
        trackId: 'quiz',
        name: 'Q1 Answer Reveal',
        startSec: 15,
        durationSec: 2.5,
        type: 'reveal',
        status: 'ready',
        questionIndex: 0,
      },
      {
        id: 'qa-q1-explain',
        trackId: 'quiz',
        name: 'Q1 Explanation',
        startSec: 17.5,
        durationSec: 2.5,
        type: 'explanation',
        status: 'ready',
        questionIndex: 0,
      },
      {
        id: 'qa-cta',
        trackId: 'video',
        name: 'Subscribe CTA',
        startSec: 20,
        durationSec: 2,
        type: 'cta',
        status: 'ready',
        transitionType: 'crossfade',
        transitionDurationSec: 0.4,
      },
      {
        id: 'qa-outro',
        trackId: 'video',
        name: 'Brand Outro',
        startSec: 22,
        durationSec: 2,
        type: 'outro',
        status: 'ready',
        transitionType: 'fade',
        transitionDurationSec: 0.4,
      },
      {
        id: 'qa-sfx-bat',
        trackId: 'sfx',
        name: 'SFX: Bat Impact',
        startSec: 5.5,
        durationSec: 0.8,
        type: 'sfx',
        status: 'ready',
        audioCategory: 'bat-hit',
        volume: 0.9,
      },
      {
        id: 'qa-sfx-whoosh',
        trackId: 'sfx',
        name: 'SFX: Scene Whoosh',
        startSec: 9,
        durationSec: 0.8,
        type: 'sfx',
        status: 'ready',
        audioCategory: 'whoosh',
        volume: 0.8,
      },
      {
        id: 'qa-sfx-tick',
        trackId: 'sfx',
        name: 'SFX: Countdown Tick',
        startSec: 11,
        durationSec: 4,
        type: 'sfx',
        status: 'ready',
        audioCategory: 'countdown-tick',
        volume: 0.75,
      },
      {
        id: 'qa-sfx-correct',
        trackId: 'sfx',
        name: 'SFX: Answer Correct',
        startSec: 15,
        durationSec: 1.2,
        type: 'sfx',
        status: 'ready',
        audioCategory: 'answer-correct',
        volume: 0.9,
      },
      {
        id: 'qa-sfx-crowd',
        trackId: 'music',
        name: 'Music: Broadcast Bed',
        startSec: 0,
        durationSec: 24,
        type: 'music',
        status: 'ready',
        audioCategory: 'music',
        volume: 0.35,
        fadeInSec: 1,
        fadeOutSec: 1.5,
        loop: true,
      },
    ],
    voiceoverSegments: [
      {
        id: 'qa-vo-1',
        sceneClipId: 'qa-intro',
        label: 'Intro Narration',
        text: 'Welcome to Cricket Creator Studio tactical breakdown and quiz!',
        captionText: 'Welcome to Cricket Creator Studio tactical breakdown & quiz!',
        startSec: 0.2,
        endSec: 2.4,
        status: 'script-ready',
        estimatedDurationSec: 2.2,
      },
      {
        id: 'qa-vo-2',
        sceneClipId: 'qa-field',
        label: 'Field Analysis Narration',
        text: 'Notice the two slips and catching mid-off guarding against the outswinger.',
        captionText: 'Two slips & catching mid-off trap the outswinger.',
        startSec: 2.8,
        endSec: 8.5,
        status: 'script-ready',
        estimatedDurationSec: 5.7,
      },
      {
        id: 'qa-vo-3',
        sceneClipId: 'qa-q1-prompt',
        label: 'Quiz Q1 Narration',
        text: q1.prompt,
        captionText: 'How many fielders are allowed outside the 30-yard circle in Powerplay 1?',
        startSec: 9.1,
        endSec: 14.8,
        status: 'script-ready',
        estimatedDurationSec: 5.7,
      },
      {
        id: 'qa-vo-4',
        sceneClipId: 'qa-q1-reveal',
        label: 'Quiz Q1 Reveal',
        text: q1.explanation,
        captionText: 'Answer: 2 fielders maximum outside the 30-yard ring!',
        startSec: 15.1,
        endSec: 19.8,
        status: 'script-ready',
        estimatedDurationSec: 4.7,
      },
    ],
  });

  return proj;
}

/**
 * Deterministic Long-Form Benchmark Episode Builder (5, 10, or 30 questions)
 * containing Intro, Cricket Field Scenario, Prompt/Countdown/Reveal/Explanation per question,
 * Transitions, Broadcast Graphics, SFX, Music Bed, Voiceover Captions, CTA, and Outro.
 */
export function createBenchmarkProject(
  questionCount: 5 | 10 | 30,
  aspectRatio: AspectRatio = '16:9'
): ReturnType<typeof migrateProjectToPhase2> {
  const now = new Date().toISOString();
  const fieldDesign = cloneFieldDesignFromPreset('powerplay-attack');
  const selectedRaw = Array.from({ length: questionCount }, (_, idx) => {
    const raw = CRICKET_SEED_QUESTIONS[idx % CRICKET_SEED_QUESTIONS.length];
    return {
      id: `bench-${questionCount}-q-${idx + 1}`,
      index: idx,
      prompt: raw.prompt,
      options: [...raw.options] as [string, string, string, string],
      correctIndex: raw.correctIndex,
      countdownSec: 4,
      explanation: raw.explanation,
      category: raw.category,
      difficulty: (idx % 3 === 0 ? 'easy' : idx % 3 === 1 ? 'medium' : 'hard') as
        | 'easy'
        | 'medium'
        | 'hard',
      includeFieldOverlay: Boolean(raw.includeFieldOverlay || idx % 2 === 0),
    };
  });

  const quizQuestions = normalizeQuizQuestions(selectedRaw);
  const timelineClips: TimelineClip[] = [];
  const voiceoverSegments: VoiceoverSegment[] = [];
  const graphics: BroadcastGraphicOverlay[] = [];

  let cursor = 0;

  // 1. Intro (3.0s)
  timelineClips.push({
    id: `bench-${questionCount}-intro`,
    trackId: 'video',
    name: `Cricket Quiz Masterclass (${questionCount}Q)`,
    startSec: cursor,
    durationSec: 3,
    type: 'intro',
    status: 'ready',
    transitionType: 'fade',
    transitionDurationSec: 0.35,
  });
  voiceoverSegments.push({
    id: `bench-${questionCount}-vo-intro`,
    sceneClipId: `bench-${questionCount}-intro`,
    label: 'Intro Narration',
    text: `Welcome to the ${questionCount}-Question Cricket Tactical & Laws Challenge.`,
    captionText: `${questionCount}-Question Cricket Tactical & Laws Challenge`,
    startSec: cursor + 0.2,
    endSec: cursor + 2.8,
    status: 'script-ready',
    estimatedDurationSec: 2.6,
  });
  cursor += 3;

  // 2. Tactical Field Scenario + Ball Trajectory (6.0s)
  const fieldStart = cursor;
  timelineClips.push({
    id: `bench-${questionCount}-field`,
    trackId: 'field',
    name: 'Powerplay Outswinger Scenario',
    startSec: fieldStart,
    durationSec: 6,
    type: 'field-scene',
    status: 'ready',
    fieldSceneId: 'fscene-default',
    transitionType: 'slide-left',
    transitionDurationSec: 0.45,
  });
  timelineClips.push({
    id: `bench-${questionCount}-sfx-bat`,
    trackId: 'sfx',
    name: 'SFX: Bat & Ball Impact',
    startSec: fieldStart + 3.2,
    durationSec: 0.7,
    type: 'sfx',
    status: 'ready',
    audioCategory: 'bat-hit',
    volume: 0.85,
  });
  voiceoverSegments.push({
    id: `bench-${questionCount}-vo-field`,
    sceneClipId: `bench-${questionCount}-field`,
    label: 'Field Scenario',
    text: 'Analyze this attacking outswinger ring before testing your cricket IQ.',
    captionText: 'Analyze the Powerplay outswinger ring & ball trajectory.',
    startSec: fieldStart + 0.3,
    endSec: fieldStart + 5.7,
    status: 'script-ready',
    estimatedDurationSec: 5.4,
  });
  graphics.push({
    id: `bench-${questionCount}-gfx-field`,
    type: 'match-situation',
    label: 'Match Context',
    title: 'POWERPLAY 1 SCENARIO',
    subtitle: 'OVERS 1–10 · MAX 2 OUTSIDE RING',
    valueText: 'OUTSWINGER TRAP',
    teamName: 'CRICKET IQ BENCHMARK',
    playerName: 'SLIP CORDON SET',
    accentColor: '#D4AF37',
    position: { x: 4, y: 6 },
    startSec: fieldStart + 0.5,
    durationSec: 5,
    enabled: true,
  });
  cursor += 6;

  // 3. Questions loop (10.5s each + 0.5s transition between questions)
  for (let i = 0; i < questionCount; i++) {
    const q = quizQuestions[i];
    const qNum = i + 1;

    const promptStart = cursor;
    timelineClips.push({
      id: `bench-${questionCount}-q${qNum}-prompt`,
      trackId: 'quiz',
      name: `Q${qNum} Prompt`,
      startSec: promptStart,
      durationSec: 2,
      type: 'question',
      status: 'ready',
      questionIndex: i,
      transitionType: i === 0 ? 'broadcast-wipe' : 'slide-left',
      transitionDurationSec: 0.35,
    });
    cursor += 2;

    const cdStart = cursor;
    timelineClips.push({
      id: `bench-${questionCount}-q${qNum}-cd`,
      trackId: 'quiz',
      name: `Q${qNum} Countdown (4s)`,
      startSec: cdStart,
      durationSec: 4,
      type: 'countdown',
      status: 'ready',
      questionIndex: i,
    });
    timelineClips.push({
      id: `bench-${questionCount}-sfx-tick-${qNum}`,
      trackId: 'sfx',
      name: `SFX: Q${qNum} Tick`,
      startSec: cdStart,
      durationSec: 4,
      type: 'sfx',
      status: 'ready',
      audioCategory: 'countdown-tick',
      volume: 0.72,
    });
    cursor += 4;

    const revStart = cursor;
    timelineClips.push({
      id: `bench-${questionCount}-q${qNum}-rev`,
      trackId: 'quiz',
      name: `Q${qNum} Answer Reveal`,
      startSec: revStart,
      durationSec: 2,
      type: 'reveal',
      status: 'ready',
      questionIndex: i,
    });
    timelineClips.push({
      id: `bench-${questionCount}-sfx-ok-${qNum}`,
      trackId: 'sfx',
      name: `SFX: Q${qNum} Correct`,
      startSec: revStart,
      durationSec: 1.0,
      type: 'sfx',
      status: 'ready',
      audioCategory: 'answer-correct',
      volume: 0.88,
    });
    cursor += 2;

    const expStart = cursor;
    timelineClips.push({
      id: `bench-${questionCount}-q${qNum}-exp`,
      trackId: 'quiz',
      name: `Q${qNum} Explanation`,
      startSec: expStart,
      durationSec: 2.5,
      type: 'explanation',
      status: 'ready',
      questionIndex: i,
    });
    cursor += 2.5;

    voiceoverSegments.push({
      id: `bench-${questionCount}-vo-q${qNum}`,
      sceneClipId: `bench-${questionCount}-q${qNum}-prompt`,
      label: `Q${qNum} Question`,
      text: q.prompt,
      captionText: `Q${qNum}: ${q.prompt.slice(0, 72)}${q.prompt.length > 72 ? '...' : ''}`,
      startSec: promptStart + 0.15,
      endSec: cdStart + 3.6,
      status: 'script-ready',
      estimatedDurationSec: 5.4,
    });
    voiceoverSegments.push({
      id: `bench-${questionCount}-vo-ans${qNum}`,
      sceneClipId: `bench-${questionCount}-q${qNum}-rev`,
      label: `Q${qNum} Answer`,
      text: q.explanation,
      captionText: `Answer: ${q.options[q.correctIndex]}`,
      startSec: revStart + 0.1,
      endSec: expStart + 2.3,
      status: 'script-ready',
      estimatedDurationSec: 4.2,
    });

    if (i < questionCount - 1) {
      const transStart = cursor;
      timelineClips.push({
        id: `bench-${questionCount}-trans-${qNum}`,
        trackId: 'video',
        name: `Transition Q${qNum}→Q${qNum + 1}`,
        startSec: transStart,
        durationSec: 0.5,
        type: 'transition',
        status: 'ready',
        transitionType: 'broadcast-wipe',
        transitionDurationSec: 0.5,
      });
      timelineClips.push({
        id: `bench-${questionCount}-sfx-whoosh-${qNum}`,
        trackId: 'sfx',
        name: `SFX: Q${qNum} Transition`,
        startSec: transStart,
        durationSec: 0.5,
        type: 'sfx',
        status: 'ready',
        audioCategory: 'whoosh',
        volume: 0.7,
      });
      cursor += 0.5;
    }
  }

  // 4. CTA (3.0s) & Outro (3.0s)
  timelineClips.push({
    id: `bench-${questionCount}-cta`,
    trackId: 'video',
    name: 'Score & Subscribe CTA',
    startSec: cursor,
    durationSec: 3,
    type: 'cta',
    status: 'ready',
    transitionType: 'crossfade',
    transitionDurationSec: 0.4,
  });
  cursor += 3;

  timelineClips.push({
    id: `bench-${questionCount}-outro`,
    trackId: 'video',
    name: 'Brand Outro',
    startSec: cursor,
    durationSec: 3,
    type: 'outro',
    status: 'ready',
    transitionType: 'fade',
    transitionDurationSec: 0.4,
  });
  cursor += 3;

  // 5. Continuous Music Bed
  timelineClips.push({
    id: `bench-${questionCount}-music`,
    trackId: 'music',
    name: 'Music: Broadcast Underscore',
    startSec: 0,
    durationSec: cursor,
    type: 'music',
    status: 'ready',
    audioCategory: 'music',
    volume: 0.32,
    fadeInSec: 1.2,
    fadeOutSec: 1.8,
    loop: true,
  });

  const customBrand = {
    ...cloneBrandPreset('brand-default'),
    brandName: 'CRICKET IQ STUDIO',
    channelName: 'Cricket IQ Studio',
    watermarkText: '@CricketIQStudio',
    youtubeHandle: '@CricketIQStudio',
    ctaText: 'Drop your score out of ' + questionCount + ' in the comments!',
  };

  return migrateProjectToPhase2({
    id: `proj-benchmark-${questionCount}q-${aspectRatio.replace(':', 'x')}`,
    title: `Benchmark Episode (${questionCount} Questions)`,
    subtitle: `Deterministic ${questionCount}-question long-form render benchmark`,
    createdAt: now,
    updatedAt: now,
    fieldDesign,
    quizQuestions,
    settings: {
      aspectRatio,
      fps: 30,
      seriesName: 'Cricket IQ Benchmark Suite',
      channelHandle: '@CricketIQStudio',
      showSafeZones: true,
    },
    production: {
      contentType: 'quiz',
      templateType: questionCount >= 30 ? 'quiz-30' : 'quiz-10',
      episodeNumber: String(questionCount),
      description: `Long-form benchmark episode with ${questionCount} questions.`,
      targetPlatform: aspectRatio === '9:16' ? 'YouTube Shorts' : 'YouTube',
      quizTargetCount: questionCount,
    },
    brandKit: customBrand,
    broadcastGraphics: graphics,
    timelineClips,
    voiceoverSegments,
  });
}

/**
 * Polished 60.0-second Client Demo Project for a Cricket Education Creator ("Cricket IQ Academy").
 * Showcases branded intro, tactical field animation, ball trajectory, 3 curated questions,
 * animated countdowns, answer reveals, explanations, broadcast overlays, audio mix, and outro.
 */
export function createClientDemoProject(
  aspectRatio: AspectRatio = '16:9'
): ReturnType<typeof migrateProjectToPhase2> {
  const now = new Date().toISOString();
  const fieldDesign = cloneFieldDesignFromPreset('powerplay-attack');
  const demoQuestionsRaw = [
    CRICKET_SEED_QUESTIONS[0],
    CRICKET_SEED_QUESTIONS[1],
    CRICKET_SEED_QUESTIONS[4],
  ];

  const quizQuestions = normalizeQuizQuestions(
    demoQuestionsRaw.map((q, idx) => ({
      id: `demo-q-${idx + 1}`,
      index: idx,
      prompt: q.prompt,
      options: [...q.options] as [string, string, string, string],
      correctIndex: q.correctIndex,
      countdownSec: 5,
      explanation: q.explanation,
      category: q.category,
      difficulty: idx === 0 ? 'easy' : idx === 1 ? 'medium' : 'hard',
      includeFieldOverlay: true,
    }))
  );

  const brandKit = {
    ...cloneBrandPreset('brand-default'),
    id: 'brand-cricket-iq-academy',
    name: 'Cricket IQ Academy',
    brandName: 'CRICKET IQ ACADEMY',
    channelName: 'Cricket IQ Academy',
    logoTextFallback: 'IQ',
    primaryColor: '#0C1426',
    secondaryColor: '#172442',
    accentColor: '#D4AF37',
    backgroundColor: '#081020',
    watermarkText: '@CricketIQAcademy',
    youtubeHandle: '@CricketIQAcademy',
    website: 'cricketiqacademy.example',
    ctaText: 'Subscribe for Daily Cricket IQ Quizzes & Tactical Lab',
  };

  const timelineClips: TimelineClip[] = [
    // 0.0 -> 4.0 Intro
    {
      id: 'demo-intro',
      trackId: 'video',
      name: 'Cricket IQ Academy Intro',
      startSec: 0,
      durationSec: 4,
      type: 'intro',
      status: 'ready',
      transitionType: 'fade',
      transitionDurationSec: 0.4,
    },
    // 4.0 -> 12.0 Tactical Field + Ball Trajectory
    {
      id: 'demo-field',
      trackId: 'field',
      name: 'Powerplay Outswinger Field Setup',
      startSec: 4,
      durationSec: 8,
      type: 'field-scene',
      status: 'ready',
      fieldSceneId: 'fscene-default',
      transitionType: 'slide-left',
      transitionDurationSec: 0.45,
    },
    // 12.0 -> 12.5 Transition
    {
      id: 'demo-trans-0',
      trackId: 'video',
      name: 'Quiz Section Wipe',
      startSec: 12,
      durationSec: 0.5,
      type: 'transition',
      status: 'ready',
      transitionType: 'broadcast-wipe',
      transitionDurationSec: 0.5,
    },
    // 12.5 -> 26.0 Q1 (2.5 + 5.0 + 2.5 + 3.5 = 13.5s)
    {
      id: 'demo-q1-prompt',
      trackId: 'quiz',
      name: 'Q1: ODI Powerplay Circle',
      startSec: 12.5,
      durationSec: 2.5,
      type: 'question',
      status: 'ready',
      questionIndex: 0,
      transitionType: 'broadcast-wipe',
      transitionDurationSec: 0.35,
    },
    {
      id: 'demo-q1-cd',
      trackId: 'quiz',
      name: 'Q1 Countdown (5s)',
      startSec: 15,
      durationSec: 5,
      type: 'countdown',
      status: 'ready',
      questionIndex: 0,
    },
    {
      id: 'demo-q1-rev',
      trackId: 'quiz',
      name: 'Q1 Answer Reveal',
      startSec: 20,
      durationSec: 2.5,
      type: 'reveal',
      status: 'ready',
      questionIndex: 0,
    },
    {
      id: 'demo-q1-exp',
      trackId: 'quiz',
      name: 'Q1 Tactical Explanation',
      startSec: 22.5,
      durationSec: 3.5,
      type: 'explanation',
      status: 'ready',
      questionIndex: 0,
    },
    // 26.0 -> 26.5 Transition
    {
      id: 'demo-trans-1',
      trackId: 'video',
      name: 'Slide to Question 2',
      startSec: 26,
      durationSec: 0.5,
      type: 'transition',
      status: 'ready',
      transitionType: 'slide-left',
      transitionDurationSec: 0.5,
    },
    // 26.5 -> 40.0 Q2 (13.5s)
    {
      id: 'demo-q2-prompt',
      trackId: 'quiz',
      name: 'Q2: Off-Side Slip Cordon',
      startSec: 26.5,
      durationSec: 2.5,
      type: 'question',
      status: 'ready',
      questionIndex: 1,
      transitionType: 'slide-left',
      transitionDurationSec: 0.35,
    },
    {
      id: 'demo-q2-cd',
      trackId: 'quiz',
      name: 'Q2 Countdown (5s)',
      startSec: 29,
      durationSec: 5,
      type: 'countdown',
      status: 'ready',
      questionIndex: 1,
    },
    {
      id: 'demo-q2-rev',
      trackId: 'quiz',
      name: 'Q2 Answer Reveal',
      startSec: 34,
      durationSec: 2.5,
      type: 'reveal',
      status: 'ready',
      questionIndex: 1,
    },
    {
      id: 'demo-q2-exp',
      trackId: 'quiz',
      name: 'Q2 Tactical Explanation',
      startSec: 36.5,
      durationSec: 3.5,
      type: 'explanation',
      status: 'ready',
      questionIndex: 1,
    },
    // 40.0 -> 40.5 Transition
    {
      id: 'demo-trans-2',
      trackId: 'video',
      name: 'Slide to Question 3',
      startSec: 40,
      durationSec: 0.5,
      type: 'transition',
      status: 'ready',
      transitionType: 'broadcast-wipe',
      transitionDurationSec: 0.5,
    },
    // 40.5 -> 54.0 Q3 (13.5s)
    {
      id: 'demo-q3-prompt',
      trackId: 'quiz',
      name: 'Q3: Outswinger Mechanics',
      startSec: 40.5,
      durationSec: 2.5,
      type: 'question',
      status: 'ready',
      questionIndex: 2,
      transitionType: 'broadcast-wipe',
      transitionDurationSec: 0.35,
    },
    {
      id: 'demo-q3-cd',
      trackId: 'quiz',
      name: 'Q3 Countdown (5s)',
      startSec: 43,
      durationSec: 5,
      type: 'countdown',
      status: 'ready',
      questionIndex: 2,
    },
    {
      id: 'demo-q3-rev',
      trackId: 'quiz',
      name: 'Q3 Answer Reveal',
      startSec: 48,
      durationSec: 2.5,
      type: 'reveal',
      status: 'ready',
      questionIndex: 2,
    },
    {
      id: 'demo-q3-exp',
      trackId: 'quiz',
      name: 'Q3 Tactical Explanation',
      startSec: 50.5,
      durationSec: 3.5,
      type: 'explanation',
      status: 'ready',
      questionIndex: 2,
    },
    // 54.0 -> 57.0 CTA
    {
      id: 'demo-cta',
      trackId: 'video',
      name: 'Score Tracker & Subscribe CTA',
      startSec: 54,
      durationSec: 3,
      type: 'cta',
      status: 'ready',
      transitionType: 'crossfade',
      transitionDurationSec: 0.4,
    },
    // 57.0 -> 60.0 Outro
    {
      id: 'demo-outro',
      trackId: 'video',
      name: 'Cricket IQ Academy Outro',
      startSec: 57,
      durationSec: 3,
      type: 'outro',
      status: 'ready',
      transitionType: 'fade',
      transitionDurationSec: 0.45,
    },
    // SFX Cues
    {
      id: 'demo-sfx-bat',
      trackId: 'sfx',
      name: 'SFX: Bat & Seam Hit',
      startSec: 8.2,
      durationSec: 0.8,
      type: 'sfx',
      status: 'ready',
      audioCategory: 'bat-hit',
      volume: 0.9,
    },
    {
      id: 'demo-sfx-whoosh-0',
      trackId: 'sfx',
      name: 'SFX: Transition Whoosh 1',
      startSec: 12,
      durationSec: 0.6,
      type: 'sfx',
      status: 'ready',
      audioCategory: 'whoosh',
      volume: 0.78,
    },
    {
      id: 'demo-sfx-tick-1',
      trackId: 'sfx',
      name: 'SFX: Q1 Countdown Tick',
      startSec: 15,
      durationSec: 5,
      type: 'sfx',
      status: 'ready',
      audioCategory: 'countdown-tick',
      volume: 0.75,
    },
    {
      id: 'demo-sfx-ok-1',
      trackId: 'sfx',
      name: 'SFX: Q1 Correct Sting',
      startSec: 20,
      durationSec: 1.2,
      type: 'sfx',
      status: 'ready',
      audioCategory: 'answer-correct',
      volume: 0.9,
    },
    {
      id: 'demo-sfx-whoosh-1',
      trackId: 'sfx',
      name: 'SFX: Transition Whoosh 2',
      startSec: 26,
      durationSec: 0.6,
      type: 'sfx',
      status: 'ready',
      audioCategory: 'whoosh',
      volume: 0.78,
    },
    {
      id: 'demo-sfx-tick-2',
      trackId: 'sfx',
      name: 'SFX: Q2 Countdown Tick',
      startSec: 29,
      durationSec: 5,
      type: 'sfx',
      status: 'ready',
      audioCategory: 'countdown-tick',
      volume: 0.75,
    },
    {
      id: 'demo-sfx-ok-2',
      trackId: 'sfx',
      name: 'SFX: Q2 Correct Sting',
      startSec: 34,
      durationSec: 1.2,
      type: 'sfx',
      status: 'ready',
      audioCategory: 'answer-correct',
      volume: 0.9,
    },
    {
      id: 'demo-sfx-whoosh-2',
      trackId: 'sfx',
      name: 'SFX: Transition Whoosh 3',
      startSec: 40,
      durationSec: 0.6,
      type: 'sfx',
      status: 'ready',
      audioCategory: 'whoosh',
      volume: 0.78,
    },
    {
      id: 'demo-sfx-tick-3',
      trackId: 'sfx',
      name: 'SFX: Q3 Countdown Tick',
      startSec: 43,
      durationSec: 5,
      type: 'sfx',
      status: 'ready',
      audioCategory: 'countdown-tick',
      volume: 0.75,
    },
    {
      id: 'demo-sfx-ok-3',
      trackId: 'sfx',
      name: 'SFX: Q3 Correct Sting',
      startSec: 48,
      durationSec: 1.2,
      type: 'sfx',
      status: 'ready',
      audioCategory: 'answer-correct',
      volume: 0.9,
    },
    // Background Music Bed (60.0s)
    {
      id: 'demo-music-bed',
      trackId: 'music',
      name: 'Music: Broadcast Tension Underscore',
      startSec: 0,
      durationSec: 60,
      type: 'music',
      status: 'ready',
      audioCategory: 'music',
      volume: 0.34,
      fadeInSec: 1.2,
      fadeOutSec: 2.0,
      loop: true,
    },
  ];

  const broadcastGraphics: BroadcastGraphicOverlay[] = [
    {
      id: 'demo-gfx-powerplay',
      type: 'match-situation',
      label: 'Tactical Radar',
      title: 'POWERPLAY 1 · ATTACKING RING',
      subtitle: '2 SLIPS · GULLY · CATCHING MID-OFF',
      valueText: 'OUTSWINGER LINE',
      teamName: 'CRICKET IQ ACADEMY',
      playerName: 'PACE SPELL ANALYSIS',
      accentColor: '#D4AF37',
      position: { x: 4, y: 6 },
      startSec: 4.5,
      durationSec: 7,
      enabled: true,
    },
    {
      id: 'demo-gfx-score',
      type: 'score-bug',
      label: 'Quiz Scoreboard',
      title: 'POWERPLAY IQ TEST',
      subtitle: '3 TACTICAL QUESTIONS',
      valueText: '30-YD CIRCLE RULES',
      teamName: 'CRICKET IQ',
      playerName: 'EPISODE DEMO',
      accentColor: '#D4AF37',
      position: { x: 4, y: 6 },
      startSec: 12.5,
      durationSec: 40.5,
      enabled: true,
    },
  ];

  const voiceoverSegments: VoiceoverSegment[] = [
    {
      id: 'demo-vo-intro',
      sceneClipId: 'demo-intro',
      label: 'Intro Narration',
      text: 'Welcome to Cricket IQ Academy. Can you score 3 out of 3 on Powerplay tactics?',
      captionText: 'Can you score 3/3 on ODI Powerplay tactics?',
      startSec: 0.3,
      endSec: 3.7,
      status: 'script-ready',
      estimatedDurationSec: 3.4,
    },
    {
      id: 'demo-vo-field',
      sceneClipId: 'demo-field',
      label: 'Tactical Field Breakdown',
      text: 'Watch the outswinger seam angle attacking off-stump with two slips and a catching mid-off.',
      captionText: 'Outswinger seam targets off-stump with 2 slips & gully.',
      startSec: 4.4,
      endSec: 11.4,
      status: 'script-ready',
      estimatedDurationSec: 7.0,
    },
    {
      id: 'demo-vo-q1',
      sceneClipId: 'demo-q1-prompt',
      label: 'Q1 Narration',
      text: quizQuestions[0].prompt,
      captionText: 'Q1: Max fielders outside the 30-yard circle in Powerplay 1?',
      startSec: 12.7,
      endSec: 19.6,
      status: 'script-ready',
      estimatedDurationSec: 6.9,
    },
    {
      id: 'demo-vo-q1-ans',
      sceneClipId: 'demo-q1-rev',
      label: 'Q1 Answer & Explain',
      text: quizQuestions[0].explanation,
      captionText: 'Correct: 2 fielders outside the inner ring in Powerplay 1.',
      startSec: 20.1,
      endSec: 25.6,
      status: 'script-ready',
      estimatedDurationSec: 5.5,
    },
    {
      id: 'demo-vo-q2',
      sceneClipId: 'demo-q2-prompt',
      label: 'Q2 Narration',
      text: quizQuestions[1].prompt,
      captionText: 'Q2: Which fielding position sits between keeper and gully?',
      startSec: 26.7,
      endSec: 33.6,
      status: 'script-ready',
      estimatedDurationSec: 6.9,
    },
    {
      id: 'demo-vo-q2-ans',
      sceneClipId: 'demo-q2-rev',
      label: 'Q2 Answer & Explain',
      text: quizQuestions[1].explanation,
      captionText: 'Correct: The Slip Cordon bridges wicketkeeper to gully.',
      startSec: 34.1,
      endSec: 39.6,
      status: 'script-ready',
      estimatedDurationSec: 5.5,
    },
    {
      id: 'demo-vo-q3',
      sceneClipId: 'demo-q3-prompt',
      label: 'Q3 Narration',
      text: quizQuestions[2].prompt,
      captionText: 'Q3: Which delivery swings away from a right-handed batter?',
      startSec: 40.7,
      endSec: 47.6,
      status: 'script-ready',
      estimatedDurationSec: 6.9,
    },
    {
      id: 'demo-vo-q3-ans',
      sceneClipId: 'demo-q3-rev',
      label: 'Q3 Answer & Explain',
      text: quizQuestions[2].explanation,
      captionText: 'Correct: Outswinger shapes toward the off-side slip cordon.',
      startSec: 48.1,
      endSec: 53.6,
      status: 'script-ready',
      estimatedDurationSec: 5.5,
    },
    {
      id: 'demo-vo-cta',
      sceneClipId: 'demo-cta',
      label: 'Outro CTA',
      text: 'Comment your score below and subscribe to Cricket IQ Academy for the next breakdown!',
      captionText: 'Comment your score & subscribe to @CricketIQAcademy!',
      startSec: 54.3,
      endSec: 59.4,
      status: 'script-ready',
      estimatedDurationSec: 5.1,
    },
  ];

  return migrateProjectToPhase2({
    id: `proj-client-demo-${aspectRatio.replace(':', 'x')}`,
    title: 'Cricket IQ Demo: Powerplay Tactics & 3-Question Challenge (60s)',
    subtitle: 'Polished 60s client showcase — Tactical Field + Ball Path + 3 Quiz Scenes + Branding',
    createdAt: now,
    updatedAt: now,
    fieldDesign,
    quizQuestions,
    settings: {
      aspectRatio,
      fps: 30,
      seriesName: 'Cricket IQ Academy',
      channelHandle: '@CricketIQAcademy',
      showSafeZones: true,
    },
    production: {
      contentType: 'quiz',
      templateType: 'powerplay-breakdown',
      episodeNumber: 'DEMO',
      description:
        '60-second Cricket IQ client showcase featuring tactical powerplay fielding, animated outswinger ball path, 3 broadcast quiz questions, countdowns, and custom branding.',
      targetPlatform: aspectRatio === '9:16' ? 'YouTube Shorts' : 'YouTube',
      quizTargetCount: 3,
    },
    brandKit,
    broadcastGraphics,
    timelineClips,
    voiceoverSegments,
  });
}
