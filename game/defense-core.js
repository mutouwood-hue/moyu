// 《摸鱼防线》纯规则层：所有关卡与随机状态均可序列化，便于离线存档与复现。
export const CHAPTERS=['失守街区','变异实验室','冰封基地','霓虹废城','尸潮核心'];
export const BOSSES=['巨型胖胖僵尸','变异实验体','冰甲巨人','机械改造怪','尸潮核心'];
export const TECH={recruits:{name:'初始兵员',max:10,base:35},damage:{name:'基础伤害',max:10,base:40},speed:{name:'射速',max:10,base:45},breach:{name:'武器箱破拆',max:10,base:40},mobility:{name:'横移机动',max:5,base:50},modules:{name:'武器模块效率',max:10,base:50}};
export const WEAPONS=[
 {id:'rifle',name:'突击步枪',rarity:0,power:1,area:1,control:0}, {id:'smg',name:'冲锋枪',rarity:0,power:1.1,area:1,control:0}, {id:'shotgun',name:'霰弹枪',rarity:0,power:.9,area:1.4,control:0},
 {id:'gatling',name:'加特林',rarity:1,power:1.5,area:1,control:0}, {id:'sniper',name:'狙击枪',rarity:1,power:1.55,area:1,control:.1}, {id:'flame',name:'火焰喷射器',rarity:1,power:1.1,area:1.5,control:.1},
 {id:'rocket',name:'火箭筒',rarity:2,power:1.35,area:1.6,control:.1}, {id:'tesla',name:'特斯拉电枪',rarity:2,power:1.25,area:1.5,control:.2}, {id:'ice',name:'冰冻炮',rarity:2,power:1.05,area:1.4,control:.6},
 {id:'laser',name:'激光炮',rarity:3,power:1.9,area:1.2,control:.1}, {id:'plasma',name:'等离子炮',rarity:3,power:1.5,area:1.55,control:.2}, {id:'orbital',name:'轨道支援器',rarity:3,power:1.4,area:1.65,control:.25}
];
export const ENEMIES={normal:{cost:1,hp:1,speed:1,loss:1},runner:{cost:2,hp:.75,speed:1.5,loss:1},armor:{cost:3,hp:3.1,speed:.75,loss:2},splitter:{cost:3,hp:1.8,speed:.9,loss:1},bomber:{cost:3,hp:1.8,speed:.9,loss:3},summoner:{cost:4,hp:2.8,speed:.65,loss:2}};
export function seeded(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}}
function rand(b){b.rng=(Math.imul(b.rng,1664525)+1013904223)>>>0;return b.rng/4294967296}
export function soldierFirepower(n){return 50*Math.pow(Math.max(0,n)/50,.8)}
export function boxOdds(gain,other){let diff=Math.max(-30,Math.min(30,(other||gain)-gain));return {spawn:Math.max(.22,Math.min(.78,.5+diff*.009)),rare:Math.max(.06,Math.min(.42,.20+diff*.004))}}
export function weaponScore(w,level=1,refine=0){return w.power*(.65+.35*w.area)*(1+w.control*.25)*(1+.22*(level-1))*(1+.08*refine)}
export function equipWeapon(modules,id,refinement={}){let w=WEAPONS.find(x=>x.id===id);if(!w)throw Error('unknown weapon');let out=modules.map(x=>typeof x==='string'?{id:x,level:1}:{...x});let duplicate=out.find(x=>x.id===id);if(duplicate){duplicate.level++;return {modules:out,replaced:null,upgraded:true}}if(out.length<4){out.push({id,level:1});return {modules:out,replaced:null}}let scores=out.map(x=>weaponScore(WEAPONS.find(w=>w.id===x.id),x.level,refinement[x.id]||0));let ix=scores.indexOf(Math.min(...scores));if(weaponScore(w,1,refinement[id]||0)<=scores[ix])return {modules:out,replaced:null,bonus:true};let replaced=out[ix].id;out[ix]={id,level:1};return {modules:out,replaced}}
export function rollWeapon(odds,random=Math.random){let r=random(), rare=odds.rare;let rarity=r<rare*.12?3:r<rare*.42?2:r<rare?1:0;let pool=WEAPONS.filter(w=>w.rarity===rarity);return pool[Math.min(pool.length-1,Math.floor(random()*pool.length))]}
export function levelSpec(level,seed=level){
 if(!Number.isInteger(level)||level<1||level>30)throw RangeError('level');
 let random=seeded(seed),chapter=Math.floor((level-1)/6),stage=(level-1)%6,budget=110+chapter*38+stage*9;
 // Special encounters replace ordinary spawns, and their combined cost is
 // capped at 30% of the fixed level budget (never added on top of it).
 const specialLimit=Math.floor(budget*.30);
 let intruderSlot=chapter>=2&&random()<.65,specialSpent=intruderSlot?22:0,remaining=budget-(stage===5?0:8)-specialSpent;
 let enemies=stage===5?[]:[{kind:'armor',lane:.5,at:47,cost:8,elite:true}];
 if(intruderSlot)enemies.push({kind:'armor',lane:.18+random()*.64,at:24+random()*12,cost:22,elite:true,intruderSlot:true});
 let available=Object.keys(ENEMIES).slice(0,Math.min(6,2+chapter));
 while(remaining>0){
  let giant=chapter>=2&&remaining>=10&&specialSpent+10<=specialLimit&&random()<.07,options=available.filter(k=>ENEMIES[k].cost<=remaining);
  let kind=giant?'normal':options[Math.floor(random()*options.length)],cost=giant?10:ENEMIES[kind].cost;
  remaining-=cost;if(giant)specialSpent+=cost;let laneRandom=random()*2-1;
  enemies.push({kind,giant,lane:.5+.21*(laneRandom+Math.sin(laneRandom*Math.PI/2)),at:5+random()*45,cost});
 }
 enemies.sort((a,b)=>a.at-b.at);return {level,chapter,budget,boss:stage===5?BOSSES[chapter]:null,enemies};
}
export function upgradeCost(base,level){return Math.round(base*Math.pow(1.45,level))}
export function defaultProgress(){return {version:2,unlockedLevel:1,supply:0,tech:Object.fromEntries(Object.keys(TECH).map(k=>[k,0])),collected:['rifle'],refinement:{},stats:{},cleared:[],achievements:[],endless:null,records:{wave:0,kills:0,soldiers:0},audio:{effects:false,music:false}}}
export function normalizeProgress(value){let p=defaultProgress(),v=value&&typeof value==='object'?value:{};p.unlockedLevel=Math.max(1,Math.min(30,Math.floor(Number(v.unlockedLevel)||1)));p.supply=Math.max(0,Math.floor(Number(v.supply)||0));for(let k of Object.keys(TECH))p.tech[k]=Math.max(0,Math.min(TECH[k].max,Math.floor(Number(v.tech?.[k])||0)));p.collected=[...new Set(['rifle',...(Array.isArray(v.collected)?v.collected:[])].filter(id=>WEAPONS.some(w=>w.id===id)))];for(let id of p.collected)p.refinement[id]=Math.max(0,Math.min(5,Math.floor(Number(v.refinement?.[id])||0)));p.cleared=Array.isArray(v.cleared)?[...new Set(v.cleared.filter(n=>Number.isInteger(n)&&n>=1&&n<=30))]:[];p.achievements=Array.isArray(v.achievements)?v.achievements.filter(x=>typeof x==='string'):[];p.stats=v.stats&&typeof v.stats==='object'?JSON.parse(JSON.stringify(v.stats)):{};p.records={...p.records,...v.records};p.audio={effects:!!v.audio?.effects,music:!!v.audio?.music};if(v.endless&&Number.isInteger(v.endless.wave)&&v.endless.wave>0&&v.endless.wave%5===0&&v.endless.battle)p.endless=v.endless;return p}
export function buyUpgrade(progress,kind,id){let p=normalizeProgress(progress),level,cost;if(kind==='tech'&&TECH[id]){level=p.tech[id];cost=upgradeCost(TECH[id].base,level);if(level>=TECH[id].max||p.supply<cost)return {ok:false,progress:p};p.supply-=cost;p.tech[id]++;return {ok:true,progress:p,cost}}if(kind==='refinement'&&p.collected.includes(id)){level=p.refinement[id]||0;cost=upgradeCost(65,level);if(level>=5||p.supply<cost)return {ok:false,progress:p};p.supply-=cost;p.refinement[id]=level+1;return {ok:true,progress:p,cost}}return {ok:false,progress:p}}
export function createBattle({level=1,seed=Date.now(),progress=defaultProgress(),endless=false,wave=1,carry=null}={}){
 const p=normalizeProgress(progress);p.endless=null;const effective=endless?Math.min(30,Math.max(1,Math.ceil(wave*.7))):level,spec=levelSpec(effective,seed),boss=endless?(wave%10===0?BOSSES[Math.floor(wave/10-1)%5]:null):spec.boss;
 const priorBosses=BOSSES.map((_,i)=>i).filter(i=>i<spec.chapter&&p.cleared.includes((i+1)*6));
 const slot=spec.enemies.find(e=>e.intruderSlot);
 if(slot&&priorBosses.length){const choose=seeded((seed^0x6d2b79f5)>>>0),index=priorBosses[Math.floor(choose()*priorBosses.length)];slot.intruderBoss=index;slot.bossName=BOSSES[index]}
 if(endless&&wave>40){let extra=Math.min(300,Math.floor((wave-40)*1.5)),base=spec.enemies.filter(e=>!e.giant&&!e.intruderSlot);for(let i=0;i<extra;i++){let e=base[i%base.length];spec.enemies.push({...e,at:5+((e.at+i*3)%45)})}spec.enemies.sort((a,b)=>a.at-b.at)}
 return {version:2,level,effective,endless,wave,waveScale:endless?Math.pow(1.025,Math.max(0,wave-40)):1,time:0,fishActiveSeconds:carry?.fishActiveSeconds??0,status:'playing',phase:'road',x:.5,soldiers:carry?.soldiers??(12+p.tech.recruits*2),modules:carry?.modules?carry.modules.map(m=>({...m})):[{id:'rifle',level:1}],temporary:carry?.temporary??0,kills:carry?.kills??0,weaponStats:carry?.weaponStats?JSON.parse(JSON.stringify(carry.weaponStats)):{},earned:carry?.earned??0,rng:carry?.rng??(seed>>>0),seed,spawn:0,enemies:[],schedule:spec.enemies,gate:null,gateIndex:0,box:null,bossName:boss,boss:null,warnings:[],fireClock:0,skillClocks:carry?.skillClocks?{...carry.skillClocks}:{rocket:0,shield:0,airstrike:0,ice:0,lightning:0,focus:0},events:[],progress:p};
}
function clampFormationX(b,x){const columns=formationColumns(b.soldiers),half=((columns-1)*8+17.5)/400,edge=Math.max(.08,half-.1);return Math.max(edge,Math.min(1-edge,x))}
export function moveBattle(b,direction,dt){if(b.status==='playing')b.x=clampFormationX(b,b.x+Math.max(-1,Math.min(1,direction))*dt*(1.25+b.progress.tech.mobility*.08)*(b.frozen>0?.55:1))}
export function setPosition(b,x){if(b.status==='playing')b.x=clampFormationX(b,x)}
function event(b,type,details={}){b.events.push({type,...details});if(b.events.length>160)b.events.shift()}
function makeGate(b){
 let low=7+Math.floor(rand(b)*4)+Math.floor(b.effective*.35),high=low+3+Math.floor(rand(b)*5)+Math.floor(b.effective*.35),flip=rand(b)<.5;
 let gains=flip?[high,low]:[low,high];let sides=gains.map(gain=>{let multiply=rand(b)<.35;let value=multiply?Math.round((1+gain/Math.max(1,b.soldiers))*100)/100:gain;return {type:multiply?'multiply':'add',value,initial:gain}});
 sides[0].odds=boxOdds(sides[0].initial,sides[1].initial);sides[1].odds=boxOdds(sides[1].initial,sides[0].initial);
 return {z:.98,left:sides[0],right:sides[1],charge:0};
}
function damageEnemy(b,e,power){e.hp-=power;if(e.hp<=0&&!e.dead){e.dead=true;b.kills++;for(let m of b.modules){let st=b.weaponStats[m.id]??={shots:0,kills:0,highest:1};st.kills++;}event(b,'kill',{kind:e.kind});if(e.kind==='splitter'&&!e.child){for(let i=0;i<2;i++)b.enemies.push({kind:'normal',x:Math.max(.06,Math.min(.94,e.x+(i?1:-1)*.04)),z:e.z,hp:e.maxHp*.3,maxHp:e.maxHp*.3,child:true})}}}
function formationHalfWidth(b){let cols=formationColumns(b.soldiers);return Math.min(.19,((cols-1)*16/2+10)/400)}
function formationFrontZ(b){let rows=Math.ceil(Math.min(100,Math.max(1,b.soldiers))/formationColumns(b.soldiers));let frontY=533-(rows-1)*9-42;return Math.max(.05,Math.min(.28,1-(frontY-130)/380))}
function warningOverlap(b,w){let half=formationHalfWidth(b),left=Math.max(b.x-half,w.x-w.radius),right=Math.min(b.x+half,w.x+w.radius);return Math.max(0,right-left)/(2*half)}
function lose(b,n){let before=b.soldiers;b.soldiers=Math.max(0,b.soldiers-Math.max(1,Math.ceil(n)));event(b,'loss',{amount:before-b.soldiers});if(b.soldiers<=0){b.status='failed';event(b,'failed')}}
export function formationColumns(soldiers){return Math.min(10,Math.max(1,Math.ceil(Math.sqrt(Math.max(0,soldiers))*1.2)),Math.max(1,Math.floor(soldiers)))}
function shoot(b){
 for(const m of b.modules){const st=b.weaponStats[m.id]??={shots:0,kills:0,highest:1};st.shots++;st.highest=Math.max(st.highest,m.level)}
 const total=b.modules.reduce((sum,m)=>{const w=WEAPONS.find(x=>x.id===m.id);return sum+weaponScore(w,m.level,b.progress.refinement[m.id]||0)},0);
 const columns=formationColumns(b.soldiers),power=soldierFirepower(b.soldiers)*.084*(1+b.progress.tech.damage*.08)*(1+b.progress.tech.modules*.05)*(1+b.temporary*.03)*total/columns;
 const ids=b.modules.map(m=>m.id),selected=b.x<.5?'left':'right';
 for(let col=0;col<columns;col++){
  const fromX=b.x+(col-(columns-1)/2)*16/400;
  if(b.box&&Math.abs(fromX-b.box.x)<.10){
   const box=b.box;box.hp-=power*(1+b.progress.tech.breach*.1);event(b,'shot',{target:'box',col,fromX,x:box.x,z:box.z});
   if(box.hp<=0){const weapon=rollWeapon(box.odds,()=>rand(b)),result=equipWeapon(b.modules,weapon.id,b.progress.refinement);b.modules=result.modules;if(result.bonus)b.temporary++;if(!b.progress.collected.includes(weapon.id))b.progress.collected.push(weapon.id);event(b,'weapon',{id:weapon.id,replaced:result.replaced,bonus:result.bonus});b.box=null}
   continue;
  }
  const target=b.enemies.filter(e=>!e.dead&&e.z<.92&&e.z>.1&&Math.abs(e.x-fromX)<.12+(e.giant?.06:Number.isInteger(e.intruderBoss)?.10:0)).sort((a,c)=>a.z-c.z)[0];
  if(target){
   damageEnemy(b,target,power);
   if(ids.some(id=>['shotgun','flame','rocket','tesla','plasma','orbital'].includes(id))){const radius=ids.includes('rocket')||ids.includes('orbital')?.17:.10;const others=b.enemies.filter(e=>e!==target&&!e.dead&&Math.abs(e.x-target.x)<radius&&Math.abs(e.z-target.z)<.10).slice(0,ids.includes('tesla')?6:4);for(const e of others)damageEnemy(b,e,power*.28)}
   if(ids.includes('ice'))target.slow=1.4;event(b,'shot',{target:'enemy',col,fromX,x:target.x,z:target.z});continue;
  }
  if(b.gate&&b.gate.z<.9&&(fromX<.5?'left':'right')===selected){
   const side=b.gate[selected];b.gate.charge+=power;while(b.gate.charge>=45){b.gate.charge-=45;if(side.type==='multiply')side.value=Math.round((side.value+.05)*100)/100;else side.value++;event(b,'gateUpgrade',{side:selected})}
   event(b,'shot',{target:'gate',col,fromX,x:fromX,z:b.gate.z});continue;
  }
  if(b.boss&&Math.abs(fromX-.5)<.42){b.boss.hp-=power;event(b,'shot',{target:'boss',col,fromX,x:fromX,z:.6});continue}
  event(b,'shot',{target:'air',col,fromX,x:fromX,z:.95});
 }
}
function autoSkills(b,dt){for(let k in b.skillClocks)b.skillClocks[k]-=dt;let close=b.enemies.filter(e=>!e.dead&&e.z<.55),fast=close.filter(e=>e.kind==='runner');function trigger(key,cool,targets,damage){if(b.skillClocks[key]<=0&&targets.length){b.skillClocks[key]=cool;targets.forEach(e=>damageEnemy(b,e,damage));event(b,'skill',{name:key})}}trigger('rocket',13,close.length>=6?close.slice(0,8):[],5);trigger('airstrike',22,close.length>=12?close.slice(0,18):[],6);trigger('ice',14,fast.length>=2?fast:[],3);trigger('lightning',12,close.length>=4?close.slice(0,5):[],4);if(b.skillClocks.focus<=0&&b.boss){b.skillClocks.focus=10;b.boss.hp-=12;event(b,'skill',{name:'focus'})}if(b.skillClocks.shield<=0&&b.warnings.some(w=>w.time<.6&&warningOverlap(b,w)>0)){b.skillClocks.shield=20;b.shield=2;event(b,'skill',{name:'shield'})}}
// Each boss alternates two telegraphed attacks; warnings carry their actual
// damage geometry so the renderer and collision calculation share one source.
function bossAttack(b){
 const boss=b.boss,kind=BOSSES.indexOf(boss.name),turn=boss.attackIndex++,target=Math.max(.22,Math.min(.78,b.x)),damage=5+Math.floor(b.effective/8);
 const add=(attack,x,radius,time=1.5,extra={})=>b.warnings.push({x,radius,time,damage,kind,attack,...extra});
 const summon=(count)=>{for(let i=0;i<count;i++){let hp=6+b.effective*.4;b.enemies.push({kind:'runner',x:i%2?.25:.75,z:.85,hp,maxHp:hp,attack:0})}};
 let attack;
 if(kind===0){attack=turn%2?'slam':'charge';add(attack,turn%2?target:(turn%4===0?.7:.3),.20)}
 else if(kind===1){attack=turn%2?'summon':'poison';add(attack,target,turn%2?.16:.19);if(turn%2)summon(2)}
 else if(kind===2){attack=turn%2?'icicle':'freeze';add(attack,turn%2?(turn%4===1?.3:.7):target,turn%2?.16:.20,1.5,{freeze:attack==='freeze'})}
 else if(kind===3){attack=turn%2?'bomb':'laser';add(attack,turn%2?target:(turn%4===0?.3:.7),turn%2?.20:.13)}
 else {let enraged=boss.hp<boss.maxHp*.5;attack=enraged?'core_burst':'core';add(attack,target,.18);if(enraged)add(attack,target<.5?.78:.22,.14,2.1);if(turn%2===0)summon(enraged?2:1)}
 event(b,'warning',{kind,attack});
}
export function stepBattle(b,dt){if(b.status!=='playing')return b;if(b.soldiers<=0){b.soldiers=0;b.status='failed';event(b,'failed');return b}dt=Math.max(0,Math.min(.05,Number(dt)||0));b.time+=dt;b.frozen=Math.max(0,(b.frozen||0)-dt);b.shield=Math.max(0,(b.shield||0)-dt);let road=b.phase==='road';if(road){while(b.spawn<b.schedule.length&&b.schedule[b.spawn].at<=b.time){let e=b.schedule[b.spawn++],def=ENEMIES[e.kind],chapterScale=1+Math.floor((b.effective-1)/6)*.75,hp=(4+b.effective*.42)*def.hp*b.waveScale*chapterScale*(e.giant?10:e.intruderSlot?12/def.hp:e.elite?2.5:1);b.enemies.push({kind:e.kind,x:e.lane,z:1,hp,maxHp:hp,attack:0,elite:!!e.elite,giant:!!e.giant,intruderSlot:!!e.intruderSlot,intruderBoss:e.intruderBoss,bossName:e.bossName});if(Number.isInteger(e.intruderBoss))event(b,'intruder',{kind:e.intruderBoss,bossName:e.bossName})}if(!b.gate&&!b.box&&b.gateIndex<3&&b.time>=3+b.gateIndex*17){b.gate=makeGate(b);b.gateIndex++}if(b.gate){b.gate.z-=dt*.15;if(b.gate.z<=.12){let g=b.gate[b.x<.5?'left':'right'];let gain=g.type==='multiply'?Math.max(1,Math.floor(b.soldiers*(g.value-1))):g.value;b.soldiers+=gain;event(b,'gate',{gain});if(rand(b)<g.odds.spawn)b.box={x:b.x,z:.88,hp:12+b.effective*.35,odds:g.odds};b.gate=null}}if(b.box){b.box.z-=dt*.14;if(b.box.z<=.12){event(b,'boxMiss');b.box=null}}if(b.endless&&b.wave%5===0&&b.time>=40&&!b.eliteSpawned){b.eliteSpawned=true;let hp=(40+b.effective*3)*b.waveScale;b.enemies.push({kind:'armor',x:.5,z:1,hp,maxHp:hp,elite:true,attack:0});event(b,'elite')}}
 for(let i=0;i<b.enemies.length;i++){let e=b.enemies[i];if(e.dead)continue;let def=ENEMIES[e.kind];e.slow=Math.max(0,(e.slow||0)-dt);e.z-=dt*.095*def.speed*(e.slow>0?.55:1);if(e.z<.55&&Math.abs(e.x-b.x)<.30){const drift=dt*.04;e.x+=Math.max(-drift,Math.min(drift,b.x-e.x))}if((e.kind==='bomber'||e.elite)&&e.z<.34&&!e.attack){e.attack=1;let intruder=Number.isInteger(e.intruderBoss),attack=intruder?'intruder':undefined;b.warnings.push({x:e.x,time:intruder?1.5:1.3,radius:intruder?.2:.16,damage:e.intruderSlot?8:4,attack,kind:e.intruderBoss});event(b,'warning',{attack,kind:e.intruderBoss})}if(e.kind==='summoner'&&e.z<.55&&!e.attack){e.attack=1;b.enemies.push({kind:'normal',x:Math.min(.95,e.x+.07),z:e.z+.03,hp:e.maxHp*.3,maxHp:e.maxHp*.3,child:true})}if(e.z<=formationFrontZ(b)){e.dead=true;let visualX=.5+(e.x-.5)*(.30+(1-e.z)*.75);if(Math.abs(visualX-b.x)<formationHalfWidth(b)+(e.giant?.095:Number.isInteger(e.intruderBoss)?.14:.045))lose(b,def.loss*(e.giant?10:1));if(b.status!=='playing')return b}}
 for(let w of b.warnings){w.time-=dt;if(w.time<=0&&warningOverlap(b,w)>0&&!b.shield){lose(b,w.damage*warningOverlap(b,w));if(w.freeze)b.frozen=2;}if(b.status!=='playing')return b}b.warnings=b.warnings.filter(w=>w.time>0);b.enemies=b.enemies.filter(e=>!e.dead);
 if(road&&b.time>=62&&!b.enemies.length&&b.spawn>=b.schedule.length&&!b.gate&&!b.box){if(b.bossName){b.phase='boss';b.roadTime=b.time;const hp=(210+b.effective*3)*b.waveScale;b.boss={name:b.bossName,hp,maxHp:hp,clock:1,attackIndex:0};event(b,'boss')}else{b.status='won';event(b,'won')}}
 if(b.boss){b.boss.clock-=dt;if(b.boss.clock<=0){b.boss.clock=3.8;bossAttack(b)}if(b.boss.hp<=0){b.boss=null;b.status='won';event(b,'won')}}
 if(b.status!=='playing')return b;b.fireClock-=dt;if(b.fireClock<=0){b.fireClock=.12/(1+b.progress.tech.speed*.06);shoot(b)}autoSkills(b,dt);return b}
