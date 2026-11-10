import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {WEAPONS,createBattle,defaultProgress,equipWeapon,stepBattle} from './defense-core.js';
import {createEffectPlayer,dropSound,shotSound,musicTrack,eventSound} from './defense-audio.js';

function shotWith(id, refinement=0) {
  const p=defaultProgress(); p.refinement[id]=refinement;
  const b=createBattle({seed:42,progress:p});
  b.soldiers=1; b.schedule=[]; b.gateIndex=3; b.modules=[{id,level:1}];
  b.enemies=[{kind:'normal',x:.5,z:.5,hp:1000,maxHp:1000},{kind:'normal',x:.58,z:.51,hp:1000,maxHp:1000}];
  stepBattle(b,.05);
  return b;
}

for (const weapon of WEAPONS) test(`${weapon.name} 可装备、射击并记录使用`,()=>{
  const equipped=equipWeapon([],weapon.id);
  assert.equal(equipped.modules[0].id,weapon.id);
  const b=shotWith(weapon.id);
  assert.ok(b.enemies[0].hp<1000);
  assert.equal(b.weaponStats[weapon.id].shots,1);
  assert.ok(b.events.some(e=>e.type==='shot'&&e.target==='enemy'));
});

test('范围武器伤及邻近目标，冰冻炮施加减速',()=>{
  assert.equal(shotWith('rifle').enemies[1].hp,1000);
  for(const id of ['shotgun','flame','rocket','tesla','plasma','orbital'])
    assert.ok(shotWith(id).enemies[1].hp<1000,id);
  assert.ok(shotWith('ice').enemies[0].slow>0);
});

test('已装备武器的永久精研提高火力，未装备的精研不改变当前火力',()=>{
  let plain=shotWith('rifle'), refined=shotWith('rifle',5);
  assert.ok(refined.enemies[0].hp<plain.enemies[0].hp);
  let p=defaultProgress();p.refinement.laser=5;
  let b=createBattle({seed:42,progress:p});b.soldiers=1;b.schedule=[];b.gateIndex=3;
  b.enemies=[{kind:'normal',x:.5,z:.5,hp:1000,maxHp:1000}];stepBattle(b,.05);
  assert.equal(b.enemies[0].hp,plain.enemies[0].hp);
});

test('掉落品质与射击声音的选择有区分，静音和相同效果节流生效',()=>{
  assert.equal(dropSound(0),null);assert.equal(dropSound(1),'rare_drop');
  assert.equal(dropSound(2),'rare_drop');assert.equal(dropSound(3),'legendary_drop');
  assert.equal(shotSound(['rifle']),'rifle_shot');assert.equal(shotSound(['tesla']),'electric_arc');
  assert.equal(shotSound(['laser']),'laser_fire');
  let now=0, played=[];
  const play=createEffectPlayer(name=>({play(){played.push(name);return Promise.resolve()}}),()=>now);
  assert.equal(play('rifle_shot',false),false);assert.equal(play('rifle_shot',true),true);
  now=100;assert.equal(play('rifle_shot',true),false);
  now=150;assert.equal(play('rifle_shot',true),true);
  assert.deepEqual(played,['rifle_shot','rifle_shot']);
});

test('默认静音，暂停或结算停止战斗音乐，恢复后切回战斗音乐',()=>{
  assert.deepEqual(defaultProgress().audio,{effects:false,music:false});
  assert.equal(musicTrack(null,false),'lobby_loop');
  assert.equal(musicTrack({status:'playing'},false),'battle_loop');
  assert.equal(musicTrack({status:'playing'},true),null);
  assert.equal(musicTrack({status:'won'},false),null);
  assert.equal(musicTrack({status:'failed'},false),null);
  assert.equal(musicTrack(null,false),'lobby_loop');
  let paused=0;const play=createEffectPlayer(()=>({play(){return Promise.resolve()},pause(){paused++}}));
  play('rifle_shot',true);play.stop();assert.equal(paused,1);
});

test('真实战斗事件触发对应声音，静音不播放，重复命中有节流',()=>{
  let now=1000, played=[];
  const play=createEffectPlayer(name=>({play(){played.push(name);return Promise.resolve()}}),()=>now);
  const b=createBattle({seed:12}); b.schedule=[];b.gateIndex=3;b.soldiers=12;
  b.enemies=[{kind:'normal',x:.5,z:.5,hp:10000,maxHp:10000}];
  stepBattle(b,.05);
  const shot=b.events.find(e=>e.type==='shot'&&e.target==='enemy');
  assert.ok(shot);assert.equal(eventSound(shot),'bullet_hit');
  assert.equal(play(eventSound(shot),false),false);
  assert.equal(play(eventSound(shot),true),true);
  assert.equal(play(eventSound(shot),true),false);
  assert.equal(eventSound({type:'boss'}),'boss_warning');
  assert.equal(eventSound({type:'intruder',kind:0}),'boss_warning');
  assert.equal(eventSound({type:'shot',target:'boss'}),'boss_impact');
  now+=400;play(eventSound({type:'shot',target:'boss'}),true);
  assert.deepEqual(played,['bullet_hit','boss_impact']);
});

test('所有音效和音乐资源是可解码、非静音的 PCM 音频',()=>{
  const names=['boss_impact','coin_gain','boss_warning','electric_arc','victory','rare_drop','ui_click',
    'crate_open','ice_burst','legendary_drop','shield','battle_loop','laser_fire','zombie_down',
    'defeat','gate_upgrade','pass_gate','rifle_shot','bullet_hit','lobby_loop','crate_hit','soldier_lost'];
  for(const name of names){
    const data=readFileSync(new URL(`./defense-assets/09_audio/${name}.wav`,import.meta.url));
    assert.equal(data.toString('ascii',0,4),'RIFF',name);
    assert.equal(data.toString('ascii',8,12),'WAVE',name);
    let offset=12,format=false,samples=0,energy=0;
    while(offset+8<=data.length){
      const chunk=data.toString('ascii',offset,offset+4),size=data.readUInt32LE(offset+4),start=offset+8;
      assert.ok(start+size<=data.length,name);
      if(chunk==='fmt '){assert.equal(data.readUInt16LE(start),1,name);assert.equal(data.readUInt16LE(start+14),16,name);format=true}
      if(chunk==='data')for(let i=start;i+1<start+size;i+=2){let n=data.readInt16LE(i);energy+=n*n;samples++}
      offset=start+size+(size%2);
    }
    assert.ok(format&&samples>0&&Math.sqrt(energy/samples)>100,name);
  }
});
