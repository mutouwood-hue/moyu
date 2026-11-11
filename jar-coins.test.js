const { test } = require('node:test');
const assert = require('node:assert/strict');
const jar = require('./jar-coins');

test('工资金额拆为四种面额，跨面额时自动合并且总值一致', () => {
  assert.deepEqual(jar.breakdown(9.99).counts, [0, 9, 9, 9]);
  assert.deepEqual(jar.breakdown(10).counts, [1, 0, 0, 0]);
  assert.deepEqual(jar.breakdown(9.99).counts, [0, 9, 9, 9], '金额下降时应重新拆分，不能保留多余金币');
  assert.deepEqual(jar.breakdown(23.47).counts, [2, 3, 4, 7]);
});
test('自定义面额、剩余金额、异常数据与精度边界', () => {
  const cfg = { jarGold: 20, jarSilver: 5, jarGoldBean: 1, jarSilverBean: 0.2 };
  assert.deepEqual(jar.breakdown(26.35, cfg), { counts: [1, 1, 1, 1], remainder: 15, totalCount: 4 });
  assert.equal(jar.denominations({ jarGold: 1, jarSilver: 2, jarGoldBean: .1, jarSilverBean: .01 }), null);
  assert.equal(jar.denominations({ jarGold: 10, jarSilver: 1, jarGoldBean: .1, jarSilverBean: .001 }), null);
  assert.deepEqual(jar.breakdown(-1).counts, [0, 0, 0, 0]);
  assert.deepEqual(jar.breakdown(NaN).counts, [0, 0, 0, 0]);
});

test('物理世界中落下的币会碰撞底部币堆，并可最终静止', () => {
  const Matter = require('matter-js');
  const world = jar.createPhysicsWorld(Matter);
  const lower = world.add({ kind: 0, key: '0:0', left: 45, bottom: 9, column: 3 }, false);
  const falling = world.add({ kind: 3, key: '3:0', column: 3 }, true);
  Matter.Body.setPosition(falling, { x: lower.position.x, y: 48 });
  let hits = 0;
  Matter.Events.on(world.engine, 'collisionStart', e => {
    hits += e.pairs.filter(p => [p.bodyA, p.bodyB].includes(lower) && [p.bodyA, p.bodyB].includes(falling)).length;
  });
  let displacement = 0;
  const initialX = lower.position.x, initialY = lower.position.y;
  for (let i = 0; i < 900; i++) {
    Matter.Engine.update(world.engine, 1000 / 60);
    displacement = Math.max(displacement, Math.hypot(lower.position.x - initialX, lower.position.y - initialY));
  }
  assert.ok(hits > 0, '下落币应与已有币产生真实碰撞');
  assert.ok(displacement > .1, '碰撞应推动已有币');
  assert.ok(falling.position.y < 340, '币不得穿过罐底');
  assert.ok(lower.isSleeping && falling.isSleeping, '堆积后应休眠，避免持续抖动');
});
