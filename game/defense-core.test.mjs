import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WEAPONS,TECH,BOSSES,levelSpec,soldierFirepower,boxOdds,equipWeapon,defaultProgress,buyUpgrade,normalizeProgress,createBattle,stepBattle,checkpoint,settleBattle} from './defense-core.js';
test('30 关难度预算不随随机种子变化，章节末固定 Boss',()=>{for(let l=1;l<=30;l++){let a=levelSpec(l,1),b=levelSpec(l,2);assert.equal(a.enemies.reduce((s,e)=>s+e.cost,0),a.budget);assert.equal(a.budget,b.budget);assert.equal(Boolean(a.boss),l%6===0)}});
test('巨尸与乱入槽共同占用既有预算，特殊成本总额不超过基准的三成',()=>{
 for(let level=1;level<=30;level++)for(let seed=1;seed<=200;seed++){
  const spec=levelSpec(level,seed),special=spec.enemies.filter(e=>e.giant||e.intruderSlot);
  assert.ok(special.reduce((sum,e)=>sum+e.cost,0)<=Math.floor(spec.budget*.3));
  assert.equal(spec.enemies.reduce((sum,e)=>sum+e.cost,0),spec.budget);
  assert.ok(special.every(e=>e.giant?e.kind==='normal'&&e.cost===10:e.cost===22));
 }
});
test('巨型普通僵尸血量与接触减员为普通僵尸十倍',()=>{
 const b=createBattle({level:18,seed:2});b.schedule=[{kind:'normal',lane:.5,at:0,cost:1},{kind:'normal',lane:.5,at:0,cost:10,giant:true}];b.gateIndex=3;b.fireClock=100;b.soldiers=50;stepBattle(b,.05);
 assert.equal(b.enemies[1].hp,10*b.enemies[0].hp);
 b.enemies=[b.enemies[1]];b.enemies[0].z=.01;stepBattle(b,.05);assert.equal(b.soldiers,40);
});
test('乱入槽只使用已通关的早期 Boss，能预警并被射击击败',()=>{
 const seed=Array.from({length:100},(_,i)=>i+1).find(s=>levelSpec(18,s).enemies.some(e=>e.intruderSlot));assert.ok(seed);
 const plain=createBattle({level:18,seed});assert.ok(plain.schedule.some(e=>e.intruderSlot&&!Number.isInteger(e.intruderBoss)));
 const p=defaultProgress();p.cleared=[6,12,18,24];const b=createBattle({level:18,seed,progress:p});
 const slot=b.schedule.find(e=>e.intruderSlot);assert.ok([0,1].includes(slot.intruderBoss));assert.equal(slot.bossName,BOSSES[slot.intruderBoss]);
 b.schedule=[{...slot,at:0,lane:.5}];b.gateIndex=3;b.fireClock=100;
 for(const key in b.skillClocks)b.skillClocks[key]=100;stepBattle(b,.05);
 assert.ok(b.events.some(e=>e.type==='intruder'&&e.bossName===slot.bossName));assert.equal(b.boss,null);
 assert.ok(Math.abs(b.enemies[0].hp-(4+18*.42)*(1+2*.75)*12)<1e-9);
 b.enemies[0].z=.34;stepBattle(b,.05);assert.ok(b.warnings.some(w=>w.attack==='intruder'&&w.time>0));
 b.enemies[0].hp=.001;b.fireClock=0;stepBattle(b,.05);assert.ok(b.events.some(e=>e.type==='kill'));assert.equal(b.boss,null);
});
test('两侧门初始收益较低一方箱子与稀有概率更高',()=>{assert.ok(boxOdds(3,20).spawn>boxOdds(20,3).spawn);assert.ok(boxOdds(3,20).rare>boxOdds(20,3).rare);assert.ok(boxOdds(3,20).rare<1);assert.ok(soldierFirepower(20)-soldierFirepower(19)<soldierFirepower(2)-soldierFirepower(1))});
test('12 武器、重复升级、弱武器不替换满槽',()=>{assert.equal(WEAPONS.length,12);let slots=['gatling','sniper','laser','plasma'].map(id=>({id,level:3}));let duplicate=equipWeapon(slots,'laser');assert.equal(duplicate.modules[2].level,4);let weak=equipWeapon(slots,'rifle');assert.equal(weak.bonus,true);assert.deepEqual(weak.modules,slots)});
test('六项科技和精研花费相同补给币，失败不扣费',()=>{assert.equal(Object.keys(TECH).length,6);let p=defaultProgress();p.supply=100;let r=buyUpgrade(p,'tech','damage');assert.equal(r.progress.supply,60);assert.equal(p.supply,100);assert.equal(buyUpgrade(defaultProgress(),'tech','damage').ok,false);assert.equal(buyUpgrade(p,'refinement','plasma').ok,false)});
test('相同种子和操作结果一致且失败后停止',()=>{let a=createBattle({seed:42}),b=createBattle({seed:42});for(let i=0;i<1000;i++){stepBattle(a,.05);stepBattle(b,.05)}assert.deepEqual(a,b);a.status='failed';let t=a.time;stepBattle(a,.05);assert.equal(a.time,t)});
test('首次奖励只发一次，无尽死亡清除检查点',()=>{let p=defaultProgress(),b=createBattle({seed:1});b.status='won';let first=settleBattle(p,b);let repeat=settleBattle(first.progress,b);assert.equal(first.first,true);assert.equal(repeat.first,false);assert.ok(first.reward>repeat.reward);b.endless=true;b.wave=5;let cp=checkpoint(b);p.endless=cp;b.status='failed';assert.equal(settleBattle(p,b).progress.endless,null);assert.equal(normalizeProgress(p).endless.battle.wave,6)});
test('检查点恢复后再次保存不会嵌套旧检查点',()=>{let p=defaultProgress(),b=createBattle({endless:true,wave:5,seed:4,progress:p});b.status='won';p.endless=checkpoint(b);let restored=p.endless.battle;restored.wave=10;restored.status='won';let next=checkpoint(restored);assert.equal(next.wave,10);assert.equal(next.battle.progress.endless,null);assert.ok(JSON.stringify(next).length<100000)});
test('士兵为零立即失败，门锁定的概率不会随射击改变',()=>{let b=createBattle({seed:3});b.soldiers=0;stepBattle(b,.05);assert.equal(b.status,'failed');b=createBattle({seed:7});while(!b.gate)stepBattle(b,.05);let odds=JSON.stringify(b.gate.left.odds),initial=b.gate.left.initial;b.x=.25;for(let i=0;i<20;i++)stepBattle(b,.05);assert.equal(JSON.stringify(b.gate.left.odds),odds);assert.equal(b.gate.left.initial,initial)});
test('无尽高波次依靠预设波次增强，不读取当前军队强度',()=>{let low=defaultProgress(),high=defaultProgress();high.tech.damage=10;let a=createBattle({endless:true,wave:60,seed:42,progress:low}),b=createBattle({endless:true,wave:60,seed:42,progress:high}),c=createBattle({endless:true,wave:80,seed:42,progress:low});assert.deepEqual(a.schedule,b.schedule);assert.equal(a.waveScale,b.waveScale);assert.ok(c.waveScale>a.waveScale);assert.ok(c.schedule.length>a.schedule.length)});
test('无尽高波次额外尸潮不会复制巨尸和乱入槽',()=>{for(let seed=1;seed<=100;seed++){const spec=levelSpec(30,seed),battle=createBattle({endless:true,wave:201,seed});const special=a=>a.filter(e=>e.giant||e.intruderSlot).reduce((n,e)=>n+e.cost,0);assert.equal(special(battle.schedule),special(spec.enemies));assert.ok(special(battle.schedule)<=Math.floor(spec.budget*.3))}});
test('每列士兵发射独立子弹，能同时命中不同横向目标',()=>{let b=createBattle({seed:3});b.soldiers=67;b.schedule=[];b.gateIndex=3;b.enemies=[{kind:'normal',x:.35,z:.5,hp:100,maxHp:100},{kind:'normal',x:.65,z:.5,hp:100,maxHp:100}];stepBattle(b,.05);let shots=b.events.filter(e=>e.type==='shot');assert.equal(shots.length,10);assert.equal(new Set(shots.map(e=>e.fromX)).size,10);assert.ok(b.enemies.every(e=>e.hp<100));});
test('跨越道路中线的阵型不会误射未选择的数字门',()=>{let b=createBattle({seed:1});b.soldiers=67;b.x=.5;b.schedule=[];b.gateIndex=3;b.gate={z:.6,left:{type:'add',value:5},right:{type:'add',value:5},charge:0};stepBattle(b,.05);let shots=b.events.filter(e=>e.type==='shot'&&e.target==='gate');assert.ok(shots.length>0);assert.ok(shots.every(e=>e.fromX>=.5));assert.equal(b.gate.left.value,5)});
test('无尽失败结算清除检查点，后续恢复不会产生可重用的记录',()=>{let p=defaultProgress();let b=createBattle({endless:true,wave:5,seed:42,progress:p});b.status='won';p.endless=checkpoint(b);let continued=p.endless.battle;continued.status='failed';continued.soldiers=0;let r=settleBattle(p,continued);assert.equal(r.progress.endless,null);assert.ok(r.reward>=0);assert.equal(r.progress.records.wave,6)});
test('数字门通过后才生成箱子，击破才发放武器',()=>{let b=createBattle({seed:19});b.schedule=[];b.gateIndex=3;b.x=.75;b.gate={z:.121,charge:0,left:{type:'add',value:4,odds:{spawn:1,rare:.2}},right:{type:'add',value:6,odds:{spawn:1,rare:.2}}};b.fireClock=10;stepBattle(b,.05);assert.equal(b.gate,null);assert.ok(b.box);assert.equal(b.modules.length,1);assert.equal(b.soldiers,18);b.box.hp=.01;b.fireClock=0;stepBattle(b,.05);assert.equal(b.box,null);assert.ok(b.events.some(e=>e.type==='weapon'));});
test('五种首领都先产生范围预警再结算伤害',()=>{for(let i=0;i<5;i++){let b=createBattle({level:(i+1)*6,seed:i+1});b.schedule=[];b.spawn=0;b.gateIndex=3;b.phase='boss';b.boss={name:['巨型胖胖僵尸','变异实验体','冰甲巨人','机械改造怪','尸潮核心'][i],hp:1000,maxHp:1000,clock:0,attackIndex:0};b.skillClocks.shield=100;let n=b.soldiers;stepBattle(b,.05);assert.ok(b.warnings.length>0);assert.equal(b.soldiers,n);for(let j=0;j<30;j++)stepBattle(b,.05);assert.ok(b.soldiers<=n)}});
test('恢复和下一波都不共享检查点的可变状态',async()=>{const {restoreBattle}=await import('./defense-core.js');let b=createBattle({endless:true,wave:5,seed:9});b.status='won';b.modules=[{id:'rifle',level:2}];b.skillClocks.shield=5;b.weaponStats.rifle={kills:3,shots:4,highest:2};let saved=checkpoint(b),before=JSON.stringify(saved);let resumed=restoreBattle(saved.battle);resumed.modules[0].level=99;resumed.skillClocks.shield=0;resumed.weaponStats.rifle.kills=900;assert.equal(JSON.stringify(saved),before);b.modules[0].level=77;b.skillClocks.shield=0;b.weaponStats.rifle.kills=500;b.progress.stats.rifle={kills:999};assert.equal(JSON.stringify(saved),before)});
test('僵尸接触可见队形前缘立即减员且只结算一次',()=>{let b=createBattle({seed:12});b.soldiers=99;b.schedule=[];b.gateIndex=3;b.fireClock=99;b.enemies=[{kind:'normal',x:.5,z:.16,hp:100,maxHp:100}];stepBattle(b,.05);assert.equal(b.soldiers,98);assert.equal(b.enemies.length,0);stepBattle(b,.05);assert.equal(b.soldiers,98)});
test('小队和大队的接触前沿随可见队形变化',()=>{let make=n=>{let b=createBattle({seed:10});b.soldiers=n;b.schedule=[];b.gateIndex=3;b.fireClock=99;b.enemies=[{kind:'normal',x:.5,z:.16,hp:100,maxHp:100}];stepBattle(b,.05);return b};assert.equal(make(1).soldiers,1);assert.equal(make(99).soldiers,98)});
test('队伍可快速横移，持续射击产生连续多列弹幕',async()=>{const {moveBattle}=await import('./defense-core.js');let b=createBattle({seed:21});b.soldiers=12;b.schedule=[];b.gateIndex=3;moveBattle(b,1,.25);assert.ok(b.x>=.80);for(let i=0;i<20;i++)stepBattle(b,.05);const volley=b.events.filter(e=>e.type==='shot'&&e.col===0);assert.ok(volley.length>=7)});
test('近处僵尸缓慢靠近玩家，远离玩家的僵尸不跨越道路追踪',()=>{const b=createBattle({seed:1});b.schedule=[];b.gateIndex=3;b.fireClock=100;b.enemies=[{kind:'normal',x:.4,z:.5,hp:100,maxHp:100},{kind:'normal',x:.1,z:.5,hp:100,maxHp:100}];stepBattle(b,.05);assert.ok(b.enemies[0].x>.4&&b.enemies[0].x<=.40201);assert.equal(b.enemies[1].x,.1)});
test('大队左右贴边时完整队形仍在窗口内，增兵后也会修正边界',async()=>{const {moveBattle,setPosition,formationColumns}=await import('./defense-core.js');let b=createBattle({seed:21});for(const n of [1,18,80,300]){b.soldiers=n;const half=((formationColumns(n)-1)*8+17.5)/400;for(const x of [-1,2]){setPosition(b,x);assert.ok(b.x-half>=-.100001&&b.x+half<=1.100001)}}b.soldiers=1;setPosition(b,2);b.soldiers=300;moveBattle(b,0,1/60);let half=((formationColumns(b.soldiers)-1)*8+17.5)/400;assert.ok(b.x+half<=1.100001)});

