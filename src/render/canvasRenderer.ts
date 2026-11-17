import type {
  AspectRatio,
  BrandKit,
  BrandOverlaySettings,
  BroadcastGraphicOverlay,
  CaptionSettings,
  FieldDesign,
  FieldRenderOptions,
  TransitionType,
} from '../types/studio';
import type { BallEvaluation } from '../engine/cricketField';
import type { ActiveTransitionState, RenderSceneState } from '../engine/timeline';

export type AnyCanvasContext2D =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

export interface SafeLayoutBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutHints {
  hasTopGraphic?: boolean;
  hasBottomGraphic?: boolean;
  hasCaption?: boolean;
}

export interface AdaptedFrameLayout {
  width: number;
  height: number;
  aspectRatio: AspectRatio;
  isPortrait: boolean;
  isSquare: boolean;
  safeBox: SafeLayoutBox;
  topHudBox: SafeLayoutBox;
  contentBox: SafeLayoutBox;
  fieldBox: SafeLayoutBox;
  fieldInfoBox: SafeLayoutBox;
  quizBox: SafeLayoutBox;
  captionY: number;
  captionMaxWidth: number;
  watermarkPos: { x: number; y: number; align: CanvasTextAlign };
  logoPos: { x: number; y: number; size: number };
}

export function adaptLayoutForAspectRatio(
  width: number,
  height: number,
  aspectRatio: AspectRatio,
  hints: LayoutHints = {}
): AdaptedFrameLayout {
  const isPortrait = aspectRatio === '9:16' || height > width * 1.15;
  const isSquare = aspectRatio === '1:1' || Math.abs(width - height) < width * 0.1;
  const baseUnit = Math.min(width, height);

  // Broadcast safe margins: 5.5% horizontal; reserve clean top row for watermark/logo and bottom row for captions/Shorts HUD
  const marginX = Math.round(width * 0.055);
  const topMargin = Math.round(height * (isPortrait ? 0.075 : 0.068));
  const bottomMargin = Math.round(height * (isPortrait ? 0.13 : 0.065));

  const safeBox: SafeLayoutBox = {
    x: marginX,
    y: topMargin,
    width: width - marginX * 2,
    height: height - topMargin - bottomMargin,
  };

  // Dedicated Top Broadcast Graphic HUD band (clears top-right watermark and separates from quiz/field stage)
  const hudCardH = Math.round(Math.max(66, baseUnit * 0.092));
  const hudCardW = isPortrait
    ? safeBox.width
    : Math.round(Math.min(safeBox.width * 0.54, width * 0.56));
  const topHudBox: SafeLayoutBox = {
    x: safeBox.x,
    y: safeBox.y,
    width: hudCardW,
    height: hudCardH,
  };
  const topHudReserve = hints.hasTopGraphic
    ? hudCardH + Math.round(height * 0.018)
    : 0;

  const captionY = isPortrait
    ? Math.round(height * 0.825)
    : Math.round(height * 0.895);

  const captionHalfReserve = Math.round(Math.max(36, baseUnit * 0.056));
  const bottomGraphicReserve = hints.hasBottomGraphic
    ? hudCardH + Math.round(height * 0.018)
    : 0;
  const captionLimit = hints.hasCaption
    ? captionY - captionHalfReserve - Math.round(height * 0.016)
    : safeBox.y + safeBox.height;

  const contentTop = safeBox.y + topHudReserve;
  const contentBottom = Math.min(
    safeBox.y + safeBox.height - bottomGraphicReserve,
    captionLimit
  );
  const contentBox: SafeLayoutBox = {
    x: safeBox.x,
    y: contentTop,
    width: safeBox.width,
    height: Math.max(200, contentBottom - contentTop),
  };

  let fieldBox: SafeLayoutBox;
  let fieldInfoBox: SafeLayoutBox;

  if (isPortrait) {
    const sqSize = Math.min(contentBox.width, Math.round(contentBox.height * 0.56));
    fieldBox = {
      x: Math.round((width - sqSize) / 2),
      y: contentBox.y + Math.round(height * 0.012),
      width: sqSize,
      height: sqSize,
    };
    fieldInfoBox = {
      x: contentBox.x,
      y: fieldBox.y + fieldBox.height + Math.round(height * 0.018),
      width: contentBox.width,
      height: Math.max(
        120,
        contentBox.y + contentBox.height - (fieldBox.y + fieldBox.height + Math.round(height * 0.02))
      ),
    };
  } else if (isSquare) {
    const sqSize = Math.min(contentBox.width, Math.round(contentBox.height * 0.66));
    fieldBox = {
      x: Math.round((width - sqSize) / 2),
      y: contentBox.y + Math.round(height * 0.01),
      width: sqSize,
      height: sqSize,
    };
    fieldInfoBox = {
      x: contentBox.x,
      y: fieldBox.y + fieldBox.height + 14,
      width: contentBox.width,
      height: Math.max(
        100,
        contentBox.y + contentBox.height - (fieldBox.y + fieldBox.height + 16)
      ),
    };
  } else {
    const sqSize = Math.min(
      Math.round(contentBox.height * 0.96),
      Math.round(contentBox.width * 0.5)
    );
    fieldBox = {
      x: contentBox.x,
      y: contentBox.y + Math.round((contentBox.height - sqSize) / 2),
      width: sqSize,
      height: sqSize,
    };
    const gap = Math.round(width * 0.025);
    fieldInfoBox = {
      x: fieldBox.x + fieldBox.width + gap,
      y: fieldBox.y + Math.round(sqSize * 0.04),
      width: contentBox.x + contentBox.width - (fieldBox.x + fieldBox.width + gap),
      height: Math.round(sqSize * 0.92),
    };
  }

  const quizBox: SafeLayoutBox = {
    x: contentBox.x,
    y: contentBox.y,
    width: contentBox.width,
    height: contentBox.height,
  };

  const logoSize = Math.max(34, Math.round(baseUnit * 0.045));

  return {
    width,
    height,
    aspectRatio,
    isPortrait,
    isSquare,
    safeBox,
    topHudBox,
    contentBox,
    fieldBox,
    fieldInfoBox,
    quizBox,
    captionY,
    captionMaxWidth: Math.round(safeBox.width * 0.88),
    watermarkPos: {
      x: width - marginX,
      y: isPortrait ? Math.round(height * 0.038) : Math.round(height * 0.042),
      align: 'right',
    },
    logoPos: {
      x: marginX,
      y: isPortrait ? Math.round(height * 0.028) : Math.round(height * 0.03),
      size: logoSize,
    },
  };
}

