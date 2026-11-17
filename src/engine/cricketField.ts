import type {
  BallPathConfig,
  BatterHandedness,
  FieldDesign,
  FieldPoint,
  FielderPosition,
  FielderRole,
} from '../types/studio';

export const SVG_FIELD_SIZE = 800;
export const SVG_CENTER = SVG_FIELD_SIZE / 2;
export const BOUNDARY_RADIUS_UNITS = 90;
export const INNER_RING_RADIUS_UNITS = 43;

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function roundCoord(value: number): number {
  return Math.round(value * 10) / 10;
}

export function clampFieldPoint(point: FieldPoint, maxRadius = 94): FieldPoint {
  const dist = Math.hypot(point.x, point.y);
  if (dist <= maxRadius) {
    return { x: roundCoord(point.x), y: roundCoord(point.y) };
  }
  const scale = maxRadius / dist;
  return {
    x: roundCoord(point.x * scale),
    y: roundCoord(point.y * scale),
  };
}

export function fieldToSvg(point: FieldPoint): { cx: number; cy: number } {
  const scale = SVG_FIELD_SIZE / 200;
  return {
    cx: SVG_CENTER + point.x * scale,
    cy: SVG_CENTER + point.y * scale,
  };
}

export function svgToField(svgX: number, svgY: number): FieldPoint {
  const scale = SVG_FIELD_SIZE / 200;
  return clampFieldPoint({
    x: (svgX - SVG_CENTER) / scale,
    y: (svgY - SVG_CENTER) / scale,
  });
}

export function distanceFromPitchCenter(point: FieldPoint): number {
  return roundCoord(Math.hypot(point.x, point.y));
}

export function classifyFieldingZone(
  x: number,
  y: number,
  batterHand: BatterHandedness
): string {
  const dist = Math.hypot(x, y);
  if (Math.abs(x) <= 7 && y > 16 && y < 32) return 'Wicketkeeper Area';
  if (Math.abs(x) <= 9 && y < -8 && y > -40) return 'Bowler Run-Up';

  const offSign = batterHand === 'right' ? -1 : 1;
  const sideCoord = x * offSign;
  const isOffSide = sideCoord >= 0;
  const isDeep = dist > INNER_RING_RADIUS_UNITS + 6;
  const prefix = isDeep ? 'Deep ' : '';

  const dy = y - 14;
  const absSide = Math.abs(sideCoord);
  const angleDeg = (Math.atan2(dy, absSide) * 180) / Math.PI;

  if (isOffSide) {
    if (angleDeg > 58) return dist < 24 ? 'First / Second Slip' : 'Third Man';
    if (angleDeg > 25) return dist < 30 ? 'Gully' : isDeep ? 'Deep Backward Point' : 'Backward Point';
    if (angleDeg > -8) return isDeep ? 'Deep Point' : 'Point';
    if (angleDeg > -42) return isDeep ? 'Deep Cover' : 'Cover';
    if (angleDeg > -70) return isDeep ? 'Deep Extra Cover' : 'Extra Cover';
    return isDeep ? 'Long-Off' : 'Mid-Off';
  } else {
    if (angleDeg > 55) return dist < 24 ? 'Leg Slip' : `${prefix}Fine Leg`;
    if (angleDeg > 22) return isDeep ? 'Deep Backward Square' : 'Backward Square Leg';
    if (angleDeg > -12) return isDeep ? 'Deep Square Leg' : 'Square Leg';
    if (angleDeg > -48) return isDeep ? 'Deep Mid-Wicket' : 'Mid-Wicket';
    if (angleDeg > -74) return isDeep ? 'Wide Long-On' : 'Mid-On';
    return isDeep ? 'Long-On' : 'Straight Mid-On';
  }
}

export function inferRoleFromPosition(
  x: number,
  y: number,
  currentRole: FielderRole
): FielderRole {
  if (currentRole === 'bowler' || currentRole === 'wicketkeeper') {
    return currentRole;
  }
  const dist = Math.hypot(x, y);
  if (dist <= 22) return 'close-catcher';
  if (dist <= INNER_RING_RADIUS_UNITS + 4) return 'infield';
  return 'boundary';
}

export interface BallEvaluation {
  phase: 'delivery' | 'bounce' | 'shot' | 'complete';
  position: FieldPoint;
  trail: FieldPoint[];
  bounceReached: boolean;
  impactReached: boolean;
  progress: number;
}

