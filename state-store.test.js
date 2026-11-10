const test = require('node:test');
const assert = require('node:assert/strict');
const STORE = require('./state-store.js');

test('购买后可以从收藏重新装备默认外观', () => {
  const state = STORE.migrateState({ fishCoins: 500 }, {});
  const purchased = STORE.transactPurchase(state, 'theme-simple', 1);
  const restored = STORE.equipItem(purchased.state, 'theme-classic');
  assert.equal(restored.ok, true);
  assert.equal(restored.state.equipped.theme, 'theme-classic');
  assert.equal(restored.state.fishCoins, 200);
});

test('旧配置迁移时保留计薪字段并初始化独立摸鱼币域', () => {
  const state = STORE.migrateState({ monthly: 8888, history: [{ date: '2026-08-13' }] }, { mode: 'work' });
  assert.equal(state.monthly, 8888);
  assert.equal(state.fishCoins, 128);
  assert.equal(state.dataVersion, 2);
  assert.deepEqual(state.equipped, { theme: 'theme-classic', floating: 'floating-classic', capybara: 'capybara-classic' });
});

test('购买在一个状态变更中同时扣币、入库和装备', () => {
  const before = STORE.migrateState({ fishCoins: 600 }, {});
  const result = STORE.transactPurchase(before, 'theme-office-night', 1);
  assert.equal(result.ok, true);
  assert.equal(result.state.fishCoins, 100);
  assert.ok(result.state.ownedItems.includes('theme-office-night'));
  assert.equal(result.state.equipped.theme, 'theme-office-night');
  assert.equal(before.fishCoins, 600);
});

test('余额不足不会产生半完成购买', () => {
  const before = STORE.migrateState({ fishCoins: 10 }, {});
  const result = STORE.transactPurchase(before, 'capybara-pajamas', 1);
  assert.equal(result.ok, false);
  assert.equal(result.state, before);
  assert.equal(before.ownedItems.includes('capybara-pajamas'), false);
});

test('木鱼结算奖励限定在 10 到 25 摸鱼币', () => {
  const low = STORE.awardMuyu(STORE.migrateState({ fishCoins: 0 }, {}), { score: 0, combo: 0, hits: 1 }, 1);
  const high = STORE.awardMuyu(STORE.migrateState({ fishCoins: 0 }, {}), { score: 99999, combo: 999, hits: 1 }, 2);
  const idle = STORE.awardMuyu(STORE.migrateState({ fishCoins: 0 }, {}), { score: 0, combo: 0, hits: 0 }, 3);
  assert.equal(low.reward, 10);
  assert.equal(high.reward, 25);
  assert.equal(idle.reward, 0);
});

test('防线开局和兑换一次提交并防止重复扣币',()=>{
 const p=STORE.migrateState({fishCoins:2,defenseProgress:{version:2,supply:30,endless:{wave:5}}},{});
 const start=STORE.defenseTransaction(p,'start-endless','11111111-1111-4111-8111-111111111111',1,{level:30,endless:true,seed:42});
 assert.equal(start.state.fishCoins,1);assert.equal(start.state.defenseProgress.endless,null);assert.equal(p.fishCoins,2);
 const duplicate=STORE.defenseTransaction(start.state,'start-endless','11111111-1111-4111-8111-111111111111',2);
 assert.equal(duplicate.state.fishCoins,1);assert.equal(duplicate.code,'DUPLICATE');
 const exchange=STORE.defenseTransaction(start.state,'exchange','22222222-2222-4222-8222-222222222222',3);
 assert.equal(exchange.state.fishCoins,0);assert.equal(exchange.state.defenseProgress.supply,130);
 assert.equal(STORE.defenseTransaction(exchange.state,'start','33333333-3333-4333-8333-333333333333',4,{level:1,endless:false,seed:1}).ok,false);
});
test('同一付费局的结算只入账一次，重复请求不会覆盖已保存进度',()=>{
 const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',p=STORE.migrateState({fishCoins:2},{}),started=STORE.defenseTransaction(p,'start',id,1,{level:1,endless:false,seed:4}).state;
 const result=STORE.finishDefense(started,id,{supply:50,cleared:[1]});assert.equal(result.ok,true);assert.equal(result.state.defenseProgress.supply,50);assert.equal(result.state.defenseActiveRun,null);
 const again=STORE.finishDefense(result.state,id,{supply:9999});assert.equal(again.code,'DUPLICATE');assert.equal(again.state.defenseProgress.supply,50);assert.equal(STORE.finishDefense(started,'another',{supply:20}).ok,false);
});
test('余额为零时开局和兑换都不修改钱包或补给',()=>{const p=STORE.migrateState({fishCoins:0,defenseProgress:{supply:12}},{});for(const action of ['start','exchange']){const r=STORE.defenseTransaction(p,action,'dddddddd-dddd-4ddd-8ddd-dddddddddddd',1,{level:1,endless:false,seed:7});assert.equal(r.ok,false);assert.equal(r.code,'INSUFFICIENT');assert.equal(r.state,p)}assert.equal(p.defenseProgress.supply,12)});
