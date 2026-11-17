import React, { useRef, useState } from 'react';
import type { FieldDesign, FieldPoint } from '../types/studio';
import {
  BOUNDARY_RADIUS_UNITS,
  BallEvaluation,
  INNER_RING_RADIUS_UNITS,
  SVG_CENTER,
  SVG_FIELD_SIZE,
  evaluateBallPathAtProgress,
  fieldToSvg,
  svgToField,
} from '../engine/cricketField';

export type BallHandleKey = 'release' | 'bounce' | 'impact' | 'end';

interface CricketFieldSvgProps {
  fieldDesign: FieldDesign;
  interactive?: boolean;
  selectedFielderId?: string | null;
  onSelectFielder?: (fielderId: string | null) => void;
  onMoveFielder?: (fielderId: string, point: FieldPoint) => void;
  onMoveBallHandle?: (handle: BallHandleKey, point: FieldPoint) => void;
  ballProgress?: number; // 0..1 when animating, undefined to show full path
  ballEvaluation?: BallEvaluation;
  className?: string;
}

export function CricketFieldSvg({
  fieldDesign,
  interactive = false,
  selectedFielderId = null,
  onSelectFielder,
  onMoveFielder,
  onMoveBallHandle,
  ballProgress,
  ballEvaluation,
  className = '',
}: CricketFieldSvgProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragTarget, setDragTarget] = useState<
    | { kind: 'fielder'; id: string }
    | { kind: 'ball'; handle: BallHandleKey }
    | null
  >(null);

  const scale = SVG_FIELD_SIZE / 200;
  const boundaryPx = BOUNDARY_RADIUS_UNITS * scale;
  const innerRingPx = INNER_RING_RADIUS_UNITS * scale;

  const clientToFieldPoint = (clientX: number, clientY: number): FieldPoint => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const svgX = ((clientX - rect.left) / rect.width) * SVG_FIELD_SIZE;
    const svgY = ((clientY - rect.top) / rect.height) * SVG_FIELD_SIZE;
    return svgToField(svgX, svgY);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!interactive || !dragTarget) return;
    const pt = clientToFieldPoint(e.clientX, e.clientY);
    if (dragTarget.kind === 'fielder') {
      onMoveFielder?.(dragTarget.id, pt);
    } else {
      onMoveBallHandle?.(dragTarget.handle, pt);
    }
  };

  const handlePointerUp = () => {
    setDragTarget(null);
  };

  const evalState =
    ballEvaluation ??
    evaluateBallPathAtProgress(fieldDesign.ballPath, ballProgress ?? 1);

  const releaseSvg = fieldToSvg(fieldDesign.ballPath.release);
  const bounceSvg = fieldToSvg(fieldDesign.ballPath.bounce);
  const impactSvg = fieldToSvg(fieldDesign.ballPath.impact);
  const endSvg = fieldToSvg(fieldDesign.ballPath.end);
  const ballSvg = fieldToSvg(evalState.position);

  const offSideLabelX = fieldDesign.batterHand === 'right' ? 148 : 652;
  const legSideLabelX = fieldDesign.batterHand === 'right' ? 652 : 148;

  // 30-yard oval path around the two sets of stumps (stumps at y = -15 and y = +15)
  const topStumpY = SVG_CENTER - 15 * scale;
  const bottomStumpY = SVG_CENTER + 15 * scale;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${SVG_FIELD_SIZE} ${SVG_FIELD_SIZE}`}
      className={`select-none touch-none ${className}`}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      data-testid="cricket-field-svg"
      role="img"
      aria-label="Top-down cricket pitch and fielding layout"
    >
      <defs>
        <radialGradient id="ccsTurfBase" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#1D5A37" />
          <stop offset="65%" stopColor="#16492B" />
          <stop offset="100%" stopColor="#0E341E" />
        </radialGradient>
        <linearGradient id="ccsPitchClay" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#B89468" />
          <stop offset="50%" stopColor="#CAA97E" />
          <stop offset="100%" stopColor="#B69062" />
        </linearGradient>
        <clipPath id="ccsOutfieldClip">
          <circle cx={SVG_CENTER} cy={SVG_CENTER} r={boundaryPx} />
        </clipPath>
      </defs>

      {/* Stadium Dark Apron */}
      <rect
        x={0}
        y={0}
        width={SVG_FIELD_SIZE}
        height={SVG_FIELD_SIZE}
        fill="#081312"
      />

      {/* Outer Field Turf */}
      <circle
        cx={SVG_CENTER}
        cy={SVG_CENTER}
        r={boundaryPx + 14}
        fill="#0D281A"
      />
      <circle
        cx={SVG_CENTER}
        cy={SVG_CENTER}
        r={boundaryPx}
        fill="url(#ccsTurfBase)"
      />

      {/* Concentric Mow Rings inside Boundary */}
      <g clipPath="url(#ccsOutfieldClip)" opacity="0.28">
        {[310, 230, 150, 75].map((r, idx) => (
          <circle
            key={r}
            cx={SVG_CENTER}
            cy={SVG_CENTER}
            r={r}
            fill="none"
            stroke={idx % 2 === 0 ? '#2C7A4C' : '#0E311D'}
            strokeWidth={36}
          />
        ))}
        {/* Vertical Pitch Mower Stripes */}
        {[-3, -1, 1, 3].map((stripe) => (
          <rect
            key={stripe}
            x={SVG_CENTER + stripe * 44 - 22}
            y={0}
            width={44}
            height={SVG_FIELD_SIZE}
            fill="#23693F"
            opacity="0.16"
          />
        ))}
      </g>

      {/* Optional Tactical Coordinate Grid */}
      {fieldDesign.showGrid && (
        <g clipPath="url(#ccsOutfieldClip)" opacity="0.25">
          {[-75, -50, -25, 0, 25, 50, 75].map((unit) => {
            const pos = SVG_CENTER + unit * scale;
            return (
              <React.Fragment key={unit}>
                <line
                  x1={0}
                  y1={pos}
                  x2={SVG_FIELD_SIZE}
                  y2={pos}
                  stroke="#94A3B8"
                  strokeWidth={unit === 0 ? 1.2 : 0.7}
                  strokeDasharray={unit === 0 ? undefined : '4 4'}
                />
                <line
                  x1={pos}
                  y1={0}
                  x2={pos}
                  y2={SVG_FIELD_SIZE}
                  stroke="#94A3B8"
                  strokeWidth={unit === 0 ? 1.2 : 0.7}
                  strokeDasharray={unit === 0 ? undefined : '4 4'}
                />
              </React.Fragment>
            );
          })}
        </g>
      )}

      {/* Boundary Rope */}
      <circle
        cx={SVG_CENTER}
        cy={SVG_CENTER}
        r={boundaryPx}
        fill="none"
        stroke="#E2E8F0"
        strokeWidth={3.5}
        opacity="0.88"
      />
      <circle
        cx={SVG_CENTER}
        cy={SVG_CENTER}
        r={boundaryPx + 3.5}
        fill="none"
        stroke="#D4AF37"
        strokeWidth={1}
        strokeDasharray="10 8"
        opacity="0.65"
      />

      {/* 30-Yard Inner Fielding Circle (two semicircles joined by parallel lines) */}
      {fieldDesign.show30YardCircle && (
        <path
          d={`
            M ${SVG_CENTER - innerRingPx} ${topStumpY}
            A ${innerRingPx} ${innerRingPx} 0 0 1 ${SVG_CENTER + innerRingPx} ${topStumpY}
            L ${SVG_CENTER + innerRingPx} ${bottomStumpY}
            A ${innerRingPx} ${innerRingPx} 0 0 1 ${SVG_CENTER - innerRingPx} ${bottomStumpY}
            Z
          `}
          fill="rgba(255,255,255,0.03)"
          stroke="#F8FAFC"
          strokeWidth={1.6}
          strokeDasharray="7 5"
          opacity="0.7"
        />
      )}

      {/* 22-Yard Pitch Strip */}
      <g>
        <rect
          x={SVG_CENTER - 22}
          y={SVG_CENTER - 76}
          width={44}
          height={152}
          rx={3}
          fill="url(#ccsPitchClay)"
          stroke="#9B7A50"
          strokeWidth={1.2}
        />

        {/* Good-length wear area */}
        <ellipse
          cx={SVG_CENTER}
          cy={SVG_CENTER + 12}
          rx={11}
          ry={18}
          fill="#9E794E"
          opacity="0.32"
        />

        {/* Bowler's End (Top) Creases */}
        <line
          x1={SVG_CENTER - 20}
          y1={topStumpY}
          x2={SVG_CENTER + 20}
          y2={topStumpY}
          stroke="#F8FAFC"
          strokeWidth={1.2}
        />
        <line
          x1={SVG_CENTER - 28}
          y1={topStumpY + 12}
          x2={SVG_CENTER + 28}
          y2={topStumpY + 12}
          stroke="#F8FAFC"
          strokeWidth={1.2}
        />
        <line
          x1={SVG_CENTER - 16}
          y1={topStumpY - 8}
          x2={SVG_CENTER - 16}
          y2={topStumpY + 12}
          stroke="#F8FAFC"
          strokeWidth={1.1}
        />
        <line
          x1={SVG_CENTER + 16}
          y1={topStumpY - 8}
          x2={SVG_CENTER + 16}
          y2={topStumpY + 12}
          stroke="#F8FAFC"
          strokeWidth={1.1}
        />

        {/* Batter's End (Bottom) Creases */}
        <line
          x1={SVG_CENTER - 20}
          y1={bottomStumpY}
          x2={SVG_CENTER + 20}
          y2={bottomStumpY}
          stroke="#F8FAFC"
          strokeWidth={1.2}
        />
        <line
          x1={SVG_CENTER - 28}
          y1={bottomStumpY - 12}
          x2={SVG_CENTER + 28}
          y2={bottomStumpY - 12}
          stroke="#F8FAFC"
          strokeWidth={1.2}
        />
        <line
          x1={SVG_CENTER - 16}
          y1={bottomStumpY - 12}
          x2={SVG_CENTER - 16}
          y2={bottomStumpY + 8}
          stroke="#F8FAFC"
          strokeWidth={1.1}
        />
        <line
          x1={SVG_CENTER + 16}
          y1={bottomStumpY - 12}
          x2={SVG_CENTER + 16}
          y2={bottomStumpY + 8}
          stroke="#F8FAFC"
          strokeWidth={1.1}
        />

        {/* Stumps (3 dots at both ends) */}
        {[-4, 0, 4].map((dx) => (
          <React.Fragment key={dx}>
            <circle cx={SVG_CENTER + dx} cy={topStumpY} r={1.8} fill="#FACC15" />
            <circle cx={SVG_CENTER + dx} cy={bottomStumpY} r={1.8} fill="#FACC15" />
          </React.Fragment>
        ))}

        {/* Striker Batter Marker */}
        <g
          transform={`translate(${
            SVG_CENTER + (fieldDesign.batterHand === 'right' ? 9 : -9)
          }, ${bottomStumpY - 6})`}
        >
          <circle r={5.5} fill="#0F172A" stroke="#F8FAFC" strokeWidth={1.5} />
          <line
            x1={0}
            y1={0}
            x2={fieldDesign.batterHand === 'right' ? -11 : 11}
            y2={-3}
            stroke="#E5B94C"
            strokeWidth={2.4}
            strokeLinecap="round"
          />
        </g>
      </g>

      {/* Optional Field Zone Labels */}
      {fieldDesign.showZoneLabels && (
        <g
          fill="#CBD5E1"
          fontSize="11"
          fontWeight="600"
          fontFamily="Plus Jakarta Sans, sans-serif"
          textAnchor="middle"
          opacity="0.68"
        >
          <text x={SVG_CENTER} y={56}>
            SIGHTSCREEN / STRAIGHT
          </text>
          <text x={offSideLabelX} y={SVG_CENTER}>
            OFF SIDE
          </text>
          <text x={legSideLabelX} y={SVG_CENTER}>
            LEG SIDE
          </text>
          <text x={SVG_CENTER} y={SVG_FIELD_SIZE - 48}>
            FINE LEG / THIRD MAN
          </text>
        </g>
      )}

      {/* Ball Delivery & Shot Trajectory Guide Lines */}
      <g>
        {/* Full planned guide path */}
        <polyline
          points={`${releaseSvg.cx},${releaseSvg.cy} ${bounceSvg.cx},${bounceSvg.cy} ${impactSvg.cx},${impactSvg.cy}`}
          fill="none"
          stroke="#38BDF8"
          strokeWidth={2}
          strokeDasharray="5 4"
          opacity={fieldDesign.ballPath.showTrail ? 0.65 : 0.2}
        />
        <line
          x1={impactSvg.cx}
          y1={impactSvg.cy}
          x2={endSvg.cx}
          y2={endSvg.cy}
          stroke="#E5B94C"
          strokeWidth={2.5}
          strokeDasharray="6 4"
          opacity={fieldDesign.ballPath.showTrail ? 0.72 : 0.2}
        />

        {/* Animated live trail */}
        {fieldDesign.ballPath.showTrail && evalState.trail.length > 1 && (
          <polyline
            points={evalState.trail
              .map((pt) => {
                const p = fieldToSvg(pt);
                return `${p.cx},${p.cy}`;
              })
              .join(' ')}
            fill="none"
            stroke={evalState.impactReached ? '#F59E0B' : '#38BDF8'}
            strokeWidth={3.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Bounce Marker */}
        {fieldDesign.ballPath.showBounceMarker && (
          <g transform={`translate(${bounceSvg.cx}, ${bounceSvg.cy})`}>
            <circle
              r={evalState.bounceReached ? 8 : 5}
              fill="rgba(56, 189, 248, 0.22)"
              stroke="#38BDF8"
              strokeWidth={1.6}
            />
            <circle r={2.2} fill="#38BDF8" />
          </g>
        )}

        {/* Interactive Ball Path Control Handles (Designer Mode Only) */}
        {interactive && (
          <g>
            {(
              [
                { key: 'release', pt: releaseSvg, label: 'REL', color: '#38BDF8' },
                { key: 'bounce', pt: bounceSvg, label: 'BNC', color: '#0EA5E9' },
                { key: 'impact', pt: impactSvg, label: 'IMP', color: '#F59E0B' },
                { key: 'end', pt: endSvg, label: 'END', color: '#E5B94C' },
              ] as const
            ).map((h) => (
              <g
                key={h.key}
                transform={`translate(${h.pt.cx}, ${h.pt.cy})`}
                className="cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setDragTarget({ kind: 'ball', handle: h.key });
                }}
              >
                <circle
                  r={10}
                  fill="#0B1325"
                  stroke={h.color}
                  strokeWidth={2}
                  opacity={0.92}
                />
                <text
                  y={3}
                  textAnchor="middle"
                  fill="#F8FAFC"
                  fontSize="7"
                  fontWeight="700"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {h.label}
                </text>
              </g>
            ))}
          </g>
        )}

        {/* Animated Cricket Ball */}
        <g transform={`translate(${ballSvg.cx}, ${ballSvg.cy})`}>
          <circle r={6.5} fill="#DC2626" stroke="#F8FAFC" strokeWidth={1.3} />
          <path
            d="M -3 -4 Q 0 0 -3 4"
            fill="none"
            stroke="#F8FAFC"
            strokeWidth={1}
            opacity="0.85"
          />
        </g>
      </g>

      {/* Fielders */}
      <g>
        {fieldDesign.fielders.map((fielder, idx) => {
          const pos = fieldToSvg({ x: fielder.x, y: fielder.y });
          const isSelected = interactive && selectedFielderId === fielder.id;

          const roleFill =
            fielder.role === 'bowler'
              ? '#0284C7'
              : fielder.role === 'wicketkeeper'
              ? '#D97706'
              : fielder.role === 'close-catcher'
              ? '#7C3AED'
              : fielder.role === 'boundary'
              ? '#0F766E'
              : '#1E3A8A';

          // Check if another fielder is close enough to cause label overlap
          const hasNearbyFielder = fieldDesign.fielders.some((other, otherIdx) => {
            if (otherIdx === idx) return false;
            return Math.hypot(other.x - fielder.x, other.y - fielder.y) < 12;
          });
          const labelYOffset =
            hasNearbyFielder && idx % 2 === 1 ? -23 : 24;
          const badgeWidth = Math.max(46, Math.min(110, fielder.name.length * 5.2 + 12));

          return (
            <g
              key={fielder.id}
              transform={`translate(${pos.cx}, ${pos.cy})`}
              className={interactive ? 'cursor-grab active:cursor-grabbing' : ''}
              role={interactive ? 'button' : undefined}
              tabIndex={interactive ? 0 : undefined}
              aria-label={`${fielder.name} (${fielder.shortLabel})`}
              onPointerDown={(e) => {
                if (!interactive) return;
                e.stopPropagation();
                onSelectFielder?.(fielder.id);
                setDragTarget({ kind: 'fielder', id: fielder.id });
              }}
              onKeyDown={(e) => {
                if (!interactive || !onMoveFielder) return;
                const step = e.shiftKey ? 5 : 2;
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  onMoveFielder(fielder.id, { x: fielder.x, y: fielder.y - step });
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  onMoveFielder(fielder.id, { x: fielder.x, y: fielder.y + step });
                } else if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  onMoveFielder(fielder.id, { x: fielder.x - step, y: fielder.y });
                } else if (e.key === 'ArrowRight') {
                  e.preventDefault();
                  onMoveFielder(fielder.id, { x: fielder.x + step, y: fielder.y });
                }
              }}
            >
              {(isSelected || fielder.highlighted) && (
                <circle
                  r={21}
                  fill="none"
                  stroke={isSelected ? '#FACC15' : '#D4AF37'}
                  strokeWidth={isSelected ? 2.4 : 1.5}
                  strokeDasharray={isSelected ? undefined : '4 3'}
                />
              )}
              <circle
                r={14.5}
                fill={roleFill}
                stroke={isSelected ? '#FACC15' : '#F8FAFC'}
                strokeWidth={isSelected ? 2.5 : 1.5}
              />
              <text
                y={3.5}
                textAnchor="middle"
                fill="#FFFFFF"
                fontSize="9.5"
                fontWeight="700"
                fontFamily="JetBrains Mono, monospace"
              >
                {fielder.shortLabel}
              </text>
              <g transform={`translate(0, ${labelYOffset})`}>
                <rect
                  x={-badgeWidth / 2}
                  y={-7.5}
                  width={badgeWidth}
                  height={14}
                  rx={3}
                  fill="rgba(8, 14, 26, 0.88)"
                />
                <text
                  y={2.5}
                  textAnchor="middle"
                  fill="#E2E8F0"
                  fontSize="8.5"
                  fontWeight="500"
                  fontFamily="DM Sans, sans-serif"
                >
                  {fielder.name.length > 18
                    ? `${fielder.name.slice(0, 17)}…`
                    : fielder.name}
                </text>
              </g>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
