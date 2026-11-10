import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEVELS,
  WORLD,
  createDefaultProgress,
  parseProgress,
  recordLevelResult,
  simulateTrajectory,
  velocityFromAim,
} from './orbit-launch-core.js';

test('内置星轨弹射保留完整 50 关并且每关存在有效解法', () => {
  assert.equal(LEVELS.length, 50);
  for (const level of LEVELS) {
    const launch = velocityFromAim(level.solution.angle, level.solution.power);
    const result = simulateTrajectory({
      position: level.start,
      velocity: launch,
      attractors: level.planets,
      fields: level.fields,
      wormholes: level.wormholes,
      obstacles: [...level.planets, ...level.hazards],
      target: level.target,
      bounds: { width: WORLD.width, height: WORLD.height, margin: WORLD.boundsMargin },
      shipRadius: WORLD.shipRadius,
      maxSteps: WORLD.maxSteps,
      sampleEvery: WORLD.sampleEvery,
      maxAcceleration: WORLD.maxAcceleration,
    });
    assert.equal(result.status, 'goal', `第 ${level.id} 关应可通关`);
  }
});

test('星轨弹射本地存档可恢复并保留最好成绩', () => {
  const initial = createDefaultProgress(LEVELS.length);
  const updated = recordLevelResult(initial, 0, { stars: 2, score: 2400 }, { time: 3.2, power: 5.8 }, LEVELS.length);
  const restored = parseProgress(JSON.stringify(updated), LEVELS.length);
  assert.equal(restored.unlocked, 2);
  assert.equal(restored.levels[1].stars, 2);
  assert.equal(restored.levels[1].bestScore, 2400);
});
