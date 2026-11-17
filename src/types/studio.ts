export type StudioModuleId =
  | 'dashboard'
  | 'timeline'
  | 'field'
  | 'quiz'
  | 'graphics'
  | 'audio'
  | 'preview'
  | 'export'
  | 'publish'
  | 'projects';

export type AspectRatio = '16:9' | '9:16' | '1:1';

export type ContentType =
  | 'quiz'
  | 'field-analysis'
  | 'match-breakdown'
  | 'player-analysis'
  | 'cricket-explainer'
  | 'rules-explainer'
  | 'short-reel'
  | 'custom';

export type ProjectTemplateType =
  | 'blank'
  | 'quiz-30'
  | 'quiz-10'
  | 'powerplay-breakdown'
  | 'death-overs-analysis'
  | 'field-placement-explanation'
  | 'player-technique-breakdown'
  | 'custom';

export type BatterHandedness = 'right' | 'left';

export type FielderRole =
  | 'bowler'
  | 'wicketkeeper'
  | 'close-catcher'
  | 'infield'
  | 'boundary';

export interface FieldPoint {
  x: number; // -100 (left) to 100 (right)
  y: number; // -100 (bowler's end / top) to 100 (batter's end / bottom)
}

export interface FielderPosition {
  id: string;
  name: string;
  shortLabel: string;
  jerseyNumber: number;
  x: number;
  y: number;
  role: FielderRole;
  highlighted: boolean;
}

export type BallDeliveryType =
  | 'Yorker'
  | 'Good Length'
  | 'Bouncer'
  | 'Outswinger'
  | 'Inswinger'
  | 'Leg Spin'
  | 'Off Break'
  | 'Googly';

export type ShotType =
  | 'Straight Drive'
  | 'Cover Drive'
  | 'Pull Shot'
  | 'Hook Shot'
  | 'Square Cut'
  | 'Sweep'
  | 'Reverse Sweep'
  | 'Lofted Six'
  | 'Four'
  | 'Caught'
  | 'Bowled'
  | 'LBW'
  | 'Run Out'
  | 'Stumping'
  | 'Edge to Slip'
  | 'Misfield'
  | 'Boundary Save'
  | 'Leave';

export interface BallPathConfig {
  release: FieldPoint;
  bounce: FieldPoint;
  impact: FieldPoint;
  end: FieldPoint;
  deliveryType: BallDeliveryType;
  shotType: ShotType;
  speedKmh: number;
  durationSec: number;
  showTrail: boolean;
  showBounceMarker: boolean;
  presetId?: string;
}

export interface FieldDesign {
  fielders: FielderPosition[];
  ballPath: BallPathConfig;
  batterHand: BatterHandedness;
  show30YardCircle: boolean;
  showZoneLabels: boolean;
  showGrid: boolean;
  activePresetName: string;
}

export interface FieldSceneRecord {
  id: string;
  name: string;
  createdAt: string;
  fieldDesign: FieldDesign;
  framing: {
    zoom: number;
    panX: number;
    panY: number;
  };
  overlayIds: string[];
}

export type QuizOptionIndex = 0 | 1 | 2 | 3;

export type QuizDifficulty = 'easy' | 'medium' | 'hard';

export interface QuizQuestion {
  id: string;
  index: number; // 0..99
  prompt: string;
  options: [string, string, string, string];
  correctIndex: QuizOptionIndex;
  countdownSec: number;
  explanation: string;
  category: string;
  difficulty?: QuizDifficulty;
  includeFieldOverlay: boolean;
}

export type PreviewSequenceMode = 'timeline' | 'field' | 'quiz' | 'combined';

export interface ProjectSettings {
  aspectRatio: AspectRatio;
  fps: 30 | 60;
  seriesName: string;
  channelHandle: string;
  showSafeZones: boolean;
  customResolution?: {
    width: number;
    height: number;
  };
}

export interface ProductionSettings {
  contentType: ContentType;
  templateType: ProjectTemplateType;
  episodeNumber: string;
  description: string;
  targetPlatform: 'YouTube' | 'YouTube Shorts' | 'Instagram Reels' | 'Multi-Platform';
  quizTargetCount: number; // e.g., 10, 30, or up to 100
}