export function drawRoundedRectPath(
  ctx: AnyCanvasContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

const MAX_WRAP_CACHE_ENTRIES = 64;
const wrapLinesCache = new Map<string, string[]>();

const MAX_STATIC_CANVAS_CACHE = 4;
const staticFieldLayerCache = new Map<string, OffscreenCanvas>();
const staticQuizBackdropCache = new Map<string, OffscreenCanvas>();

export function clearRendererCaches() {
  wrapLinesCache.clear();
  for (const c of staticFieldLayerCache.values()) {
    c.width = 0;
    c.height = 0;
  }
  staticFieldLayerCache.clear();
  for (const c of staticQuizBackdropCache.values()) {
    c.width = 0;
    c.height = 0;
  }
  staticQuizBackdropCache.clear();
}

function putBoundedCanvasCache(
  cache: Map<string, OffscreenCanvas>,
  key: string,
  canvas: OffscreenCanvas,
  maxEntries: number
) {
  if (cache.size >= maxEntries) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      const evicted = cache.get(oldestKey);
      if (evicted) {
        evicted.width = 0;
        evicted.height = 0;
      }
      cache.delete(oldestKey);
    }
  }
  cache.set(key, canvas);
}

export function wrapCanvasLines(
  ctx: AnyCanvasContext2D,
  text: string,
  maxWidth: number,
  maxLines = 6
): string[] {
  const cacheKey = `${ctx.font}|${Math.round(maxWidth)}|${maxLines}|${text}`;
  const cached = wrapLinesCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;
    let current = words[0];
    for (let i = 1; i < words.length; i++) {
      const candidate = `${current} ${words[i]}`;
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
      } else {
        lines.push(current);
        current = words[i];
        if (lines.length >= maxLines) break;
      }
    }
    if (lines.length < maxLines) {
      lines.push(current);
    }
    if (lines.length >= maxLines) break;
  }

  const result = lines.length > 0 ? lines : [''];
  if (wrapLinesCache.size >= MAX_WRAP_CACHE_ENTRIES) {
    const firstKey = wrapLinesCache.keys().next().value;
    if (firstKey !== undefined) wrapLinesCache.delete(firstKey);
  }
  wrapLinesCache.set(cacheKey, result);
  return result;
}

