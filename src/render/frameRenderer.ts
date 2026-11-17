import type { CricketProject } from '../types/studio';
import { evaluateSequenceAtTime, RenderSceneState } from '../engine/timeline';
import type { RenderSettings } from './rendererTypes';
import {
  AnyCanvasContext2D,
  adaptLayoutForAspectRatio,
  drawBrandBumperCanvas,
  drawBrandingAndWatermarkCanvas,
  drawBroadcastGraphicsCanvas,
  drawCaptionsCanvas,
  drawCricketFieldCanvas,
  drawQuizStageCanvas,
  drawRoundedRectPath,
  drawTransitionOverlayCanvas,
  wrapCanvasLines,
} from './canvasRenderer';

export interface DecodedVisualAssets {
  logoBitmap?: ImageBitmap | null;
}

/**
 * Deterministic 12-layer frame compositor driven exclusively by evaluateSequenceAtTime().
 * Used identically across main-thread Canvas previews and OffscreenCanvas Web Worker video renders.
 */
export function renderFrame(
  project: CricketProject,
  timeSec: number,
  ctx: AnyCanvasContext2D,
  settings: Pick<RenderSettings, 'width' | 'height' | 'aspectRatio'>,
  assets: DecodedVisualAssets = {},
  preEvaluatedState?: RenderSceneState
): RenderSceneState {
  const state =
    preEvaluatedState ?? evaluateSequenceAtTime(project, 'timeline', timeSec);
  const { width, height, aspectRatio } = settings;
  const brand = project.brandKit;
  const captionSettings = project.captionSettings ?? {
    enabled: true,
    style: 'broadcast',
    fontSize: 28,
    showBackground: true,
    textOutline: true,
  };

  const hasTopGraphic = state.activeGraphics.some((g) => g.position.y < 30);
  const hasBottomGraphic = state.activeGraphics.some((g) => g.position.y > 70);
  const hasCaption = Boolean(captionSettings.enabled && state.activeCaption);
  const layout = adaptLayoutForAspectRatio(width, height, aspectRatio, {
    hasTopGraphic,
    hasBottomGraphic,
    hasCaption,
  });

  const fieldOptions = project.fieldRenderOptions ?? {
    showLabels: true,
    showTrajectoryTrail: true,
    showBounceMarker: true,
    showSpeedGraphic: true,
  };
  const brandOverlay = project.brandOverlay ?? {
    logoScale: 1,
    watermarkOpacity: 0.75,
    watermarkScale: 1,
    showWatermark: true,
    showChannelHandle: true,
  };

  // Layer 1: Background canvas
  ctx.save();
  ctx.fillStyle = brand.backgroundColor || '#080E1A';
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // Layers 2–7: Active Stage (Intro/CTA/Outro OR Field + Ball + Fielders OR Quiz + Countdown + Reveal)
  if (
    state.activeStage === 'intro' ||
    state.activeStage === 'cta' ||
    state.activeStage === 'outro'
  ) {
    drawBrandBumperCanvas(
      ctx,
      state.activeStage,
      brand,
      project.title,
      project.subtitle,
      project.production.episodeNumber || '01',
      layout,
      assets.logoBitmap
    );
  } else if (state.activeStage === 'field') {
    // Layers 2, 3, 4: Cricket field / ball trajectory / player & field markers
    drawCricketFieldCanvas(
      ctx,
      state.activeFieldDesign,
      state.ballEval,
      layout.fieldBox,
      fieldOptions,
      brand.accentColor,
      layout.isPortrait
    );

    // Side/bottom tactical info card
    const info = layout.fieldInfoBox;
    ctx.save();
    ctx.fillStyle = 'rgba(15, 27, 51, 0.92)';
    drawRoundedRectPath(ctx, info.x, info.y, info.width, info.height, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const baseUnit = Math.min(width, height);
    const pad = Math.round(baseUnit * 0.028);
    const kFont = Math.max(12, Math.round(baseUnit * 0.02));
    const hFont = Math.max(16, Math.round(baseUnit * (layout.isPortrait ? 0.028 : 0.03)));
    const bFont = Math.max(13, Math.round(baseUnit * 0.021));

    ctx.fillStyle = brand.accentColor;
    ctx.font = `700 ${kFont}px monospace`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(project.settings.seriesName.toUpperCase(), info.x + pad, info.y + pad);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = `800 ${hFont}px sans-serif`;
    const titleLines = wrapCanvasLines(ctx, project.title, info.width - pad * 2, 2);
    titleLines.forEach((line, idx) => {
      ctx.fillText(line, info.x + pad, info.y + pad + kFont + 10 + idx * Math.round(hFont * 1.2));
    });

    const statsY =
      info.y + pad + kFont + 18 + titleLines.length * Math.round(hFont * 1.2);
    ctx.fillStyle = '#CBD5E1';
    ctx.font = `500 ${bFont}px sans-serif`;
    ctx.fillText(state.activeFieldDesign.activePresetName, info.x + pad, statsY);

    // Delivery / Speed / Shot grid
    const bp = state.activeFieldDesign.ballPath;
    const gridY = statsY + bFont + Math.round(baseUnit * 0.028);
    const items = [
      { label: 'DELIVERY', value: bp.deliveryType },
      { label: 'SPEED', value: `${bp.speedKmh} km/h` },
      { label: 'SHOT', value: bp.shotType },
      { label: 'PHASE', value: state.ballEval.phase.toUpperCase() },
    ];
    const cellW = Math.round((info.width - pad * 3) / 2);
    const cellH = Math.round(bFont * 2.7);
    items.forEach((it, idx) => {
      const cx = info.x + pad + (idx % 2) * (cellW + pad);
      const cy = gridY + Math.floor(idx / 2) * (cellH + 10);
      if (cy + cellH > info.y + info.height - 16) return;
      ctx.fillStyle = 'rgba(8, 14, 26, 0.72)';
      drawRoundedRectPath(ctx, cx, cy, cellW, cellH, 8);
      ctx.fill();
      ctx.fillStyle = '#94A3B8';
      ctx.font = `700 ${Math.max(10, Math.round(bFont * 0.75))}px monospace`;
      ctx.fillText(it.label, cx + 10, cy + 8);
      ctx.fillStyle = idx === 1 ? brand.accentColor : '#F8FAFC';
      ctx.font = `700 ${bFont}px sans-serif`;
      ctx.fillText(it.value, cx + 10, cy + 12 + Math.round(bFont * 0.8), cellW - 20);
    });

    ctx.restore();
  } else if (state.activeStage === 'quiz') {
    // Layers 5, 6, 7: Quiz cards, countdown, answer reveal & explanation
    drawQuizStageCanvas(
      ctx,
      state,
      brand,
      project.settings.seriesName,
      layout,
      fieldOptions
    );
  }

  // Layer 8: Broadcast graphics
  drawBroadcastGraphicsCanvas(ctx, state.activeGraphics, layout);

  // Layers 9 & 10: Branding & watermark
  drawBrandingAndWatermarkCanvas(ctx, brand, brandOverlay, layout, assets.logoBitmap);

  // Layer 11: Captions / subtitles
  drawCaptionsCanvas(ctx, state.activeCaption, captionSettings, brand, layout);

  // Layer 12: Transition overlays
  drawTransitionOverlayCanvas(
    ctx,
    state.activeTransition,
    width,
    height,
    brand.accentColor,
    brand.backgroundColor
  );

  return state;
}