export interface BrandKit {
  id: string;
  name: string;
  brandName: string;
  channelName: string;
  logoAssetId: string | null;
  logoTextFallback: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  headingFont: string;
  bodyFont: string;
  watermarkText: string;
  youtubeHandle: string;
  website: string;
  ctaText: string;
}

export type BroadcastGraphicType =
  | 'score-bug'
  | 'player-card'
  | 'bowler-card'
  | 'batsman-card'
  | 'team-comparison'
  | 'stat-card'
  | 'lower-third'
  | 'match-situation'
  | 'over-summary'
  | 'required-run-rate'
  | 'partnership'
  | 'wagon-wheel'
  | 'field-position-labels';

export interface BroadcastGraphicOverlay {
  id: string;
  type: BroadcastGraphicType;
  label: string;
  title: string;
  subtitle: string;
  valueText: string;
  teamName: string;
  playerName: string;
  accentColor: string;
  position: { x: number; y: number }; // 0..100 percentage inside safe frame
  startSec: number;
  durationSec: number;
  enabled: boolean;
}

export type AssetCategory =
  | 'logos'
  | 'player-images'
  | 'team-logos'
  | 'backgrounds'
  | 'audio'
  | 'music'
  | 'sfx'
  | 'cricket-graphics'
  | 'custom-media';

export interface StudioAsset {
  id: string;
  name: string;
  category: AssetCategory;
  mimeType: string;
  sizeBytes: number;
  durationSec?: number;
  dataUrl?: string;
  assetId?: string;
  createdAt: string;
  fingerprint?: string;
}

export type AudioCategory =
  | 'voiceover'
  | 'music'
  | 'crowd'
  | 'bat-hit'
  | 'ball-hit'
  | 'wicket'
  | 'appeal'
  | 'cheer'
  | 'countdown-tick'
  | 'answer-correct'
  | 'answer-wrong'
  | 'whoosh'
  | 'transition'
  | 'custom';

export interface AudioAsset {
  id: string;
  name: string;
  category: AudioCategory;
  durationSec: number;
  sizeBytes: number;
  dataUrl?: string;
  assetId?: string;
  createdAt: string;
}

export interface AutoSfxSettings {
  enabled: boolean;
  countdownTick: boolean;
  correctSting: boolean;
  wrongSting: boolean;
  boundaryCheer: boolean;
  wicketSting: boolean;
  batImpact: boolean;
  sceneWhoosh: boolean;
}

export interface AudioMixSettings {
  masterMuted: boolean;
  voiceVolume: number; // 0..1.2
  musicVolume: number; // 0..1.2
  sfxVolume: number; // 0..1.2
}

export type TimelineTrackId =
  | 'video'
  | 'graphics'
  | 'quiz'
  | 'field'
  | 'voiceover'
  | 'music'
  | 'sfx';

export interface TimelineTrack {
  id: TimelineTrackId;
  label: string;
  muted: boolean;
  locked: boolean;
}

export type TimelineClipType =
  | 'intro'
  | 'question'
  | 'countdown'
  | 'reveal'
  | 'explanation'
  | 'transition'
  | 'cta'
  | 'outro'
  | 'field-scene'
  | 'graphic'
  | 'voiceover'
  | 'music'
  | 'sfx';

export type TimelineClipStatus = 'ready' | 'draft' | 'missing-audio';

export type TransitionType =
  | 'cut'
  | 'fade'
  | 'crossfade'
  | 'slide-left'
  | 'slide-right'
  | 'zoom'
  | 'broadcast-wipe';

export interface TimelineClip {
  id: string;
  trackId: TimelineTrackId;
  name: string;
  startSec: number;
  durationSec: number;
  type: TimelineClipType;
  status: TimelineClipStatus;
  questionIndex?: number;
  fieldSceneId?: string;
  graphicId?: string;
  audioAssetId?: string;
  audioCategory?: AudioCategory;
  volume?: number; // 0..1.2
  fadeInSec?: number;
  fadeOutSec?: number;
  muted?: boolean;
  loop?: boolean;
  transitionType?: TransitionType;
  transitionDurationSec?: number;
  notes?: string;
}