function drawStaticCricketGroundBase(
  targetCtx: AnyCanvasContext2D,
  fieldDesign: FieldDesign,
  box: SafeLayoutBox,
  options: FieldRenderOptions,
  isPortraitCrop: boolean
) {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const scaleFactor = isPortraitCrop ? 1.02 : 1;
  const radius = Math.min(box.width, box.height) * 0.445 * scaleFactor;
  const toPx = (pt: { x: number; y: number }) => ({
    px: cx + (pt.x / 100) * radius,
    py: cy + (pt.y / 100) * radius,
  });

  // Outer stadium dark backdrop
  targetCtx.fillStyle = '#071211';
  targetCtx.fillRect(box.x, box.y, box.width, box.height);

  // Turf radial gradient
  const turfGrad = targetCtx.createRadialGradient(cx, cy, radius * 0.08, cx, cy, radius * 1.05);
  turfGrad.addColorStop(0, '#1D5E3A');
  turfGrad.addColorStop(0.65, '#14492C');
  turfGrad.addColorStop(1, '#0C2F1C');
  targetCtx.fillStyle = turfGrad;
  targetCtx.beginPath();
  targetCtx.arc(cx, cy, radius * 1.03, 0, Math.PI * 2);
  targetCtx.fill();

  // Concentric mowing rings
  targetCtx.strokeStyle = 'rgba(255,255,255,0.045)';
  targetCtx.lineWidth = Math.max(1, box.width * 0.004);
  for (const rMul of [0.35, 0.55, 0.78]) {
    targetCtx.beginPath();
    targetCtx.arc(cx, cy, radius * rMul, 0, Math.PI * 2);
    targetCtx.stroke();
  }

  // Optional grid
  if (fieldDesign.showGrid) {
    targetCtx.strokeStyle = 'rgba(255,255,255,0.08)';
    targetCtx.lineWidth = 1;
    for (let g = -75; g <= 75; g += 25) {
      const p1 = toPx({ x: g, y: -100 });
      const p2 = toPx({ x: g, y: 100 });
      targetCtx.beginPath();
      targetCtx.moveTo(p1.px, p1.py);
      targetCtx.lineTo(p2.px, p2.py);
      targetCtx.stroke();

      const h1 = toPx({ x: -100, y: g });
      const h2 = toPx({ x: 100, y: g });
      targetCtx.beginPath();
      targetCtx.moveTo(h1.px, h1.py);
      targetCtx.lineTo(h2.px, h2.py);
      targetCtx.stroke();
    }
  }

  // Boundary rope
  targetCtx.strokeStyle = 'rgba(248, 250, 252, 0.88)';
  targetCtx.lineWidth = Math.max(2, box.width * 0.006);
  targetCtx.beginPath();
  targetCtx.arc(cx, cy, radius * 0.96, 0, Math.PI * 2);
  targetCtx.stroke();

  // 30-yard inner circle
  if (fieldDesign.show30YardCircle) {
    targetCtx.save();
    targetCtx.strokeStyle = 'rgba(255,255,255,0.52)';
    targetCtx.setLineDash([Math.max(4, box.width * 0.015), Math.max(3, box.width * 0.012)]);
    targetCtx.lineWidth = Math.max(1.2, box.width * 0.003);
    targetCtx.beginPath();
    targetCtx.ellipse(cx, cy, radius * 0.44, radius * 0.54, 0, 0, Math.PI * 2);
    targetCtx.stroke();
    targetCtx.restore();
  }

  // Central pitch strip
  const pitchTopLeft = toPx({ x: -6.5, y: -22 });
  const pitchBotRight = toPx({ x: 6.5, y: 22 });
  const pitchW = pitchBotRight.px - pitchTopLeft.px;
  const pitchH = pitchBotRight.py - pitchTopLeft.py;

  targetCtx.fillStyle = '#C9AF82';
  drawRoundedRectPath(targetCtx, pitchTopLeft.px, pitchTopLeft.py, pitchW, pitchH, 3);
  targetCtx.fill();
  targetCtx.strokeStyle = 'rgba(255,255,255,0.45)';
  targetCtx.lineWidth = 1;
  targetCtx.strokeRect(pitchTopLeft.px, pitchTopLeft.py, pitchW, pitchH);

  // Crease lines
  targetCtx.strokeStyle = 'rgba(255,255,255,0.88)';
  targetCtx.lineWidth = Math.max(1.2, box.width * 0.0025);
  for (const cyPos of [-18, -14.5, 14.5, 18]) {
    const left = toPx({ x: -7.5, y: cyPos });
    const right = toPx({ x: 7.5, y: cyPos });
    targetCtx.beginPath();
    targetCtx.moveTo(left.px, left.py);
    targetCtx.lineTo(right.px, right.py);
    targetCtx.stroke();
  }

  // Stumps
  for (const stumpY of [-18, 18]) {
    for (const sx of [-1.4, 0, 1.4]) {
      const sp = toPx({ x: sx, y: stumpY });
      targetCtx.fillStyle = '#F8FAFC';
      targetCtx.beginPath();
      targetCtx.arc(sp.px, sp.py, Math.max(1.5, box.width * 0.004), 0, Math.PI * 2);
      targetCtx.fill();
    }
  }

  // Batter stance badge
  const batSideX = fieldDesign.batterHand === 'right' ? -4.2 : 4.2;
  const batPos = toPx({ x: batSideX, y: 16.5 });
  targetCtx.fillStyle = '#38BDF8';
  targetCtx.beginPath();
  targetCtx.arc(batPos.px, batPos.py, Math.max(4, box.width * 0.011), 0, Math.PI * 2);
  targetCtx.fill();
  targetCtx.fillStyle = '#080E1A';
  targetCtx.font = `700 ${Math.max(8, Math.round(box.width * 0.017))}px sans-serif`;
  targetCtx.textAlign = 'center';
  targetCtx.textBaseline = 'middle';
  targetCtx.fillText(fieldDesign.batterHand === 'right' ? 'R' : 'L', batPos.px, batPos.py);

  // Zone labels
  if (fieldDesign.showZoneLabels && options.showLabels) {
    const isRight = fieldDesign.batterHand === 'right';
    const fontPx = Math.max(10, Math.round(box.width * 0.022));
    targetCtx.font = `700 ${fontPx}px sans-serif`;
    targetCtx.fillStyle = 'rgba(241, 245, 249, 0.45)';
    targetCtx.textAlign = 'center';
    targetCtx.textBaseline = 'middle';
    const offPos = toPx({ x: isRight ? -66 : 66, y: 0 });
    const legPos = toPx({ x: isRight ? 66 : -66, y: 0 });
    targetCtx.fillText('OFF SIDE', offPos.px, offPos.py);
    targetCtx.fillText('LEG SIDE', legPos.px, legPos.py);
  }
}

