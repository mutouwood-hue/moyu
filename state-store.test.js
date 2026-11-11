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

test('防线伙伴购买、重启后切换与余额不足均保持钱包和库存一致', () => {
  const ids = ['defense-soldier', 'defense-zombie', 'defense-runner', 'defense-boss'];
  let state = STORE.migrateState({ fishCoins: 800, monthly: 8888 }, {});
  for (const id of ids) {
    const purchased = STORE.transactPurchase(state, id, 1);
    assert.equal(purchased.ok, true);
    assert.equal(purchased.state.equipped.capybara, id);
    state = purchased.state;
  }
  assert.equal(state.fishCoins, 0);
  assert.equal(state.monthly, 8888);
  state = STORE.migrateState(JSON.parse(JSON.stringify(state)), {});
  assert.equal(STORE.transactPurchase(state, ids[0], 2).code, 'OWNED');
  const selected = STORE.equipItem(state, ids[0]);
  assert.equal(selected.ok, true);
  assert.equal(selected.state.equipped.capybara, ids[0]);
  assert.equal(selected.state.fishCoins, 0);
  assert.equal(STORE.equipItem(selected.state, 'capybara-classic').state.equipped.capybara, 'capybara-classic');
  assert.equal(STORE.transactPurchase(STORE.migrateState({ fishCoins: 199 }, {}), ids[1], 3).code, 'INSUFFICIENT');
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

test('木鱼结算保存失败不修改钱包，重试同一局只入账一次', () => {
  const current = STORE.migrateState({ fishCoins: 100 }, {});
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const result = { score: 1, combo: 1, hits: 1 };
  const failed = STORE.settleMuyu(current, result, id, 1, () => false);
  assert.equal(failed.code, 'SAVE_FAILED');
  assert.equal(failed.state, current);
  assert.equal(current.fishCoins, 100);
  let disk;
  const success = STORE.settleMuyu(current, result, id, 2, state => { disk = structuredClone(state); return true; });
  assert.equal(success.state.fishCoins, 110);
  assert.equal(disk.fishCoins, 110);
  assert.equal(disk.gameStats.muyuGames, 1);
  const duplicate = STORE.settleMuyu(disk, result, id, 3, () => { throw new Error('重复请求不能写入'); });
  assert.equal(duplicate.code, 'DUPLICATE');
  assert.equal(duplicate.reward, 10);
  assert.equal(duplicate.state.fishCoins, 110);
});

test('损坏或不可读取的新存档不会回退并覆盖，缺失时才能迁移旧存档', () => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moyu-store-test-'));
  const state = path.join(dir, 'app-state.json'), legacy = path.join(dir, 'config.json');
  try {
    fs.writeFileSync(legacy, JSON.stringify({ fishCoins: 55 }));
    assert.equal(STORE.readSavedState(fs, state, legacy).fishCoins, 55);
    fs.writeFileSync(state, '{damaged');
    assert.throws(() => STORE.readSavedState(fs, state, legacy), /损坏/);
    assert.equal(fs.readFileSync(state, 'utf8'), '{damaged');
    fs.writeFileSync(state, 'null');
    assert.throws(() => STORE.readSavedState(fs, state, legacy), /格式/);
    assert.throws(() => STORE.readSavedState({readFileSync(){const e=new Error('denied'); e.code='EACCES'; throw e;}}, state, legacy), /无法读取/);
  } finally { fs.rmSync(dir, { recursive:true, force:true }); }
});

test('几猫一次解锁扣 100，重复与余额不足保持余额和其他存档', () => {
 const initial=STORE.migrateState({fishCoins:128,monthly:8888,defenseProgress:{supply:42}},{});
 const first=STORE.unlockJimao(initial,1); assert.equal(first.state.fishCoins,28);assert.equal(first.state.monthly,8888);assert.equal(first.state.defenseProgress.supply,42);
 const restored=STORE.migrateState(JSON.parse(JSON.stringify(first.state)),{});const again=STORE.unlockJimao(restored,2);
 assert.equal(again.code,'OWNED');assert.equal(again.state.fishCoins,28);
 const no=STORE.unlockJimao(STORE.migrateState({fishCoins:99},{}),3);assert.equal(no.code,'INSUFFICIENT');assert.equal(no.state.fishCoins,99);
});

test('防线一键升级精确找零、重试幂等、等级冲突不扣款', async () => {
 const core=await import('./game/defense-core.js');let p=core.defaultProgress();let before=STORE.migrateState({fishCoins:5,defenseProgress:p,monthly:8888},{});
 const req={id:'11111111-1111-4111-8111-111111111111',kind:'tech',item:'recruits',expectedLevel:0};
 const result=STORE.buyDefenseUpgrade(before,req,core,1);assert.equal(result.ok,true);assert.equal(result.state.fishCoins,4);assert.equal(result.state.defenseProgress.supply,65);assert.equal(result.state.defenseProgress.tech.recruits,1);assert.equal(result.state.monthly,8888);assert.equal(before.fishCoins,5);
 const retry=STORE.buyDefenseUpgrade(result.state,req,core,2);assert.equal(retry.code,'DUPLICATE');assert.equal(retry.state.fishCoins,4);
 const stale=STORE.buyDefenseUpgrade(result.state,{...req,id:'22222222-2222-4222-8222-222222222222'},core,2);assert.equal(stale.code,'STALE');assert.equal(stale.state,result.state);
 const locked=STORE.buyDefenseUpgrade(before,{...req,id:'33333333-3333-4333-8333-333333333333',kind:'refinement',item:'laser'},core,2);assert.equal(locked.code,'LOCKED');
 const poor=STORE.buyDefenseUpgrade({...before,fishCoins:0},req,core,2);assert.equal(poor.code,'INSUFFICIENT');
});

test('防线奖励只随同局结算一次，无尽按有效秒数且恢复后不重复', () => {
 let p=STORE.migrateState({fishCoins:10},{}),id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 p=STORE.defenseTransaction(p,'start',id,1,{level:1,endless:false,seed:1}).state;
 const won=STORE.finishDefense(p,id,{supply:40},{status:'won',activeSeconds:12},2);assert.equal(won.reward,12);assert.equal(won.state.fishCoins,21);
 const again=STORE.finishDefense(won.state,id,{supply:999},{status:'won',activeSeconds:12},3);assert.equal(again.code,'DUPLICATE');assert.equal(again.reward,12);assert.equal(again.state.fishCoins,21);
 let id2='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';let e=STORE.defenseTransaction(won.state,'start-endless',id2,4,{level:30,endless:true,seed:1}).state;
 let result=STORE.finishDefense(e,id2,{supply:50},{status:'cashout',activeSeconds:31},5);assert.equal(result.reward,3);assert.equal(result.state.fishCoins,23);
 const no=STORE.finishDefense(p,id,{supply:0},{status:'failed',activeSeconds:2},3);assert.equal(no.reward,0);
});