function lerpPoint(a: FieldPoint, b: FieldPoint, t: number): FieldPoint {
  return {
    x: roundCoord(a.x + (b.x - a.x) * t),
    y: roundCoord(a.y + (b.y - a.y) * t),
  };
}

export function evaluateBallPathAtProgress(
  ballPath: BallPathConfig,
  rawProgress: number
): BallEvaluation {
  const p = clamp(rawProgress, 0, 1);
  const seg1End = 0.34;
  const seg2End = 0.52;

  const trail: FieldPoint[] = [ballPath.release];

  if (p <= seg1End) {
    const localT = p / seg1End;
    const pos = lerpPoint(ballPath.release, ballPath.bounce, localT);
    trail.push(pos);
    return {
      phase: 'delivery',
      position: pos,
      trail,
      bounceReached: false,
      impactReached: false,
      progress: p,
    };
  }

  trail.push(ballPath.bounce);

  if (p <= seg2End) {
    const localT = (p - seg1End) / (seg2End - seg1End);
    const pos = lerpPoint(ballPath.bounce, ballPath.impact, localT);
    trail.push(pos);
    return {
      phase: 'bounce',
      position: pos,
      trail,
      bounceReached: true,
      impactReached: false,
      progress: p,
    };
  }

  trail.push(ballPath.impact);

  const localT = (p - seg2End) / (1 - seg2End);
  const easedT = 1 - Math.pow(1 - localT, 1.5);
  const pos = lerpPoint(ballPath.impact, ballPath.end, easedT);
  trail.push(pos);

  return {
    phase: p >= 0.999 ? 'complete' : 'shot',
    position: pos,
    trail,
    bounceReached: true,
    impactReached: true,
    progress: p,
  };
}

export interface BallAnimationPreset {
  id: string;
  name: string;
  category: 'Delivery' | 'Shot' | 'Dismissal' | 'Fielding';
  ballPath: BallPathConfig;
  highlightRoles: FielderRole[];
}