export function drawCricketFieldCanvas(
  ctx: AnyCanvasContext2D,
  fieldDesign: FieldDesign,
  ballEval: BallEvaluation,
  box: SafeLayoutBox,
  options: FieldRenderOptions = {
    showLabels: true,
    showTrajectoryTrail: true,
    showBounceMarker: true,
    showSpeedGraphic: true,
  },
  accentColor = '#D4AF37',
  isPortraitCrop = false
) {
  ctx.save();
  drawRoundedRectPath(ctx, box.x, box.y, box.width, box.height, 14);
  ctx.clip();

  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  // In portrait shorts mode, keep boundary rope cleanly framed inside square box
  const scaleFactor = isPortraitCrop ? 1.02 : 1;
  const radius = (Math.min(box.width, box.height) * 0.445) * scaleFactor;
  const toPx = (pt: { x: number; y: number }) => ({
    px: cx + (pt.x / 100) * radius,
    py: cy + (pt.y / 100) * radius,
  });

  if (typeof OffscreenCanvas !== 'undefined' && box.width > 0 && box.height > 0) {
    const wInt = Math.max(1, Math.round(box.width));
    const hInt = Math.max(1, Math.round(box.height));
    const cacheKey = `${wInt}x${hInt}|${fieldDesign.activePresetName}|${fieldDesign.batterHand}|${fieldDesign.showGrid}|${fieldDesign.show30YardCircle}|${fieldDesign.showZoneLabels}|${options.showLabels}|${isPortraitCrop}`;
    let cachedGround = staticFieldLayerCache.get(cacheKey);
    if (!cachedGround) {
      cachedGround = new OffscreenCanvas(wInt, hInt);
      const offCtx = cachedGround.getContext('2d', { alpha: false });
      if (offCtx) {
        drawStaticCricketGroundBase(
          offCtx,
          fieldDesign,
          { x: 0, y: 0, width: wInt, height: hInt },
          options,
          isPortraitCrop
        );
        putBoundedCanvasCache(staticFieldLayerCache, cacheKey, cachedGround, MAX_STATIC_CANVAS_CACHE);
      }
    }
    ctx.drawImage(cachedGround, box.x, box.y, box.width, box.height);
  } else {
    drawStaticCricketGroundBase(ctx, fieldDesign, box, options, isPortraitCrop);
  }

  // Ball Trajectory Trail
  const bp = fieldDesign.ballPath;
  if (bp.showTrail && options.showTrajectoryTrail) {
    const pRel = toPx(bp.release);
    const pBnc = toPx(bp.bounce);
    const pImp = toPx(bp.impact);
    const pEnd = toPx(bp.end);

    ctx.save();
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
    ctx.lineWidth = Math.max(2, box.width * 0.005);
    ctx.setLineDash([Math.max(5, box.width * 0.012), Math.max(3, box.width * 0.008)]);
    ctx.beginPath();
    ctx.moveTo(pRel.px, pRel.py);
    ctx.lineTo(pBnc.px, pBnc.py);
    ctx.lineTo(pImp.px, pImp.py);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = Math.max(2.5, box.width * 0.006);
    ctx.beginPath();
    ctx.moveTo(pImp.px, pImp.py);
    ctx.lineTo(pEnd.px, pEnd.py);
    ctx.stroke();
    ctx.restore();
  }

  // Bounce Marker
  if (bp.showBounceMarker && options.showBounceMarker) {
    const bnc = toPx(bp.bounce);
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = Math.max(1.5, box.width * 0.0035);
    ctx.beginPath();
    ctx.arc(bnc.px, bnc.py, Math.max(6, box.width * 0.016), 0, Math.PI * 2);
    ctx.stroke();
  }

  // Fielders
  const labelFont = Math.max(9, Math.round(box.width * 0.019));
  const fielderR = Math.max(8, box.width * 0.022);
  for (const f of fieldDesign.fielders) {
    const fp = toPx(f);
    if (f.highlighted) {
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = Math.max(2, box.width * 0.004);
      ctx.beginPath();
      ctx.arc(fp.px, fp.py, fielderR * 1.4, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle =
      f.role === 'bowler'
        ? '#EF4444'
        : f.role === 'wicketkeeper'
        ? '#38BDF8'
        : f.highlighted
        ? accentColor
        : '#0F172A';
    ctx.beginPath();
    ctx.arc(fp.px, fp.py, fielderR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = Math.max(1.2, box.width * 0.003);
    ctx.stroke();

    ctx.fillStyle = f.highlighted ? '#080E1A' : '#F8FAFC';
    ctx.font = `700 ${Math.max(8, Math.round(fielderR * 0.72))}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(f.shortLabel, fp.px, fp.py);

    if (options.showLabels) {
      ctx.fillStyle = 'rgba(241, 245, 249, 0.85)';
      ctx.font = `600 ${labelFont}px sans-serif`;
      ctx.fillText(f.name, fp.px, fp.py + fielderR + labelFont * 0.75);
    }
  }

  // Moving Cricket Ball
  const bPos = toPx(ballEval.position);
  ctx.fillStyle = 'rgba(220, 38, 38, 0.32)';
  ctx.beginPath();
  ctx.arc(bPos.px, bPos.py, Math.max(8, box.width * 0.02), 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#DC2626';
  ctx.beginPath();
  ctx.arc(bPos.px, bPos.py, Math.max(5, box.width * 0.011), 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#FCA5A5';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Optional Speed Graphic Overlay
  if (options.showSpeedGraphic) {
    const pillW = Math.round(box.width * 0.22);
    const pillH = Math.round(box.height * 0.068);
    const px = box.x + 12;
    const py = box.y + box.height - pillH - 12;
    ctx.fillStyle = 'rgba(8, 14, 26, 0.88)';
    drawRoundedRectPath(ctx, px, py, pillW, pillH, 6);
    ctx.fill();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = accentColor;
    ctx.font = `700 ${Math.max(10, Math.round(pillH * 0.45))}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${bp.speedKmh} KM/H`, px + pillW / 2, py + pillH / 2);
  }

  // Outer border
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
  ctx.lineWidth = 2;
  drawRoundedRectPath(ctx, box.x, box.y, box.width, box.height, 14);
  ctx.stroke();

  ctx.restore();
}

export function drawBrandBumperCanvas(
  ctx: AnyCanvasContext2D,
  stage: 'intro' | 'cta' | 'outro',
  brand: BrandKit,
  title: string,
  subtitle: string,
  episodeNumber: string,
  layout: AdaptedFrameLayout,
  logoBitmap?: ImageBitmap | null
) {
  const { width, height, safeBox, isPortrait } = layout;
  ctx.save();
  ctx.fillStyle = brand.primaryColor || '#0C1426';
  ctx.fillRect(0, 0, width, height);

  // Subtle radial spotlight
  const grad = ctx.createRadialGradient(
    width / 2,
    height * 0.44,
    width * 0.04,
    width / 2,
    height * 0.44,
    Math.max(width, height) * 0.65
  );
  grad.addColorStop(0, `${brand.secondaryColor}88`);
  grad.addColorStop(1, `${brand.backgroundColor}EE`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  const badgeSize = Math.round(Math.min(width, height) * 0.11);
  const centerX = width / 2;
  const centerY = height * 0.44;

  // Logo or monogram badge
  const badgeX = centerX - badgeSize / 2;
  const badgeY = centerY - badgeSize * 1.45;
  if (logoBitmap) {
    drawRoundedRectPath(ctx, badgeX, badgeY, badgeSize, badgeSize, 16);
    ctx.save();
    ctx.clip();
    ctx.drawImage(logoBitmap, badgeX, badgeY, badgeSize, badgeSize);
    ctx.restore();
  } else {
    ctx.fillStyle = brand.accentColor;
    drawRoundedRectPath(ctx, badgeX, badgeY, badgeSize, badgeSize, 16);
    ctx.fill();
    ctx.fillStyle = brand.backgroundColor;
    ctx.font = `800 ${Math.round(badgeSize * 0.4)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(brand.logoTextFallback || 'CC', centerX, badgeY + badgeSize / 2);
  }

  // Kicker line
  const kicker =
    stage === 'intro'
      ? `${brand.channelName} · EPISODE ${episodeNumber}`.toUpperCase()
      : stage === 'cta'
      ? 'FINAL SCORE & CHALLENGE'
      : 'THANKS FOR WATCHING';
  ctx.fillStyle = brand.accentColor;
  ctx.font = `700 ${Math.round(Math.min(width, height) * 0.023)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(kicker, centerX, centerY - badgeSize * 0.15);

  // Main headline
  const mainHeadline =
    stage === 'intro'
      ? title
      : stage === 'cta'
      ? brand.ctaText
      : `${brand.channelName} · ${brand.youtubeHandle}`;
  const headlineSize = Math.round(
    Math.min(width, height) * (isPortrait ? 0.048 : 0.046)
  );
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `800 ${headlineSize}px sans-serif`;
  const lines = wrapCanvasLines(ctx, mainHeadline, safeBox.width * 0.84, 3);
  const lineHeight = Math.round(headlineSize * 1.24);
  lines.forEach((line, idx) => {
    ctx.fillText(line, centerX, centerY + badgeSize * 0.42 + idx * lineHeight);
  });

  // Subtitle
  const subSize = Math.round(Math.min(width, height) * 0.022);
  ctx.fillStyle = '#CBD5E1';
  ctx.font = `500 ${subSize}px sans-serif`;
  const subLines = wrapCanvasLines(ctx, subtitle, safeBox.width * 0.78, 2);
  const subStartY = centerY + badgeSize * 0.48 + lines.length * lineHeight + 12;
  subLines.forEach((line, idx) => {
    ctx.fillText(line, centerX, subStartY + idx * Math.round(subSize * 1.35));
  });

  ctx.restore();
}

export function drawQuizStageCanvas(
  ctx: AnyCanvasContext2D,
  scene: RenderSceneState,
  brand: BrandKit,
  seriesName: string,
  layout: AdaptedFrameLayout,
  fieldOptions: FieldRenderOptions
) {
  const qs = scene.quizState;
  if (!qs) return;
  const { width, height, quizBox, isPortrait } = layout;

  ctx.save();

  // Optional dimmed field backdrop (cached across static quiz frames)
  if (qs.question.includeFieldOverlay) {
    if (typeof OffscreenCanvas !== 'undefined') {
      const fielderSig = scene.activeFieldDesign.fielders
        .map((f) => `${Math.round(f.x)}:${Math.round(f.y)}:${f.highlighted ? 1 : 0}`)
        .join(',');
      const bgKey = `${width}x${height}|${scene.activeFieldDesign.activePresetName}|${scene.activeFieldDesign.batterHand}|${fielderSig}|${brand.accentColor}`;
      let cachedBackdrop = staticQuizBackdropCache.get(bgKey);
      if (!cachedBackdrop) {
        cachedBackdrop = new OffscreenCanvas(width, height);
        const bgCtx = cachedBackdrop.getContext('2d', { alpha: false });
        if (bgCtx) {
          bgCtx.fillStyle = '#091224';
          bgCtx.fillRect(0, 0, width, height);
          const bgBoxSize = Math.round(Math.min(quizBox.width, quizBox.height) * 0.9);
          const bgBox: SafeLayoutBox = {
            x: Math.round((width - bgBoxSize) / 2),
            y: Math.round((height - bgBoxSize) / 2),
            width: bgBoxSize,
            height: bgBoxSize,
          };
          drawCricketFieldCanvas(
            bgCtx,
            scene.activeFieldDesign,
            scene.ballEval,
            bgBox,
            { ...fieldOptions, showLabels: false, showSpeedGraphic: false },
            brand.accentColor,
            false
          );
          bgCtx.fillStyle = 'rgba(7, 14, 28, 0.8)';
          bgCtx.fillRect(0, 0, width, height);
          putBoundedCanvasCache(staticQuizBackdropCache, bgKey, cachedBackdrop, 2);
        }
      }
      ctx.drawImage(cachedBackdrop, 0, 0);
    } else {
      const bgBoxSize = Math.round(Math.min(quizBox.width, quizBox.height) * 0.9);
      const bgBox: SafeLayoutBox = {
        x: Math.round((width - bgBoxSize) / 2),
        y: Math.round((height - bgBoxSize) / 2),
        width: bgBoxSize,
        height: bgBoxSize,
      };
      drawCricketFieldCanvas(
        ctx,
        scene.activeFieldDesign,
        scene.ballEval,
        bgBox,
        { ...fieldOptions, showLabels: false, showSpeedGraphic: false },
        brand.accentColor,
        false
      );
      ctx.fillStyle = 'rgba(7, 14, 28, 0.8)';
      ctx.fillRect(0, 0, width, height);
    }
  } else {
    ctx.fillStyle = '#091224';
    ctx.fillRect(0, 0, width, height);
  }

  const baseUnit = Math.min(width, height);
  const metaFont = Math.max(14, Math.round(baseUnit * 0.022));
  const headerY = quizBox.y + Math.round(baseUnit * 0.02);

  // Header metadata (clamped cleanly clear of right-side countdown / reveal badge)
  const isReveal = qs.phase === 'reveal' || qs.phase === 'explanation';
  const rightBadgeText = isReveal ? 'ANSWER REVEALED' : `${qs.remainingSec}s`;
  ctx.font = `800 ${Math.round(metaFont * 1.35)}px monospace`;
  const rightBadgeW = ctx.measureText(rightBadgeText).width;
  const maxLeftHeaderW = Math.max(180, quizBox.width - rightBadgeW - 28);

  ctx.font = `700 ${metaFont}px monospace`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#CBD5E1';
  const leftLabel = `Question ${qs.questionNumber} / ${qs.totalQuestions} · ${qs.question.category}`;
  const diffLabel = qs.question.difficulty ? ` · ${qs.question.difficulty.toUpperCase()}` : '';
  const leftW = ctx.measureText(leftLabel).width;
  const diffW = diffLabel ? ctx.measureText(diffLabel).width : 0;
  if (leftW + diffW <= maxLeftHeaderW) {
    ctx.fillText(leftLabel, quizBox.x, headerY);
    if (qs.question.difficulty) {
      ctx.fillStyle =
        qs.question.difficulty === 'hard'
          ? '#F87171'
          : qs.question.difficulty === 'easy'
          ? '#34D399'
          : brand.accentColor;
      ctx.fillText(diffLabel, quizBox.x + leftW + 2, headerY);
    }
  } else {
    ctx.fillText(leftLabel, quizBox.x, headerY, maxLeftHeaderW);
  }

  // Countdown number / Reveal badge
  ctx.textAlign = 'right';
  ctx.fillStyle = isReveal ? '#34D399' : brand.accentColor;
  ctx.font = `800 ${Math.round(metaFont * 1.35)}px monospace`;
  ctx.fillText(rightBadgeText, quizBox.x + quizBox.width, headerY);

  // Progress bar
  const barY = headerY + Math.round(metaFont * 1.15);
  const barH = Math.max(5, Math.round(baseUnit * 0.008));
  ctx.fillStyle = '#1E293B';
  drawRoundedRectPath(ctx, quizBox.x, barY, quizBox.width, barH, barH / 2);
  ctx.fill();

  const fillRatio = isReveal ? 1 : Math.max(0.02, 1 - qs.countdownProgress);
  ctx.fillStyle = isReveal ? '#34D399' : brand.accentColor;
  drawRoundedRectPath(ctx, quizBox.x, barY, quizBox.width * fillRatio, barH, barH / 2);
  ctx.fill();

  // Question Prompt (step font down slightly if needed so prompt + options + explanation never crowd)
  let promptFont = Math.round(baseUnit * (isPortrait ? 0.035 : 0.032));
  ctx.font = `800 ${promptFont}px sans-serif`;
  let promptLines = wrapCanvasLines(
    ctx,
    qs.question.prompt || `Question ${qs.questionNumber}`,
    quizBox.width,
    4
  );
  if (!isPortrait && promptLines.length > 2 && quizBox.height < height * 0.72) {
    promptFont = Math.max(18, promptFont - 2);
    ctx.font = `800 ${promptFont}px sans-serif`;
    promptLines = wrapCanvasLines(
      ctx,
      qs.question.prompt || `Question ${qs.questionNumber}`,
      quizBox.width,
      3
    );
  }

  ctx.fillStyle = '#F8FAFC';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const promptStartY = barY + barH + Math.round(height * 0.026);
  const promptLH = Math.round(promptFont * 1.25);
  promptLines.forEach((line, idx) => {
    ctx.fillText(line, quizBox.x, promptStartY + idx * promptLH);
  });

  // Bottom-up budget calculation inside quizBox so options, explanation, and footer never collide
  const footerFont = Math.max(12, Math.round(baseUnit * 0.018));
  const footerY = quizBox.y + quizBox.height - 2;
  const contentEnd = footerY - footerFont - Math.round(height * 0.012);

  const hasExp = Boolean(isReveal && qs.question.explanation);
  const expFont = Math.max(13, Math.round(baseUnit * 0.0195));
  const expLH = Math.round(expFont * 1.3);
  let expLines: string[] = [];
  let expH = 0;
  let expY = contentEnd;
  const expGap = Math.round(height * 0.016);

  if (hasExp && qs.question.explanation) {
    ctx.font = `500 ${expFont}px sans-serif`;
    expLines = wrapCanvasLines(ctx, qs.question.explanation, quizBox.width - 28, 3);
    expH = Math.max(
      52,
      Math.min(Math.round(height * 0.13), expLines.length * expLH + 22)
    );
    expY = contentEnd - expH;
  }

  const optionsMaxBottom = hasExp ? expY - expGap : contentEnd;

  // Options A / B / C / D
  const letters = ['A', 'B', 'C', 'D'];
  const optionsStartY = promptStartY + promptLines.length * promptLH + Math.round(height * 0.022);
  const cols = isPortrait ? 1 : 2;
  const rows = isPortrait ? 4 : 2;
  const colGap = Math.round(quizBox.width * 0.024);
  const rowGap = Math.round(height * 0.015);
  const cardW = cols === 1 ? quizBox.width : Math.round((quizBox.width - colGap) / 2);
  const availH = Math.max(rows * 52, optionsMaxBottom - optionsStartY);
  const cardH = Math.min(
    Math.round(height * (isPortrait ? 0.088 : 0.125)),
    Math.floor((availH - rowGap * (rows - 1)) / rows)
  );

  const optFont = Math.max(14, Math.round(baseUnit * (isPortrait ? 0.025 : 0.022)));
  const badgeSide = Math.round(cardH * 0.56);

  for (let i = 0; i < 4; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = quizBox.x + col * (cardW + colGap);
    const cy = optionsStartY + row * (cardH + rowGap);
    const isCorrect = qs.question.correctIndex === i;

    ctx.fillStyle =
      isReveal && isCorrect
        ? 'rgba(6, 78, 59, 0.92)'
        : isReveal
        ? 'rgba(14, 24, 45, 0.72)'
        : 'rgba(17, 30, 56, 0.96)';
    drawRoundedRectPath(ctx, cx, cy, cardW, cardH, 10);
    ctx.fill();

    ctx.strokeStyle =
      isReveal && isCorrect
        ? '#34D399'
        : isReveal
        ? 'rgba(51, 65, 85, 0.6)'
        : 'rgba(71, 85, 105, 0.85)';
    ctx.lineWidth = isReveal && isCorrect ? 2.5 : 1.5;
    ctx.stroke();

    // Option Letter Badge
    const bx = cx + 14;
    const by = cy + Math.round((cardH - badgeSide) / 2);
    ctx.fillStyle = isReveal && isCorrect ? '#34D399' : '#080E1A';
    drawRoundedRectPath(ctx, bx, by, badgeSide, badgeSide, 6);
    ctx.fill();

    ctx.fillStyle = isReveal && isCorrect ? '#06120D' : brand.accentColor;
    ctx.font = `800 ${Math.round(badgeSide * 0.52)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letters[i], bx + badgeSide / 2, by + badgeSide / 2);

    // Option Text
    ctx.fillStyle =
      isReveal && !isCorrect ? '#94A3B8' : isReveal && isCorrect ? '#ECFDF5' : '#F1F5F9';
    ctx.font = `600 ${optFont}px sans-serif`;
    ctx.textAlign = 'left';
    const optLines = wrapCanvasLines(
      ctx,
      qs.question.options[i] || `Option ${letters[i]}`,
      cardW - badgeSide - 38,
      2
    );
    const optLH = Math.round(optFont * 1.2);
    const textBlockTop = cy + cardH / 2 - ((optLines.length - 1) * optLH) / 2;
    optLines.forEach((line, lIdx) => {
      ctx.fillText(line, bx + badgeSide + 14, textBlockTop + lIdx * optLH);
    });
  }

  // Explanation box during reveal / explanation phase
  if (hasExp && expLines.length > 0) {
    ctx.fillStyle = 'rgba(14, 27, 52, 0.95)';
    drawRoundedRectPath(ctx, quizBox.x, expY, quizBox.width, expH, 10);
    ctx.fill();
    ctx.strokeStyle = `${brand.accentColor}88`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = `500 ${expFont}px sans-serif`;
    ctx.fillStyle = '#E2E8F0';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const expTextPadY = Math.max(8, Math.round((expH - expLines.length * expLH) / 2));
    expLines.forEach((line, idx) => {
      ctx.fillText(line, quizBox.x + 14, expY + expTextPadY + idx * expLH);
    });
  }

  // Footer
  ctx.fillStyle = '#94A3B8';
  ctx.font = `600 ${footerFont}px monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(seriesName, quizBox.x, footerY);
  ctx.textAlign = 'right';
  ctx.fillText(brand.youtubeHandle, quizBox.x + quizBox.width, footerY);

  ctx.restore();
}

export function drawBroadcastGraphicsCanvas(
  ctx: AnyCanvasContext2D,
  graphics: BroadcastGraphicOverlay[],
  layout: AdaptedFrameLayout
) {
  const { width, height, safeBox, topHudBox, isPortrait } = layout;

  for (const g of graphics) {
    ctx.save();
    const isTopZone = g.position.y < 30;
    const cardW = isTopZone
      ? topHudBox.width
      : Math.round(Math.min(safeBox.width * (isPortrait ? 0.9 : 0.44), width * 0.48));
    const cardH = topHudBox.height;

    // Anchor top graphics inside the reserved topHudBox so they never overlap quiz or field stages
    let gx = Math.round((g.position.x / 100) * width);
    let gy = isTopZone
      ? topHudBox.y
      : Math.round((g.position.y / 100) * height - cardH / 2);

    if (isPortrait && g.position.y > 55) {
      // Shift lower graphics slightly up in 9:16 so YouTube Shorts HUD never covers them
      gy = Math.min(gy, safeBox.y + safeBox.height - cardH - 12);
    }
    gx = Math.max(safeBox.x, Math.min(safeBox.x + safeBox.width - cardW, gx));
    gy = Math.max(safeBox.y, Math.min(safeBox.y + safeBox.height - cardH, gy));

    ctx.fillStyle = 'rgba(10, 19, 36, 0.94)';
    drawRoundedRectPath(ctx, gx, gy, cardW, cardH, 10);
    ctx.fill();

    ctx.strokeStyle = g.accentColor || '#D4AF37';
    ctx.lineWidth = 2;
    ctx.stroke();

    const kFont = Math.max(10, Math.round(cardH * 0.165));
    const tFont = Math.max(13, Math.round(cardH * 0.24));
    const sFont = Math.max(11, Math.round(cardH * 0.18));

    ctx.font = `700 ${kFont}px monospace`;
    ctx.fillStyle = g.accentColor || '#D4AF37';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(
      `${g.teamName} · ${g.type.replace(/-/g, ' ').toUpperCase()}`,
      gx + 14,
      gy + 9,
      Math.round(cardW * 0.54)
    );

    ctx.textAlign = 'right';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 ${Math.round(tFont * 0.92)}px monospace`;
    ctx.fillText(
      g.valueText,
      gx + cardW - 14,
      gy + 8,
      Math.round(cardW * 0.4)
    );

    ctx.textAlign = 'left';
    ctx.fillStyle = '#F8FAFC';
    ctx.font = `700 ${tFont}px sans-serif`;
    ctx.fillText(g.title, gx + 14, gy + 11 + kFont + 3, cardW - 28);

    ctx.fillStyle = '#CBD5E1';
    ctx.font = `500 ${sFont}px sans-serif`;
    ctx.fillText(g.subtitle, gx + 14, gy + 13 + kFont + tFont + 6, cardW - 28);

    ctx.restore();
  }
}

export function drawBrandingAndWatermarkCanvas(
  ctx: AnyCanvasContext2D,
  brand: BrandKit,
  overlay: BrandOverlaySettings,
  layout: AdaptedFrameLayout,
  logoBitmap?: ImageBitmap | null
) {
  ctx.save();

  // Optional corner logo mark (when an image asset is attached)
  if (logoBitmap) {
    const size = Math.round(layout.logoPos.size * (overlay.logoScale || 1));
    drawRoundedRectPath(ctx, layout.logoPos.x, layout.logoPos.y, size, size, 8);
    ctx.save();
    ctx.clip();
    ctx.drawImage(logoBitmap, layout.logoPos.x, layout.logoPos.y, size, size);
    ctx.restore();
  }

  // Brand watermark inside safe area
  if (overlay.showWatermark && brand.watermarkText) {
    ctx.globalAlpha = Math.max(0.1, Math.min(1, overlay.watermarkOpacity ?? 0.75));
    const wmFont = Math.round(
      Math.min(layout.width, layout.height) * 0.02 * (overlay.watermarkScale || 1)
    );
    ctx.fillStyle = brand.accentColor || '#D4AF37';
    ctx.font = `700 ${Math.max(12, wmFont)}px monospace`;
    ctx.textAlign = layout.watermarkPos.align;
    ctx.textBaseline = 'middle';
    ctx.fillText(
      brand.watermarkText,
      layout.watermarkPos.x,
      layout.watermarkPos.y
    );
  }

  ctx.restore();
}

export function drawCaptionsCanvas(
  ctx: AnyCanvasContext2D,
  captionText: string | null,
  settings: CaptionSettings,
  brand: BrandKit,
  layout: AdaptedFrameLayout
) {
  if (!settings.enabled || !captionText) return;
  ctx.save();

  const scaleFactor = Math.min(layout.width, layout.height) / 1080;
  const fontSize = Math.max(
    18,
    Math.round(
      (settings.fontSize || 28) *
        scaleFactor *
        (settings.style === 'bold-shorts' ? 1.25 : settings.style === 'minimal' ? 0.9 : 1)
    )
  );
  ctx.font = `${settings.style === 'bold-shorts' ? 800 : 700} ${fontSize}px sans-serif`;

  const lines = wrapCanvasLines(ctx, captionText, layout.captionMaxWidth - 36, 2);
  const lineH = Math.round(fontSize * 1.28);
  const maxLineW = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const boxW = Math.min(layout.captionMaxWidth, Math.round(maxLineW + 40));
  const boxH = lines.length * lineH + 20;
  const bx = Math.round((layout.width - boxW) / 2);
  const by = Math.round(layout.captionY - boxH / 2);

  if (settings.showBackground) {
    ctx.fillStyle =
      settings.style === 'bold-shorts'
        ? 'rgba(8, 14, 26, 0.92)'
        : 'rgba(8, 14, 26, 0.8)';
    drawRoundedRectPath(ctx, bx, by, boxW, boxH, 10);
    ctx.fill();
    if (settings.style === 'broadcast') {
      ctx.strokeStyle = `${brand.accentColor}88`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, idx) => {
    const ty = by + 12 + idx * lineH + lineH / 2 - 2;
    if (settings.textOutline) {
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.14));
      ctx.strokeText(line, layout.width / 2, ty);
    }
    ctx.fillStyle = settings.style === 'bold-shorts' ? '#FACC15' : '#F8FAFC';
    ctx.fillText(line, layout.width / 2, ty);
  });

  ctx.restore();
}

