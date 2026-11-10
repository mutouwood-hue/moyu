const test = require('node:test');
const assert = require('node:assert/strict');
const ENGINE = require('./engine');

function at(hour, minute) {
  return new Date(2026, 7, 12, hour, minute || 0, 0);
}

test('新用户初始工资为 5000 元', () => {
  assert.equal(ENGINE.DEFAULTS.monthly, 5000);
});

test('默认班次的日薪、每秒收入和完成金额自洽', () => {
  const cfg = { ...ENGINE.DEFAULTS };
  assert.equal(ENGINE.shiftSeconds(cfg), 9 * 3600);
  assert.equal(ENGINE.elapsedInShift(cfg, at(9)), 0);
  assert.equal(ENGINE.timeProgress(cfg, at(13, 30)), 0.5);
  assert.ok(Math.abs(ENGINE.earnedToday(cfg, at(18)) - ENGINE.dailySalary(cfg)) < 1e-8);
});

test('标准工资在 100% 封顶，加班只产生参考值', () => {
  const cfg = { ...ENGINE.DEFAULTS };
  assert.equal(ENGINE.timeProgress(cfg, at(20)), 1);
  assert.equal(ENGINE.overtimeSeconds(cfg, at(20)), 2 * 3600);
  assert.ok(Math.abs(ENGINE.earnedToday(cfg, at(20)) - ENGINE.dailySalary(cfg)) < 1e-8);
  assert.ok(ENGINE.overtimeReference(cfg, at(20)) > 0);
});

test('跨夜班次正确处理零点前后', () => {
  const cfg = { ...ENGINE.DEFAULTS, shiftStart: '22:00', shiftEnd: '06:00' };
  assert.equal(ENGINE.shiftSeconds(cfg), 8 * 3600);
  assert.equal(ENGINE.elapsedInShift(cfg, at(2)), 4 * 3600);
  assert.equal(ENGINE.timeProgress(cfg, at(2)), 0.5);
  assert.equal(ENGINE.overtimeSeconds(cfg, at(7)), 3600);
});

test('金额换算保留一位小数并预估剩余时间', () => {
  const cfg = { ...ENGINE.DEFAULTS };
  assert.equal(ENGINE.itemText(40, '奶茶', 20), '2 奶茶');
  assert.equal(ENGINE.itemText(42, '奶茶', 20), '2.1 奶茶');
  assert.ok(ENGINE.remainingMinutesForItem(cfg, 10, 20) > 0);
});

test('摸鱼称号边界保持原计算口径', () => {
  assert.equal(ENGINE.slackTier(0.009), null);
  assert.equal(ENGINE.slackTier(0.01), '摸鱼萌新');
  assert.equal(ENGINE.slackTier(0.2), '摸鱼大王');
});