export const BALL_ANIMATION_PRESETS: BallAnimationPreset[] = [
  {
    id: 'anim-yorker',
    name: 'Yorker',
    category: 'Delivery',
    ballPath: {
      release: { x: -4, y: -16 },
      bounce: { x: 0, y: 12.5 },
      impact: { x: 0, y: 14 },
      end: { x: 4, y: 17 },
      deliveryType: 'Yorker',
      shotType: 'Leave',
      speedKmh: 146,
      durationSec: 2.6,
      showTrail: true,
      showBounceMarker: true,
    },
    highlightRoles: ['bowler'],
  },
  {
    id: 'anim-bouncer',
    name: 'Bouncer',
    category: 'Delivery',
    ballPath: {
      release: { x: -4, y: -16 },
      bounce: { x: -1, y: -5 },
      impact: { x: 1, y: 13 },
      end: { x: 0, y: 24 },
      deliveryType: 'Bouncer',
      shotType: 'Leave',
      speedKmh: 145,
      durationSec: 2.5,
      showTrail: true,
      showBounceMarker: true,
    },
    highlightRoles: ['wicketkeeper'],
  },
  {
    id: 'anim-outswing',
    name: 'Outswing',
    category: 'Delivery',
    ballPath: {
      release: { x: -3, y: -16 },
      bounce: { x: -2.5, y: 3 },
      impact: { x: -4.5, y: 13 },
      end: { x: -10, y: 24 },
      deliveryType: 'Outswinger',
      shotType: 'Edge to Slip',
      speedKmh: 139,
      durationSec: 2.8,
      showTrail: true,
      showBounceMarker: true,
    },
    highlightRoles: ['close-catcher'],
  },
  {
    id: 'anim-inswing',
    name: 'Inswing',
    category: 'Delivery',
    ballPath: {
      release: { x: -4, y: -16 },
      bounce: { x: -4, y: 4 },
      impact: { x: 0, y: 14 },
      end: { x: 1, y: 16.5 },
      deliveryType: 'Inswinger',
      shotType: 'Bowled',
      speedKmh: 142,
      durationSec: 2.7,
      showTrail: true,
      showBounceMarker: true,
    },
    highlightRoles: ['bowler'],
  },
  {
    id: 'anim-leg-spin',
    name: 'Leg Spin',
    category: 'Delivery',
    ballPath: {
      release: { x: 4, y: -15 },
      bounce: { x: 3.5, y: 5 },
      impact: { x: -2, y: 13 },
      end: { x: -32, y: -12 },
      deliveryType: 'Leg Spin',
      shotType: 'Cover Drive',
      speedKmh: 84,
      durationSec: 3.4,
      showTrail: true,
      showBounceMarker: true,
    },
    highlightRoles: ['bowler', 'infield'],
  },
  {
    id: 'anim-off-spin',
    name: 'Off Spin',
    category: 'Delivery',
    ballPath: {
      release: { x: -4, y: -15 },
      bounce: { x: -4, y: 5 },
      impact: { x: 1, y: 13 },
      end: { x: 30, y: -10 },
      deliveryType: 'Off Break',
      shotType: 'Sweep',
      speedKmh: 88,
      durationSec: 3.3,
      showTrail: true,
      showBounceMarker: true,
    },
    highlightRoles: ['bowler'],
  },
  {
    id: 'anim-googly',
    name: 'Googly',
    category: 'Delivery',
    ballPath: {
      release: { x: 4, y: -15 },
      bounce: { x: -3, y: 5 },
      impact: { x: 1.5, y: 13.5 },
      end: { x: 0, y: 16.5 },
      deliveryType: 'Googly',
      shotType: 'LBW',
      speedKmh: 86,
      durationSec: 3.2,
      showTrail: true,
      showBounceMarker: true,
    },
    highlightRoles: ['bowler', 'wicketkeeper'],
  },
  {
    id: 'anim-straight-drive',
    name: 'Straight Drive',
    category: 'Shot',
    ballPath: {
      release: { x: -3, y: -16 },
      bounce: { x: -1, y: 5 },
      impact: { x: 0, y: 13 },
      end: { x: -6, y: -89 },
      deliveryType: 'Good Length',
      shotType: 'Straight Drive',
      speedKmh: 136,
      durationSec: 3.2,
      showTrail: true,
      showBounceMarker: true,
    },
    highlightRoles: ['boundary'],
  },
  {
    id: 'anim-cover-drive',
    name: 'Cover Drive',
    category: 'Shot',
    ballPath: {
      release: { x: -4, y: -16 },
      bounce: { x: -3, y: 4 },
      impact: { x: -2, y: 13 },
      end: { x: -82, y: -32 },
      deliveryType: 'Outswinger',
      shotType: 'Cover Drive',
      speedKmh: 141,
      durationSec: 3.2,
      showTrail: true,
      showBounceMarker: true,
    },
    highlightRoles: ['infield'],
  },
  {
    id: 'anim-pull-shot',
    name: 'Pull Shot',
    category: 'Shot',
    ballPath: {
      release: { x: -3, y: -16 },
      bounce: { x: 1, y: -3 },
      impact: { x: 2, y: 13 },
      end: { x: 84, y: -14 },
      deliveryType: 'Bouncer',
      shotType: 'Pull Shot',
      speedKmh: 143,
      durationSec: 3.1,
      showTrail: true,
      showBounceMarker: true,
    },
    highlightRoles: ['boundary'],
  },
  {
    id: 'anim-hook-shot',
    name: 'Hook Shot',
    category: 'Shot',
    ballPath: {
      release: { x: -3, y: -16 },
      bounce: { x: 0, y: -6 },
      impact: { x: 2, y: 13 },
      end: { x: 78, y: 34 },
      deliveryType: 'Bouncer',
      shotType: 'Hook Shot',
      speedKmh: 147,
      durationSec: 3.0,
      showTrail: true,
      showBounceMarker: true,
    },
    highlightRoles: ['boundary'],
  },
  {
    id: 'anim-sweep',
    name: 'Sweep',
    category: 'Shot',
    ballPath: {
      release: { x: 4, y: -15 },
      bounce: { x: 2, y: 6 },
      impact: { x: 2, y: 12 },
      end: { x: 76, y: 20 },
      deliveryType: 'Leg Spin',
      shotType: 'Sweep',
      speedKmh: 85,
      durationSec: 3.4,
      showTrail: true,
      showBounceMarker: true,
    },
    highlightRoles: ['boundary'],
  },
  {
    id: 'anim-reverse-sweep',
    name: 'Reverse Sweep',
    category: 'Shot',
    ballPath: {
      release: { x: -4, y: -15 },
      bounce: { x: -2, y: 6 },
      impact: { x: -1, y: 12 },
      end: { x: -72, y: 30 },
      deliveryType: 'Off Break',
      shotType: 'Reverse Sweep',
      speedKmh: 89,
      durationSec: 3.4,
      showTrail: true,
      showBounceMarker: true,
    },
    highlightRoles: ['infield'],
  },
  {
    id: 'anim-six',
    name: 'Six',
    category: 'Shot',
    ballPath: {
      release: { x: -4, y: -16 },
      bounce: { x: 1, y: 8 },
      impact: { x: 1, y: 13 },
      end: { x: 56, y: -82 },
      deliveryType: 'Good Length',
      shotType: 'Lofted Six',
      speedKmh: 134,
      durationSec: 3.6,
      showTrail: true,
      showBounceMarker: true,
    },
    highlightRoles: ['boundary'],
  },
  {
    id: 'anim-four',
    name: 'Four',
    category: 'Shot',
    ballPath: {
      release: { x: -4, y: -16 },
      bounce: { x: -3, y: 5 },
      impact: { x: -2, y: 13 },
      end: { x: -86, y: 10 },
      deliveryType: 'Good Length',
      shotType: 'Four',
      speedKmh: 137,
      durationSec: 3.2,
      showTrail: true,
      showBounceMarker: true,
    },
    highlightRoles: ['infield', 'boundary'],
  },
  {
    id: 'anim-caught',
    name: 'Caught',
    category: 'Dismissal',
    ballPath: {
      release: { x: -3, y: -16 },
      bounce: { x: 0, y: 4 },
      impact: { x: 2, y: 13 },
      end: { x: 35, y: -10 },
      deliveryType: 'Good Length',
      shotType: 'Caught',
      speedKmh: 135,
      durationSec: 2.9,
      showTrail: true,
      showBounceMarker: true,
    },
    highlightRoles: ['infield'],
  },
  {
    id: 'anim-bowled',
    name: 'Bowled',
    category: 'Dismissal',
    ballPath: {
      release: { x: -3, y: -16 },
      bounce: { x: -2, y: 9 },
      impact: { x: 0, y: 13.5 },
      end: { x: 0, y: 16 },
      deliveryType: 'Inswinger',
      shotType: 'Bowled',
      speedKmh: 144,
      durationSec: 2.4,
      showTrail: true,
      showBounceMarker: true,
    },
    highlightRoles: ['bowler'],
  },
  {
    id: 'anim-lbw',
    name: 'LBW',
    category: 'Dismissal',
    ballPath: {
      release: { x: -3, y: -16 },
      bounce: { x: -1, y: 7 },
      impact: { x: 0, y: 13.5 },
      end: { x: 1, y: 14.5 },
      deliveryType: 'Inswinger',
      shotType: 'LBW',
      speedKmh: 140,
      durationSec: 2.4,
      showTrail: true,
      showBounceMarker: true,
    },
    highlightRoles: ['bowler', 'wicketkeeper'],
  },
  {
    id: 'anim-run-out',
    name: 'Run Out',
    category: 'Dismissal',
    ballPath: {
      release: { x: -33, y: -15 },
      bounce: { x: -14, y: 4 },
      impact: { x: 0, y: 15 },
      end: { x: 0, y: 16 },
      deliveryType: 'Good Length',
      shotType: 'Run Out',
      speedKmh: 112,
      durationSec: 2.5,
      showTrail: true,
      showBounceMarker: true,
    },
    highlightRoles: ['infield', 'wicketkeeper'],
  },
  {
    id: 'anim-stumping',
    name: 'Stumping',
    category: 'Dismissal',
    ballPath: {
      release: { x: 4, y: -15 },
      bounce: { x: -3, y: 7 },
      impact: { x: -2, y: 13 },
      end: { x: 0, y: 21 },
      deliveryType: 'Leg Spin',
      shotType: 'Stumping',
      speedKmh: 84,
      durationSec: 2.6,
      showTrail: true,
      showBounceMarker: true,
    },
    highlightRoles: ['wicketkeeper'],
  },
  {
    id: 'anim-edge-to-slip',
    name: 'Edge to Slip',
    category: 'Dismissal',
    ballPath: {
      release: { x: -3, y: -16 },
      bounce: { x: -3.5, y: 2 },
      impact: { x: -2.5, y: 13 },
      end: { x: -11, y: 25 },
      deliveryType: 'Outswinger',
      shotType: 'Edge to Slip',
      speedKmh: 139,
      durationSec: 2.7,
      showTrail: true,
      showBounceMarker: true,
    },
    highlightRoles: ['close-catcher'],
  },
  {
    id: 'anim-misfield',
    name: 'Misfield',
    category: 'Fielding',
    ballPath: {
      release: { x: -3, y: -16 },
      bounce: { x: -1, y: 5 },
      impact: { x: 0, y: 13 },
      end: { x: -78, y: -22 },
      deliveryType: 'Good Length',
      shotType: 'Misfield',
      speedKmh: 132,
      durationSec: 3.4,
      showTrail: true,
      showBounceMarker: true,
    },
    highlightRoles: ['infield'],
  },
  {
    id: 'anim-boundary-save',
    name: 'Boundary Save',
    category: 'Fielding',
    ballPath: {
      release: { x: -3, y: -16 },
      bounce: { x: 1, y: 6 },
      impact: { x: 2, y: 13 },
      end: { x: 74, y: 18 },
      deliveryType: 'Good Length',
      shotType: 'Boundary Save',
      speedKmh: 136,
      durationSec: 3.5,
      showTrail: true,
      showBounceMarker: true,
    },
    highlightRoles: ['boundary'],
  },
];

