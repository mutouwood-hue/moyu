const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('摸鱼入口、十次皮肤解锁和游戏本地存档均已接入', () => {
  const main = fs.readFileSync('main.js', 'utf8');
  const renderer = fs.readFileSync('main-render.js', 'utf8');
  const game = fs.readFileSync('game/orbit-launch.js', 'utf8');
  assert.match(main, /enteringSlack/);
  assert.match(main, /config\.slackCount >= 10/);
  assert.match(main, /createGame\(\)/);
  assert.match(renderer, /skin-orbit/);
  assert.match(game, /localStorage\.setItem\(STORAGE_KEY/);
  assert.match(game, /localStorage\.getItem\(STORAGE_KEY/);
});

test('主界面引用的固定元素都存在，避免渲染中断导致主题无法恢复', () => {
  const renderer = fs.readFileSync('main-render.js', 'utf8');
  const html = fs.readFileSync('index.html', 'utf8');
  const ids = new Set(Array.from(html.matchAll(/\bid="([^"]+)"/g), match => match[1]));
  const references = Array.from(renderer.matchAll(/\$\('([^']+)'\)/g), match => match[1]);
  assert.deepEqual([...new Set(references.filter(id => !ids.has(id)))], []);
});
