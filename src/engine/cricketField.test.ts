import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampFieldPoint,
  classifyFieldingZone,
  cloneFieldDesignFromPreset,
  evaluateBallPathAtProgress,
  fieldToSvg,
  svgToField,
} from './cricketField';

test('clampFieldPoint constrains coordinates within boundary radius', () => {
  const inside = clampFieldPoint({ x: 30, y: -40 }, 94);
  assert.deepEqual(inside, { x: 30, y: -40 });

  const outside = clampFieldPoint({ x: 100, y: 100 }, 94);
  const dist = Math.hypot(outside.x, outside.y);
  assert.ok(dist <= 94.1, `Expected distance <= 94.1, got ${dist}`);
});

test('fieldToSvg and svgToField round-trip accurately', () => {
  const original = { x: -34.5, y: 22.0 };
  const svg = fieldToSvg(original);
  const back = svgToField(svg.cx, svg.cy);
  assert.equal(back.x, original.x);
  assert.equal(back.y, original.y);
});

test('classifyFieldingZone distinguishes off side and leg side for right vs left hander', () => {
  const rhbCover = classifyFieldingZone(-32, -12, 'right');
  assert.match(rhbCover, /Cover/i);

  const lhbLeg = classifyFieldingZone(-32, -12, 'left');
  assert.match(lhbLeg, /Mid-Wicket|Mid-On/i);

  const deepMidWicket = classifyFieldingZone(76, -20, 'right');
  assert.match(deepMidWicket, /Deep Mid-Wicket|Long-On/i);

  assert.equal(classifyFieldingZone(-3, -26, 'right'), 'Bowler Run-Up');
  assert.equal(classifyFieldingZone(0, 24, 'right'), 'Wicketkeeper Area');
});

test('evaluateBallPathAtProgress transitions through delivery, bounce, shot, and complete', () => {
  const design = cloneFieldDesignFromPreset('powerplay-attack');
  const startEval = evaluateBallPathAtProgress(design.ballPath, 0);
  assert.equal(startEval.phase, 'delivery');
  assert.equal(startEval.bounceReached, false);

  const midBounce = evaluateBallPathAtProgress(design.ballPath, 0.4);
  assert.equal(midBounce.phase, 'bounce');
  assert.equal(midBounce.bounceReached, true);
  assert.equal(midBounce.impactReached, false);

  const shotPhase = evaluateBallPathAtProgress(design.ballPath, 0.75);
  assert.equal(shotPhase.phase, 'shot');
  assert.equal(shotPhase.impactReached, true);

  const endEval = evaluateBallPathAtProgress(design.ballPath, 1);
  assert.equal(endEval.phase, 'complete');
  assert.deepEqual(endEval.position, design.ballPath.end);
});
