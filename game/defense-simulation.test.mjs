import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,stepBattle,moveBattle,setPosition,defaultProgress} from './defense-core.js';

// The controller chooses a gate/box but moves away from visible threats and
// telegraphs. It uses the same firepower, technology and movement limits as an
// idle run; it has no access to future enemy positions or random draws.
function simulate(level,seed,{tech=3,position=null}={}) {
 const progress=defaultProgress();
 for(const key of Object.keys(progress.tech))progress.tech[key]=tech;
 progress.cleared=Array.from({length:Math.floor((level-1)/6)},(_,i)=>(i+1)*6);
 const b=createBattle({level,seed,progress});
 if(position!==null)setPosition(b,position);
 for(let frame=0;frame<6000&&b.status==='playing';frame++){
  if(position===null){
   const warnings=b.warnings.filter(w=>w.time<1.2),close=b.enemies.filter(e=>e.z<.55);
   const goal=b.box?b.box.x:b.gate?(b.gate.left.initial>b.gate.right.initial?.25:.75):b.x;
   const target=Array.from({length:15},(_,i)=>.08+i*.06).sort((a,c)=>{
    const score=x=>warnings.reduce((sum,w)=>sum+Math.max(0,w.radius+.16-Math.abs(x-w.x))*60,0)
      +close.reduce((sum,e)=>{const visual=.5+(e.x-.5)*(.30+(1-e.z)*.75);return sum+Math.max(0,.20-Math.abs(x-visual))*Math.max(0,.55-e.z)*20},0)
      +Math.abs(x-goal)*.35+Math.abs(x-b.x)*.08;
    return score(a)-score(c);
   })[0];
   moveBattle(b,Math.max(-1,Math.min(1,(target-b.x)*25)),.05);
  }
  if(position!==null)moveBattle(b,0,.05);
  stepBattle(b,.05);
 }
 return b;
}
test('30 关在适度成长和受限移速下，主动选择与躲避可以通关',()=>{
 for(let level=1;level<=30;level++){
  let wins=0;for(let seed=1;seed<=5;seed++){const battle=simulate(level,level*100+seed);if(battle.status==='won'){wins++;if(level===30&&seed===5)assert.ok(battle.time<=95,`level 30 route took ${battle.time.toFixed(1)} s`)}}
  assert.ok(wins>=4,`level ${level}: ${wins}/5 wins`);
 }
});
test('无需科技升级，主动移动仍能完成主线各关的多种随机布局',()=>{
 for(let level=1;level<=30;level++){
  let wins=0;for(let seed=1;seed<=5;seed++)if(simulate(level,level*100+seed,{tech:0}).status==='won')wins++;
  assert.ok(wins>=4,`level ${level} without upgrades: ${wins}/5 wins`);
 }
});
test('后期各站桩位置存在失败风险，主动移动使用同科技同种子可显著改善',()=>{
 const level=30,seeds=Array.from({length:30},(_,i)=>3001+i);
 const active=seeds.filter(seed=>simulate(level,seed).status==='won').length;
 assert.ok(active>=26,`active controller wins ${active}/30`);
 for(const position of [.08,.25,.5,.72,.92]){
  const idle=seeds.filter(seed=>simulate(level,seed,{position}).status==='won').length;
  assert.ok(idle<=27,`idle at ${position}: ${idle}/30 wins`);
  if(position===.5)assert.ok(idle<=20,`stationary center: ${idle}/30 wins`);
  assert.ok(active-idle>=3,`idle ${idle}/30 vs active ${active}/30 at ${position}`);
 }
});
