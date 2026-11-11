(function(){
  'use strict';
  var ipc=require('electron').ipcRenderer;
  var $=function(id){return document.getElementById(id)};
  var running=false,score=0,combo=0,bestCombo=0,critical=0,hits=0,left=30,timer=null,kind='normal',pendingResult=null,saving=false;
  var base='../assets/v1a/muyu/';
  var kinds={
    normal:{label:'普通木鱼',points:1,alt:'普通木鱼'},
    gold:{label:'黄金木鱼',points:50,alt:'黄金木鱼'},
    boss:{label:'老板木鱼',points:0,alt:'老板木鱼'}
  };
  function setKind(next){kind=next;$('kindLabel').textContent=kinds[next].label;$('muyu').alt=kinds[next].alt;$('muyu').src=base+'muyu_'+next+'_idle.png'}
  function render(){$('score').textContent=score;$('combo').textContent=combo;$('critical').textContent=critical;$('timer').textContent='00:'+String(left).padStart(2,'0')}
  function chooseKind(){var r=Math.random();setKind(r<.08?'gold':r<.16?'boss':'normal')}
  function hit(){
    if(!running)return;
    hits+=1;
    var points=kinds[kind].points;
    if(kind==='boss'){combo=Math.max(0,combo-10);points=0}else{combo+=1;bestCombo=Math.max(bestCombo,combo);if(combo%10===0){points+=5;critical+=1}}
    score+=points;$('gain').textContent=kind==='boss'?'Combo -10':'+'+points;$('gain').classList.remove('show');void $('gain').offsetWidth;$('gain').classList.add('show');
    $('muyu').src=base+'muyu_'+kind+'_pressed.png';$('muyuButton').classList.add('strike');
    setTimeout(function(){$('muyu').src=base+'muyu_'+kind+'_rebound.png';$('muyuButton').classList.remove('strike')},85);
    setTimeout(chooseKind,170);render();
  }
  async function saveResult(){
    if(!pendingResult||saving)return;
    saving=true;$('retrySave').disabled=true;$('saveError').hidden=true;$('reward').textContent='结算中';
    var data;try{data=await ipc.invoke('muyu-finish',pendingResult)}catch(_){data={ok:false}}
    saving=false;
    if(!data||!data.ok){$('reward').textContent='--';$('saveError').hidden=false;$('retrySave').hidden=false;$('retrySave').disabled=false;return}
    $('reward').textContent=data.reward;$('wallet').textContent=data.fishCoins;$('retrySave').hidden=true;$('again').disabled=false;pendingResult=null;
  }
  function finish(){if(!running)return;running=false;clearInterval(timer);$('muyuButton').disabled=true;$('start').hidden=true;$('hint').hidden=true;$('resultScore').textContent=score;$('resultCombo').textContent=bestCombo;$('resultCritical').textContent=critical;$('result').hidden=false;$('again').disabled=true;pendingResult={id:require('crypto').randomUUID(),result:{score:score,combo:bestCombo,critical:critical,hits:hits}};saveResult()}
  function start(){if(saving||pendingResult)return;clearInterval(timer);running=true;score=0;combo=0;bestCombo=0;critical=0;hits=0;left=30;$('result').hidden=true;$('saveError').hidden=true;$('retrySave').hidden=true;$('start').hidden=true;$('hint').hidden=false;$('muyuButton').disabled=false;setKind('normal');render();timer=setInterval(function(){left-=1;render();if(left<=0)finish()},1000)}
  $('muyuButton').onclick=hit;$('start').onclick=start;$('again').onclick=start;$('retrySave').onclick=saveResult;
  ipc.on('muyu-wallet',function(_e,data){$('wallet').textContent=Number(data&&data.fishCoins)||0;base=data&&data.assetStyle==='simple'?'../assets/skins/simple/batch-b-muyu/':'../assets/v1a/muyu/';setKind(kind)});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')window.close();if((e.key===' '||e.key==='Enter')&&running){e.preventDefault();hit()}});
  render();
})();