export function applyBallAnimationPreset(
  current: FieldDesign,
  presetId: string
): FieldDesign {
  const preset = BALL_ANIMATION_PRESETS.find((p) => p.id === presetId);
  if (!preset) return current;
  return {
    ...current,
    ballPath: {
      ...preset.ballPath,
      release: { ...preset.ballPath.release },
      bounce: { ...preset.ballPath.bounce },
      impact: { ...preset.ballPath.impact },
      end: { ...preset.ballPath.end },
      presetId: preset.id,
    },
    fielders: current.fielders.map((f) => ({
      ...f,
      highlighted: preset.highlightRoles.includes(f.role),
    })),
  };
}

export interface FieldPreset {
  id: string;
  name: string;
  description: string;
  fielders: FielderPosition[];
  ballPath: BallPathConfig;
}

export const FIELD_PRESETS: FieldPreset[] = [
  {
    id: 'powerplay-attack',
    name: 'Powerplay Attack (2 Slips)',
    description: 'Aggressive ODI/T20 powerplay ring with two slips and catching mid-off.',
    fielders: [
      { id: 'f1', name: 'Bowler', shortLabel: 'BWL', jerseyNumber: 93, x: -3, y: -26, role: 'bowler', highlighted: false },
      { id: 'f2', name: 'Wicketkeeper', shortLabel: 'WK', jerseyNumber: 17, x: 0, y: 24, role: 'wicketkeeper', highlighted: false },
      { id: 'f3', name: 'First Slip', shortLabel: 'SL1', jerseyNumber: 18, x: -8, y: 26, role: 'close-catcher', highlighted: true },
      { id: 'f4', name: 'Second Slip', shortLabel: 'SL2', jerseyNumber: 45, x: -13, y: 24, role: 'close-catcher', highlighted: false },
      { id: 'f5', name: 'Backward Point', shortLabel: 'BPT', jerseyNumber: 8, x: -34, y: 17, role: 'infield', highlighted: false },
      { id: 'f6', name: 'Extra Cover', shortLabel: 'ECV', jerseyNumber: 77, x: -33, y: -15, role: 'infield', highlighted: false },
      { id: 'f7', name: 'Mid-Off', shortLabel: 'MOF', jerseyNumber: 33, x: -17, y: -34, role: 'infield', highlighted: false },
      { id: 'f8', name: 'Mid-On', shortLabel: 'MON', jerseyNumber: 1, x: 18, y: -33, role: 'infield', highlighted: false },
      { id: 'f9', name: 'Mid-Wicket', shortLabel: 'MWK', jerseyNumber: 63, x: 35, y: -10, role: 'infield', highlighted: false },
      { id: 'f10', name: 'Deep Square Leg', shortLabel: 'DSL', jerseyNumber: 12, x: 74, y: 18, role: 'boundary', highlighted: false },
      { id: 'f11', name: 'Third Man', shortLabel: '3RD', jerseyNumber: 99, x: -52, y: 65, role: 'boundary', highlighted: false },
    ],
    ballPath: {
      release: { x: -4, y: -16 },
      bounce: { x: -3, y: 4 },
      impact: { x: -2, y: 13 },
      end: { x: -72, y: -22 },
      deliveryType: 'Outswinger',
      shotType: 'Cover Drive',
      speedKmh: 141,
      durationSec: 3.2,
      showTrail: true,
      showBounceMarker: true,
      presetId: 'anim-cover-drive',
    },
  },
  {
    id: 'death-overs-defend',
    name: 'Death Overs Boundary Protection',
    description: 'Five boundary riders guarding wide yorker lines in overs 17–20.',
    fielders: [
      { id: 'f1', name: 'Bowler', shortLabel: 'BWL', jerseyNumber: 93, x: -4, y: -25, role: 'bowler', highlighted: true },
      { id: 'f2', name: 'Wicketkeeper', shortLabel: 'WK', jerseyNumber: 17, x: 0, y: 24, role: 'wicketkeeper', highlighted: false },
      { id: 'f3', name: 'Short Third', shortLabel: 'S3M', jerseyNumber: 23, x: -27, y: 29, role: 'infield', highlighted: false },
      { id: 'f4', name: 'Backward Point', shortLabel: 'BPT', jerseyNumber: 8, x: -39, y: 14, role: 'infield', highlighted: false },
      { id: 'f5', name: 'Deep Cover', shortLabel: 'DCV', jerseyNumber: 77, x: -76, y: -26, role: 'boundary', highlighted: false },
      { id: 'f6', name: 'Long-Off', shortLabel: 'LOF', jerseyNumber: 33, x: -38, y: -76, role: 'boundary', highlighted: false },
      { id: 'f7', name: 'Long-On', shortLabel: 'LON', jerseyNumber: 1, x: 36, y: -77, role: 'boundary', highlighted: false },
      { id: 'f8', name: 'Deep Mid-Wicket', shortLabel: 'DMW', jerseyNumber: 63, x: 76, y: -25, role: 'boundary', highlighted: true },
      { id: 'f9', name: 'Deep Square Leg', shortLabel: 'DSL', jerseyNumber: 12, x: 80, y: 14, role: 'boundary', highlighted: false },
      { id: 'f10', name: 'Short Fine Leg', shortLabel: 'SFL', jerseyNumber: 45, x: 26, y: 29, role: 'infield', highlighted: false },
      { id: 'f11', name: 'Extra Cover Ring', shortLabel: 'ECR', jerseyNumber: 18, x: -31, y: -16, role: 'infield', highlighted: false },
    ],
    ballPath: {
      release: { x: -4, y: -16 },
      bounce: { x: -2, y: 11 },
      impact: { x: -1, y: 14 },
      end: { x: 82, y: -32 },
      deliveryType: 'Yorker',
      shotType: 'Lofted Six',
      speedKmh: 144,
      durationSec: 3.4,
      showTrail: true,
      showBounceMarker: true,
      presetId: 'anim-six',
    },
  },
  {
    id: 'test-slip-cordon',
    name: 'Test Match Slip Cordon',
    description: 'Classic red-ball cordon with three slips, gully, and silly mid-off.',
    fielders: [
      { id: 'f1', name: 'Bowler', shortLabel: 'BWL', jerseyNumber: 9, x: -3, y: -27, role: 'bowler', highlighted: true },
      { id: 'f2', name: 'Wicketkeeper', shortLabel: 'WK', jerseyNumber: 5, x: 0, y: 25, role: 'wicketkeeper', highlighted: false },
      { id: 'f3', name: 'First Slip', shortLabel: 'SL1', jerseyNumber: 14, x: -7, y: 27, role: 'close-catcher', highlighted: true },
      { id: 'f4', name: 'Second Slip', shortLabel: 'SL2', jerseyNumber: 22, x: -12, y: 26, role: 'close-catcher', highlighted: false },
      { id: 'f5', name: 'Third Slip', shortLabel: 'SL3', jerseyNumber: 31, x: -17, y: 24, role: 'close-catcher', highlighted: false },
      { id: 'f6', name: 'Gully', shortLabel: 'GUL', jerseyNumber: 44, x: -24, y: 20, role: 'close-catcher', highlighted: false },
      { id: 'f7', name: 'Point', shortLabel: 'PNT', jerseyNumber: 7, x: -38, y: 10, role: 'infield', highlighted: false },
      { id: 'f8', name: 'Cover', shortLabel: 'COV', jerseyNumber: 11, x: -36, y: -12, role: 'infield', highlighted: false },
      { id: 'f9', name: 'Mid-Off', shortLabel: 'MOF', jerseyNumber: 27, x: -17, y: -36, role: 'infield', highlighted: false },
      { id: 'f10', name: 'Mid-On', shortLabel: 'MON', jerseyNumber: 19, x: 16, y: -36, role: 'infield', highlighted: false },
      { id: 'f11', name: 'Fine Leg', shortLabel: 'FNL', jerseyNumber: 88, x: 46, y: 66, role: 'boundary', highlighted: false },
    ],
    ballPath: {
      release: { x: -3, y: -16 },
      bounce: { x: -3.5, y: 2 },
      impact: { x: -2.5, y: 13 },
      end: { x: -12, y: 26 },
      deliveryType: 'Outswinger',
      shotType: 'Edge to Slip',
      speedKmh: 138,
      durationSec: 2.8,
      showTrail: true,
      showBounceMarker: true,
      presetId: 'anim-edge-to-slip',
    },
  },
  {
    id: 'spin-chokehold',
    name: 'Spin Chokehold (Catching Leg)',
    description: 'Attacking spin setup with slip, leg slip, short leg, and deep sweepers.',
    fielders: [
      { id: 'f1', name: 'Bowler', shortLabel: 'SPN', jerseyNumber: 99, x: 4, y: -23, role: 'bowler', highlighted: true },
      { id: 'f2', name: 'Wicketkeeper', shortLabel: 'WK', jerseyNumber: 17, x: 0, y: 22, role: 'wicketkeeper', highlighted: false },
      { id: 'f3', name: 'Slip', shortLabel: 'SLP', jerseyNumber: 18, x: -7, y: 23, role: 'close-catcher', highlighted: false },
      { id: 'f4', name: 'Short Leg', shortLabel: 'SHL', jerseyNumber: 21, x: 11, y: 13, role: 'close-catcher', highlighted: true },
      { id: 'f5', name: 'Silly Point', shortLabel: 'SYP', jerseyNumber: 4, x: -13, y: 11, role: 'close-catcher', highlighted: false },
      { id: 'f6', name: 'Cover', shortLabel: 'COV', jerseyNumber: 77, x: -34, y: -12, role: 'infield', highlighted: false },
      { id: 'f7', name: 'Long-Off', shortLabel: 'LOF', jerseyNumber: 33, x: -32, y: -79, role: 'boundary', highlighted: false },
      { id: 'f8', name: 'Long-On', shortLabel: 'LON', jerseyNumber: 1, x: 30, y: -80, role: 'boundary', highlighted: false },
      { id: 'f9', name: 'Mid-Wicket', shortLabel: 'MWK', jerseyNumber: 63, x: 36, y: -15, role: 'infield', highlighted: false },
      { id: 'f10', name: 'Deep Square Leg', shortLabel: 'DSL', jerseyNumber: 12, x: 76, y: 18, role: 'boundary', highlighted: false },
      { id: 'f11', name: 'Deep Point', shortLabel: 'DPT', jerseyNumber: 8, x: -79, y: 12, role: 'boundary', highlighted: false },
    ],
    ballPath: {
      release: { x: 4, y: -15 },
      bounce: { x: -3, y: 5 },
      impact: { x: 1, y: 13 },
      end: { x: 64, y: 28 },
      deliveryType: 'Googly',
      shotType: 'Sweep',
      speedKmh: 86,
      durationSec: 3.6,
      showTrail: true,
      showBounceMarker: true,
      presetId: 'anim-sweep',
    },
  },
];

export function cloneFieldDesignFromPreset(presetId: string): FieldDesign {
  const preset = FIELD_PRESETS.find((p) => p.id === presetId) ?? FIELD_PRESETS[0];
  return {
    fielders: preset.fielders.map((f) => ({ ...f })),
    ballPath: {
      ...preset.ballPath,
      release: { ...preset.ballPath.release },
      bounce: { ...preset.ballPath.bounce },
      impact: { ...preset.ballPath.impact },
      end: { ...preset.ballPath.end },
    },
    batterHand: 'right',
    show30YardCircle: true,
    showZoneLabels: true,
    showGrid: false,
    activePresetName: preset.name,
  };
}