test('五个首领使用各自的预警攻击，命中扣兵、闪避有效且冰冻生效',()=>{
 const names=[['charge','slam'],['poison','summon'],['freeze','icicle'],['laser','bomb'],['core','core_burst']];
 function encounter(kind,turn,enraged=false){
  const b=createBattle({level:(kind+1)*6,seed:kind+1});
  b.schedule=[];b.gateIndex=3;b.phase='boss';b.soldiers=60;b.fireClock=100;
  for(const key of Object.keys(b.skillClocks))b.skillClocks[key]=100;
  b.boss={name:BOSSES[kind],hp:enraged?400:1000,maxHp:1000,clock:0,attackIndex:turn};
  stepBattle(b,.05);b.boss.clock=100;return b;
 }
 for(let kind=0;kind<5;kind++)for(let turn=0;turn<2;turn++){
  const enraged=kind===4&&turn===1,hit=encounter(kind,turn,enraged),attack=names[kind][turn];
  assert.equal(hit.warnings[0].attack,attack);assert.ok(hit.events.some(e=>e.type==='warning'&&e.attack===attack));
  if(attack==='summon')assert.equal(hit.enemies.filter(e=>e.kind==='runner').length,2);
  if(attack==='core_burst')assert.equal(hit.warnings.length,2);
  hit.x=hit.warnings[0].x;const before=hit.soldiers;
  while(hit.warnings.length)stepBattle(hit,.05);
  assert.ok(hit.soldiers<before,`${attack} did not damage an exposed squad`);
  if(attack==='freeze')assert.ok(hit.frozen>0);
  const safe=encounter(kind,turn,enraged);safe.x=[.08,.92].sort((a,c)=>Math.min(...safe.warnings.map(w=>Math.abs(c-w.x)-w.radius))-Math.min(...safe.warnings.map(w=>Math.abs(a-w.x)-w.radius)))[0];
  const safeBefore=safe.soldiers;while(safe.warnings.length)stepBattle(safe,.05);
  assert.equal(safe.soldiers,safeBefore,`${attack} damaged a squad outside its warning`);
 }
});
test('每个章节 Boss 在道路结束时登场、冻结道路进度并可击败',()=>{
 for(let kind=0;kind<5;kind++){
  const b=createBattle({level:(kind+1)*6,seed:kind+10});b.schedule=[];b.spawn=0;b.gateIndex=3;b.time=62;b.soldiers=80;
  stepBattle(b,.05);assert.equal(b.phase,'boss');assert.equal(b.boss.name,BOSSES[kind]);const roadTime=b.roadTime;
  b.boss.hp=.01;b.fireClock=0;stepBattle(b,.05);stepBattle(b,.05);
  assert.equal(b.roadTime,roadTime);assert.equal(b.status,'won');assert.ok(b.events.some(e=>e.type==='won'));
 }
});

test('无尽检查点保留有效操作时间以便最终结算',async()=>{
 const {restoreBattle}=await import('./defense-core.js');
 let b=createBattle({endless:true,wave:5,seed:4});b.fishActiveSeconds=23;b.status='won';let cp=checkpoint(b);
 assert.equal(cp.battle.fishActiveSeconds,23);
 assert.equal(restoreBattle(cp.battle).fishActiveSeconds,23);
});
