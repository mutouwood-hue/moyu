(function(){
  'use strict';
  var ipc=require('electron').ipcRenderer;
  var $=function(id){return document.getElementById(id)};
  var running=false,score=0,combo=0,bestCombo=0,critical=0,hits=0,left=30,timer=null,kind='normal',lockedResult=false;
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
  function finish(){if(!running)return;running=false;clearInterval(timer);$('muyuButton').disabled=true;$('start').hidden=true;$('hint').hidden=true;$('resultScore').textContent=score;$('resultCombo').textContent=bestCombo;$('resultCritical').textContent=critical;$('reward').textContent='结算中';$('result').hidden=false;lockedResult=true;ipc.send('muyu-finish',{score:score,combo:bestCombo,critical:critical,hits:hits})}
  function start(){clearInterval(timer);running=true;lockedResult=false;score=0;combo=0;bestCombo=0;critical=0;hits=0;left=30;$('result').hidden=true;$('start').hidden=true;$('hint').hidden=false;$('muyuButton').disabled=false;setKind('normal');render();timer=setInterval(function(){left-=1;render();if(left<=0)finish()},1000)}
  $('muyuButton').onclick=hit;$('start').onclick=start;$('again').onclick=start;
  ipc.on('muyu-wallet',function(_e,data){$('wallet').textContent=Number(data&&data.fishCoins)||0;base=data&&data.assetStyle==='simple'?'../assets/skins/simple/batch-b-muyu/':'../assets/v1a/muyu/';setKind(kind)});
  ipc.on('muyu-result',function(_e,data){if(!lockedResult)return;$('reward').textContent=data.reward;$('wallet').textContent=data.fishCoins});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')window.close();if((e.key===' '||e.key==='Enter')&&running){e.preventDefault();hit()}});
  render();
})();