export interface AutoEpisodeTiming {
  introSec: number;
  questionSec: number;
  countdownSec: number;
  revealSec: number;
  explanationSec: number;
  transitionSec: number;
  ctaSec: number;
  outroSec: number;
}

export type VoiceoverStatus = 'not-created' | 'script-ready' | 'audio-attached';

export type CaptionStyle = 'broadcast' | 'minimal' | 'bold-shorts';

export interface CaptionSettings {
  enabled: boolean;
  style: CaptionStyle;
  fontSize: number;
  showBackground: boolean;
  textOutline: boolean;
}

export interface BrandOverlaySettings {
  logoScale: number;
  watermarkOpacity: number; // 0..1
  watermarkScale: number;
  showWatermark: boolean;
  showChannelHandle: boolean;
}

export interface FieldRenderOptions {
  showLabels: boolean;
  showTrajectoryTrail: boolean;
  showBounceMarker: boolean;
  showSpeedGraphic: boolean;
}

export interface ExportHistoryEntry {
  id: string;
  projectId: string;
  projectTitle: string;
  exportedAt: string;
  resolution: string;
  aspectRatio: AspectRatio;
  fps: 30 | 60;
  durationSec: number;
  format: 'mp4' | 'webm';
  fileSizeBytes: number;
  status: 'completed' | 'failed' | 'cancelled';
}

export interface VoiceoverSegment {
  id: string;
  sceneClipId: string;
  label: string;
  text: string;
  status: VoiceoverStatus;
  estimatedDurationSec: number;
  audioAssetId?: string;
  captionText?: string;
  startSec?: number;
  endSec?: number;
}

export interface YouTubeMetadata {
  videoTitle: string;
  description: string;
  tags: string[];
  hashtags: string[];
  chapterMarkersText: string;
  pinnedComment: string;
  thumbnailText: string;
  cta: string;
}

export interface ThumbnailElement {
  id: string;
  kind:
    | 'background'
    | 'player-placeholder'
    | 'text'
    | 'arrow'
    | 'circle'
    | 'stat-badge'
    | 'logo'
    | 'badge';
  text?: string;
  x: number; // 0..1280
  y: number; // 0..720
  width: number;
  height: number;
  scale: number;
  rotation: number;
  fontSize?: number;
  color?: string;
  bgColor?: string;
}

export interface ThumbnailDesign {
  templateId: string;
  bgColor: string;
  accentColor: string;
  elements: ThumbnailElement[];
}

export interface ProjectSnapshot {
  id: string;
  name: string;
  createdAt: string;
  projectDataJson: string;
}

export interface CricketProject {
  id: string;
  schemaVersion?: number;
  title: string;
  subtitle: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
  fieldDesign: FieldDesign;
  fieldScenes: FieldSceneRecord[];
  quizQuestions: QuizQuestion[];
  settings: ProjectSettings;
  production: ProductionSettings;
  brandKit: BrandKit;
  broadcastGraphics: BroadcastGraphicOverlay[];
  assets: StudioAsset[];
  audioAssets: AudioAsset[];
  autoSfx: AutoSfxSettings;
  audioMix: AudioMixSettings;
  timelineTracks: TimelineTrack[];
  timelineClips: TimelineClip[];
  autoEpisodeTiming: AutoEpisodeTiming;
  voiceoverSegments: VoiceoverSegment[];
  youtubeMetadata: YouTubeMetadata;
  thumbnailDesign: ThumbnailDesign;
  snapshots: ProjectSnapshot[];
  captionSettings?: CaptionSettings;
  brandOverlay?: BrandOverlaySettings;
  fieldRenderOptions?: FieldRenderOptions;
  defaultTransition?: {
    type: TransitionType;
    durationSec: number;
  };
}

export interface StudioWorkspace {
  version: number;
  activeProjectId: string;
  projects: CricketProject[];
  brandPresets: BrandKit[];
  exportHistory?: ExportHistoryEntry[];
}