export function settleBattle(progress,b){let p=normalizeProgress(progress),reward=Math.floor(b.kills*.35)+(b.status==='won'?35:8),first=b.status==='won'&&!b.endless&&!p.cleared.includes(b.level);if(first){reward+=50+(b.level%6===0?50:0);p.cleared.push(b.level);p.unlockedLevel=Math.max(p.unlockedLevel,Math.min(30,b.level+1))}for(let [id,condition,bonus] of [['first',p.cleared.length>=1,25],['boss1',p.cleared.includes(6),60],['all',p.cleared.length>=30,250],['collector',b.progress.collected.length>=12,120]]){if(condition&&!p.achievements.includes(id)){p.achievements.push(id);reward+=bonus}}p.supply+=reward;for(let [id,st] of Object.entries(b.weaponStats||{})){let old=p.stats[id]||{shots:0,kills:0,highest:0};p.stats[id]={shots:old.shots+st.shots,kills:old.kills+st.kills,highest:Math.max(old.highest,st.highest)}}for(let id of b.progress.collected)if(!p.collected.includes(id))p.collected.push(id);if(b.endless){p.records.wave=Math.max(p.records.wave,b.wave);p.records.kills=Math.max(p.records.kills,b.kills);p.records.soldiers=Math.max(p.records.soldiers,b.soldiers);p.endless=null}return {progress:p,reward,first}}
export function checkpoint(b){if(!b.endless||b.status!=='won'||b.wave%5!==0)throw Error('invalid checkpoint');let carry={fishActiveSeconds:b.fishActiveSeconds||0,soldiers:b.soldiers,modules:b.modules,temporary:b.temporary,kills:b.kills,weaponStats:b.weaponStats,skillClocks:b.skillClocks,earned:b.earned+Math.floor(b.kills*.1),rng:b.rng};let next=createBattle({level:30,seed:b.rng,progress:b.progress,endless:true,wave:b.wave+1,carry});return {wave:b.wave,battle:next}}

// A resumed battle must never share mutable objects with its saved checkpoint.
export function restoreBattle(snapshot){return JSON.parse(JSON.stringify(snapshot));}