export function drawTransitionOverlayCanvas(
  ctx: AnyCanvasContext2D,
  transition: ActiveTransitionState | null,
  width: number,
  height: number,
  accentColor: string,
  backgroundColor: string
) {
  if (!transition || transition.type === 'cut') return;
  const p = Math.max(0, Math.min(1, transition.progress));
  const inv = 1 - p;
  if (inv <= 0.01) return;

  ctx.save();
  const type: TransitionType = transition.type;

  if (type === 'fade' || type === 'crossfade') {
    ctx.fillStyle = backgroundColor || '#080E1A';
    ctx.globalAlpha = inv * 0.88;
    ctx.fillRect(0, 0, width, height);
  } else if (type === 'slide-left') {
    const coverW = Math.round(width * inv);
    ctx.fillStyle = '#080E1A';
    ctx.fillRect(0, 0, coverW, height);
    ctx.fillStyle = accentColor;
    ctx.fillRect(Math.max(0, coverW - 8), 0, 8, height);
  } else if (type === 'slide-right') {
    const coverW = Math.round(width * inv);
    const startX = width - coverW;
    ctx.fillStyle = '#080E1A';
    ctx.fillRect(startX, 0, coverW, height);
    ctx.fillStyle = accentColor;
    ctx.fillRect(startX, 0, 8, height);
  } else if (type === 'zoom') {
    ctx.strokeStyle = accentColor;
    ctx.globalAlpha = inv * 0.7;
    ctx.lineWidth = Math.round(Math.min(width, height) * 0.06 * inv);
    ctx.strokeRect(
      width * 0.02 * inv,
      height * 0.02 * inv,
      width * (1 - 0.04 * inv),
      height * (1 - 0.04 * inv)
    );
  } else if (type === 'broadcast-wipe') {
    const wipeX = Math.round(width * p);
    const bandW = Math.max(24, Math.round(width * 0.08));
    ctx.fillStyle = accentColor;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(wipeX - bandW, 0);
    ctx.lineTo(wipeX, 0);
    ctx.lineTo(wipeX - bandW * 0.4, height);
    ctx.lineTo(wipeX - bandW * 1.4, height);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}
