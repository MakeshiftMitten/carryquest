import {random,makeMap,worldProblem,COLORS,PALETTE,seconds,allowance,levelScore,tuneLevel,operationScore} from "./world.js";
import {applyAction,expectedStep,placeName,startProblem} from "./math-engine.js";
import {uid,createTelemetryStore,localGlobalMetricsProvider} from "./telemetry-store.js";

const RELICS=[
  {id:"snack",icon:"🍎",name:"Quick snack",copy:"+1 life (max 3)."},
  {id:"pegacorn",icon:"🪽",name:"Pegacorn",copy:"Next row: reach two lanes."},
  {id:"jumpstart",icon:"⚡",name:"Jumpstart",copy:"Start +1 question (max +3)."},
  {id:"hard",icon:"▲",name:"Hard Road",copy:"Remaining map difficulties +5."},
  {id:"easy",icon:"▼",name:"Easy Road",copy:"Future difficulties −5 (minimum 0)."}
];
const SEED=0xc0ffee,root=document.querySelector("#app");
const clock=()=>globalThis.performance?.now()??0;
const freshSeed=()=>crypto.getRandomValues(new Uint32Array(1))[0];
let mode=1,endless=false;
const newRun=(seed=SEED)=>({id:uid("run"),seed,mode,endless,roads:[],room:1,hp:3,maxHp:3,reach:1,jump:0,horn:[],score:0,perks:{}});

const telemetry=createTelemetryStore();
if(!telemetry.data.activeUserId)telemetry.addUser("Player 1");
const globalProvider=globalThis.carryQuestGlobalMetricsProvider??localGlobalMetricsProvider(telemetry);
let run=newRun(),work=null,mistakes=0,feedback="Start on the right.",tone="neutral",shake=false,locked=false,overlay=null,insights=false,insightScope="lifetime",globalMetrics=telemetry.summaryGlobal(),globalLoading=false;
let startedAt=clock(),stepStartedAt=startedAt,runFinished=false,deadline=0,problemDeadline=Infinity,pausedAt=0,attempt=0;
let screen="start",worlds=makeMap(run.seed,0,run.mode),node=null,problemIndex=0,pathTaken=[],audioContext,muted=false,perkInfo=null,offered=[];
const isBoss=()=>!run.endless&&run.room>10;
const questionCount=()=>node.questions;
const stepSeconds=()=>seconds(node.speed)+(work.problem.operation==="×"?2:0);

function record(row){
  telemetry.record(run.id,row);
}

function finishRun(status){
  if(runFinished||screen==="start")return;
  runFinished=true;telemetry.finishRun(run.id,{status,score:run.score});
}

const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const activeUser=()=>telemetry.data.users.find(user=>user.id===telemetry.data.activeUserId);

function promptFor(state){
  const expected=expectedStep(state);
  if(!expected)return "PROBLEM CLEARED";
  if(expected.kind==="digit")return expected.reason==="leading"?"ENTER FINAL CARRY":`${placeName(expected.column,state.problem.width).toUpperCase()} · ENTER RESULT`;
  if(expected.reason==="carry")return "CARRY · SWIPE ↑ / ↓";
  return expected.reason==="borrow-give"?"BORROW · SWIPE ↓":"BORROW · SWIPE ↑";
}

const hearts=()=>'<span class="hearts" aria-label="'+run.hp+' lives">'+Array.from({length:run.maxHp},(_,index)=>`<span class="${index<run.hp?"full":""}">♥</span>`).join("")+'<small>'+run.hp+'/3</small></span>';
function statusBar(){return '<div class="run-status">'+hearts()+'<div class="owned-perks">'+RELICS.filter(r=>run.perks[r.id]).map(r=>'<button data-owned="'+r.id+'" aria-label="'+r.name+'">'+r.icon+'<small>'+run.perks[r.id]+'</small></button>').join('')+'</div></div>'+(perkInfo?'<small class="perk-note">'+perkInfo.name+': '+perkInfo.copy+'</small>':'');}

function board(){
  const expected=expectedStep(work),target=expected?.kind==="digit"?(expected.column<0?0:expected.column+1):-1;
  const top=work.top.map((value,column)=>{
    const borrowed=value>=10,shown=borrowed?value-10:value,active=expected?.kind==="swipe"&&expected.column===column;
    return `<button class="operand ${active?"gesture-target":""}" data-column="${column}" aria-label="Digit ${shown}; flick up or down">${work.carries[column]||active&&work.phase==='carry'?`<span class="carry-mark">${active&&work.phase==='carry'?work.carryDial:work.carries[column]}</span>`:""}${value!==work.originalTop[column]&&!borrowed?`<span class="old-value">${work.originalTop[column]}</span>`:""}${borrowed?'<sup class="borrow-mark">1</sup>':""}<span>${shown}</span>${active?"<i>↕</i>":""}</button>`;
  }).join("");
  const lower=work.bottom.map((digit,i)=>`<span class="lower-digit">${work.problem.operation==="×"&&i<work.problem.width-1?"":digit}</span>`).join("");
  const answer=work.answer.map((digit,index)=>`<span class="answer ${target===index?"answer-target":""}">${digit??""}</span>`).join("");
  return `<section class="board ${shake?"shake":""}" aria-label="Arithmetic problem">
    <div class="math-stack" style="--count:${work.problem.width+1}">
      <div class="digit-row top-row"><button class="operand ${work.phase==='carry'&&expected.column===-1?'gesture-target':''}" data-column="-1" aria-label="Final carry"><span class="carry-mark">${work.phase==='carry'&&expected.column===-1?work.carryDial:work.leadingCarry??''}</span>${work.phase==='carry'&&expected.column===-1?'↕':''}</button>${top}</div>
      <div class="digit-row"><b class="operator">${work.problem.operation}</b><span></span>${lower}</div>
      <div class="sum-line"></div><div class="digit-row">${answer}</div>
    </div>
    <div class="swipe-buttons">${['up','down'].map((direction,i)=>'<button data-swipe="'+direction+'" aria-label="Swipe '+direction+'" '+(locked||expected?.kind!=='swipe'?'disabled':'')+'>'+(i?'↓':'↑')+'</button>').join('')}</div>
  </section>`;
}

function chime(good){
  if(muted)return;
  try{audioContext??=new AudioContext();audioContext.resume().catch(()=>{});
    (good?[523,659,784]:[294,233,147]).forEach((frequency,index)=>{const t=audioContext.currentTime+index*.075,o=audioContext.createOscillator(),g=audioContext.createGain();o.type="square";o.frequency.value=frequency;g.gain.setValueAtTime(.035,t);g.gain.exponentialRampToValueAtTime(.001,t+.12);o.connect(g);g.connect(audioContext.destination);o.start(t);o.stop(t+.13);});
  }catch{}
}
const reachable=n=>n.stage===run.room-1&&(!pathTaken.length||Math.abs(n.lane-pathTaken.at(-1))<=run.reach);
function selectWorld(lane){
  if(screen!=='map'||overlay||insights||isBoss())return;
  const chosen=worlds[(run.room-1)%10][lane];if(chosen&&reachable(chosen)){node=chosen;overlay='briefing';render();}
}
function horn(){return '<div class="horn" aria-label="Horn: '+run.horn.length+' of 7 colors">'+COLORS.map((name,i)=>'<i style="width:'+(14+i*10)+'px;background:'+PALETTE[i]+';opacity:'+(run.horn.includes(i)?1:.3)+'" title="'+name+(run.horn.includes(i)?' collected':' missing')+'"></i>').join('')+'</div>';}
function overworld(){
  let lines="";
  for(let row=0;row<worlds.length-1;row++)for(const n of worlds[row])for(const next of worlds[row+1])if(Math.abs(n.lane-next.lane)<=1)lines+='<line x1="'+n.x+'" y1="'+n.y+'" x2="'+next.x+'" y2="'+next.y+'"/>';
  return '<section class="route"><div class="horn-heading">'+horn()+'<div><h1>Rainbow trail</h1><p>'+run.horn.length+'/7 horn colors'+'</p><small>Row '+run.room+' · reach ±'+run.reach+' · start Q'+(run.jump+1)+'</small></div></div><div class="map-window"><div class="star-map"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">'+lines+'</svg>'+worlds.flat().map(n=>'<button class="planet difficulty-'+(levelScore(n)<9?0:levelScore(n)<14?1:2)+(pathTaken[n.stage]===n.lane?' visited':'')+'" style="left:'+n.x+'%;top:'+n.y+'%;--piece-a:'+PALETTE[n.pieces[0]]+';--piece-b:'+PALETTE[n.pieces.at(-1)]+'" data-world="'+n.lane+'" '+(reachable(n)?'':'disabled')+' aria-label="Row '+(n.stage+1)+', '+n.theme+', score '+levelScore(n)+', '+n.pieces.map(i=>COLORS[i]).join(' and ')+'"><b>'+n.theme+'</b><small>'+levelScore(n)+(n.challenge?' ★':'')+'</small></button>').join('')+'</div></div><small>★ Two colors · tap for rules.</small></section>';
}
function home(){return '<section class="start"><div class="ship">🦄</div><h1>Carry Quest</h1><p>Build your rainbow unicorn horn.</p><label class="endless"><input type="checkbox" data-endless '+(endless?'checked':'')+'> Unlimited trail <small>Endless levels · three lives</small></label>'+['Easy','Medium','Hard'].map((name,i)=>'<button data-mode="'+i+'"><strong>'+name+'</strong><small>Start '+(i*5)+' · +'+['1','1–2','2–3'][i]+' per level</small></button>').join('')+'<button data-open-insights>Stats</button></section>';}

function scopedInsightsDialog(){
  const user=activeUser(),m=insightScope==='global'?globalMetrics:insightScope==='lifetime'?telemetry.summaryForUser(user.id):telemetry.summaryForRun(run.id);
  return '<div class="backdrop" data-close-insights><section class="sheet" role="dialog" aria-modal="true"><header class="sheet-head"><h2>Learning metrics</h2><button data-close-insights aria-label="Close stats">×</button></header><p>'+escapeHtml(user.username)+' · '+escapeHtml(user.globalUsername)+'</p><nav class="scope-tabs">'+['global','lifetime','run'].map(scope=>'<button data-scope="'+scope+'" class="'+(scope===insightScope?'active':'')+'">'+scope+'</button>').join('')+'</nav><div class="metrics">'+[[m.runs,'runs'],[m.accuracy+'%','accuracy'],[(m.medianMs/1000).toFixed(1)+'s','median solve'],[m.errors,'slips']].map(([value,label])=>'<article><strong>'+value+'</strong><span>'+label+'</span></article>').join('')+'</div><p>'+(globalLoading?'Loading…':insightScope==='global'?escapeHtml(globalProvider.label):'Finished runs only')+'</p><h3>Friction / place value</h3>'+m.friction.map(([name,count])=>'<p>'+escapeHtml(name)+' · '+count+'</p>').join('')+m.places.map(p=>'<p>'+p.place+' · '+p.errors+'/'+p.attempts+'</p>').join('')+'<h3>Run archive</h3><div class="run-list">'+telemetry.runsFor(user.id).slice().reverse().map(r=>'<button data-export-run="'+r.id+'">'+new Date(r.startedAt).toLocaleString()+' · '+r.status+' · '+r.score+' points <b>JSON</b></button>').join('')+'</div><footer class="sheet-footer"><button data-export>Export all JSON</button></footer></section></div>';
}

const bossRule=()=>"Difficulty starts at 6; solved / failed question: + / - "+(7-run.horn.length)+". Minimum 6.";
function levelRules(){return [
  [node.theme,'Operations: +1, −2, ×4; +1 per extra type. Basic + is included.'],
  ['★ '+levelScore(node),(node.boss!=null?'Boss':(operationScore(node.theme)-1)+' mix + '+(node.difficulty-1)+' arithmetic + '+(node.speed-1)+' speed + '+(node.strictness-1)+' strictness + '+(questionCount()-5)+' extra questions')+'. Win points = difficulty − all mistakes.'],
  ['⏱ '+seconds(node.speed)+'s','Per step; +2s for ×. '+(node.stage<3?'Step timer only.':'Problem budget: 80% of steps × step time; never resets.')],
  ['X: '+Math.max(0,allowance(node.strictness)-(overlay==='briefing'?0:mistakes)),'Level mistake pool: '+allowance(node.strictness)+' ('+(overlay==='briefing'?0:mistakes)+' used). Each extra miss or timeout goes back one question.'],
  ['Q '+questionCount(),'Correct: advance one. Below Q1: lose a life. Solve Q'+questionCount()+': win '+(node.boss!=null?'the run.':'the level and choose a perk.')],
  ['↕','Right to left. Carry: swipe ↑ / ↓ by one (0–9); enter the final digit. Follow arrows to borrow.']
].concat(node.boss==null?[]:[['Boss',bossRule()]]);}
const rulesList=()=>'<ol>'+levelRules().map(([icon,rule])=>'<li><b>'+icon+'</b> · '+rule+'</li>').join('')+'</ol>';
function togglePause(){
  if(overlay==='pause'){resumeTimers();overlay=null;render();}
  else if(screen==='battle'&&!locked&&!overlay&&!insights){pausedAt=clock();overlay='pause';render();}
}
function overlayDialog(){
  if(overlay==='pause')return '<div class="backdrop"><section class="reward rules" role="dialog" aria-modal="true" aria-label="Paused"><h2>PAUSED</h2>'+rulesList()+'<button data-pause>Resume</button></section></div>';
  if(overlay==="briefing")return '<div class="backdrop briefing"><section class="reward rules" role="dialog" aria-modal="true"><p>'+node.pieces.map(i=>COLORS[i]).join(' + ')+' horn piece'+(node.challenge?'s · CHALLENGE':'')+'</p><h2>'+node.theme+' · '+levelScore(node)+' points</h2>'+rulesList()+'<div><button data-enter>Enter level · start Q'+(run.jump+1)+'</button><button data-map>Back to map</button></div></section></div>';
  if(overlay==="relic")return '<div class="backdrop perks"><section class="reward" role="dialog" aria-modal="true"><p>LEVEL CLEARED · '+levelScore(node)+' − '+mistakes+' mistakes = '+(levelScore(node)-mistakes)+' points · '+run.hp+'/3 lives</p><h2>Choose a perk</h2><div>'+offered.map((relic,i)=>'<button data-relic="'+relic.id+'"><i>'+(i+1)+'</i><span><strong>'+relic.name+'</strong><small>'+(relic.id==='snack'?'Lives: '+run.hp+'/3 → '+Math.min(3,run.hp+1)+'/3':relic.copy)+'</small></span></button>').join('')+'</div></section></div>';
  if(overlay)return '<div class="backdrop"><section class="result" role="dialog" aria-modal="true">'+horn()+'<h2>'+(overlay==='boss'?'Boss fight':overlay==='win'?'Rainbow victory!':overlay==='lose'?'Out of lives':'Level lost')+'</h2>'+(overlay==='boss'?'<p>10 questions</p><p>'+bossRule()+'</p>':'')+'<p>'+run.hp+' lives · '+run.score+' points</p><button '+(overlay==='boss'?'data-boss':overlay==='failed'?'data-map':'data-restart')+'>'+(overlay==='boss'?'Fight!':overlay==='failed'?'Try another level':'New run')+'</button></section></div>';
  return "";
}

function render(center=false){
  const scroll=center?undefined:document.querySelector(".map-window")?.scrollTop;
  root.innerHTML=`<main class="game-shell ${shake?"shake":""}"><div class="game-frame ${screen==='map'?'map-view':screen==='battle'?'battle-view':''}">
    <header class="topbar"><strong>Carry Quest</strong><button class="insight-button" data-home>Home</button><button class="insight-button" data-sound>${muted?"Sound off":"Sound on"}</button><button class="insight-button" data-open-insights>▥ Insights</button></header>
    ${screen==="map"||screen==="battle"?statusBar():""}
    ${screen==="start"?home():screen==="map"?overworld():`<div class="level-tools"><div class="rule-icons">${levelRules().map(([icon,rule])=>'<span title="'+rule+'">'+icon+'</span>').join('')}</div><button class="pause-button" data-pause ${locked?"disabled":""}>Ⅱ PAUSE</button></div><div class="countdown"><label>Step <small id="total-time"></small><span id="time">${locked?'—':stepSeconds()+'s'}</span></label><progress id="timer" max="${stepSeconds()}" value="${locked?0:stepSeconds()}" aria-label="Step seconds remaining"></progress></div><p class="world-label">${isBoss()?'Boss':'Row '+run.room} · difficulty ${levelScore(node)} · Question ${Math.max(1,Math.min(questionCount(),problemIndex+1))} / ${questionCount()}</p><div class="question-track">${Array.from({length:questionCount()},(_,i)=>'<b class="'+(i===problemIndex?'current':i<problemIndex?'done':'')+'">'+(i+1)+'</b>').join('')}</div>
    ${board()}<div class="prompt ${tone}" aria-live="polite"><strong>${promptFor(work)}</strong><span>${feedback}</span></div>
    <section class="keypad" aria-label="Number pad">${[1,2,3,4,5,6,7,8,9,0].map(digit=>`<button data-digit="${digit}" ${locked?"disabled":""}>${digit}</button>`).join("")}</section>`}
  </div>${insights?scopedInsightsDialog():""}${overlayDialog()}</main>`;
  const map=document.querySelector(".map-window"),planet=document.querySelector(".planet:not(:disabled)");
  if(map&&planet)map.scrollTop=scroll??planet.offsetTop-map.clientHeight/2;
  updateTimer();
}

function begin(){
  work=startProblem(worldProblem(node,attempt++));
  startedAt=stepStartedAt=clock();deadline=startedAt+stepSeconds()*1000;
  let probe=work,steps=0;while(!probe.complete){probe=applyAction(probe,expectedStep(probe)).state;steps++;}
  problemDeadline=node.stage<3?Infinity:startedAt+Math.max(1,steps*.8)*stepSeconds()*1000;
  feedback="Start on the right.";tone="neutral";locked=false;shake=false;
}
function enterLevel(){
  attempt=0;mistakes=0;problemIndex=run.jump;overlay=null;screen="battle";begin();render();
}
function enterBoss(){
  node=tuneLevel({stage:10,theme:"+−×",boss:6,questions:10,seed:run.seed},0);
  attempt=0;mistakes=0;problemIndex=0;overlay=null;screen="battle";begin();render();
}
function updateTimer(){
  if(screen!=="battle"||locked||overlay||insights)return;
  const now=clock(),left=Math.max(0,(deadline-now)/1000),label=document.querySelector('#time'),bar=document.querySelector('#timer'),total=document.querySelector('#total-time');
  if(label)label.textContent=left.toFixed(1)+'s';if(bar)bar.value=left;
  if(total)total.textContent=node.stage<3?'':'Problem: '+Math.max(0,(problemDeadline-now)/1000).toFixed(1)+'s';
  if(!left||now>=problemDeadline)failQuestion('Time ran out.',true);
}
function questionDone(good){
  locked=true;
  record({type:"problem",problemId:work.problem.id,elapsedMs:Math.round(clock()-startedAt),mistakes,correct:good,seed:work.problem.seed,room:run.room});
  const current=work;
  setTimeout(()=>{
    if(screen!=="battle"||work!==current)return;
    if(isBoss())tuneLevel(node,(good?1:-1)*(7-run.horn.length));
    problemIndex+=good?1:-1;
    if(problemIndex<0){run.hp--;overlay=run.hp?'failed':'lose';if(!run.hp)finishRun('lost');}
    else if(problemIndex===questionCount()){
      const points=levelScore(node)-mistakes;run.score+=points;record({type:'level',difficulty:levelScore(node),mistakes,points,room:run.room});
      if(isBoss()){overlay='win';finishRun('won');}
      else{run.horn=[...new Set([...run.horn,...node.pieces])];pathTaken.push(node.lane);offerPerks();overlay='relic';}
    }
    else begin();
    shake=false;render();
  },450);
}
function failQuestion(message,timeout=false){
  if(timeout)mistakes++;
  chime(false);shake=true;feedback=message;tone="bad";questionDone(false);render();
}
function act(action,meta={}){
  if(screen!=="battle"||locked||overlay||insights)return;
  if(clock()>=Math.min(deadline,problemDeadline)){failQuestion('Time ran out.',true);return;}
  const now=clock(),before=expectedStep(work),result=applyAction(work,action),place=before?(before.column<0?"leading":placeName(before.column,work.problem.width)):"complete";
  record({type:result.adjusting?"adjustment":"action",problemId:work.problem.id,phase:work.phase,place,expected:before,actual:action,correct:result.correct,errorCode:result.errorCode??null,latencyMs:Math.round(now-stepStartedAt),seed:work.problem.seed,room:run.room,...meta});
  if(!result.correct){
    mistakes++;if(mistakes>allowance(node.strictness)){failQuestion('Back one question.');return;}
    chime(false);feedback=result.message;tone="bad";shake=true;
    const current=work;setTimeout(()=>{if(work===current){shake=false;render();}},220);
  }else{
    work=result.state;stepStartedAt=now;deadline=now+stepSeconds()*1000;feedback=result.message;tone=result.adjusting?"neutral":"good";if(!result.adjusting)chime(true);
    if(work.complete)questionDone(true);
  }
  render();
}
function offerPerks(){
  const bag=RELICS.filter(r=>r.id!=="jumpstart"||run.jump<3),rng=random(node.seed);
  offered=Array.from({length:3},()=>bag.splice(Math.floor(rng()*bag.length),1)[0]);
}
function chooseRelic(id){
  if(overlay!=="relic"||!offered.some(r=>r.id===id)||id==='jumpstart'&&run.jump===3)return;
  run.perks[id]=(run.perks[id]??0)+1;
  run.reach=id==='pegacorn'?2:1;
  if(id==='snack')run.hp=Math.min(3,run.hp+1);
  if(id==='jumpstart')run.jump++;
  if(id==='hard'||id==='easy'){
    const change=id==='hard'?5:-5;run.roads.push(change);
    worlds.flat().filter(n=>n.stage>=run.room).forEach(n=>tuneLevel(n,change));
  }
  record({type:"perk",perk:id,room:run.room});
  run.room++;if(run.endless&&run.room%10===1)nextMap(run.room-1);overlay=isBoss()?'boss':null;screen="map";
  render();
}

function nextMap(offset=0){
  worlds=makeMap(run.seed,offset,run.mode);
  for(const n of worlds.flat())for(const change of run.roads)tuneLevel(n,change);
}
function restart(){
  finishRun("abandoned");
  const seed=freshSeed(),next=newRun(seed);run=next;runFinished=false;overlay=null;screen="map";nextMap();pathTaken=[];node=null;perkInfo=null;telemetry.startRun({id:next.id,seed});
  record({at:new Date().toISOString(),runId:next.id,type:"run",seed,room:1,mode:run.mode,endless:run.endless});render();
}

function exportTelemetry(){
  downloadJson({product:"Carry Quest",exportedAt:new Date().toISOString(),...telemetry.data},"carry-quest-store.json");
}

function downloadJson(value,name){
  const blob=new Blob([JSON.stringify(value,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),anchor=document.createElement("a");
  anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),500);
}

function exportRun(id){
  const saved=telemetry.data.runs.find(item=>item.id===id);if(saved)downloadJson({schemaVersion:2,product:"Carry Quest",user:telemetry.data.users.find(user=>user.id===saved.userId),run:saved},`carry-quest-${id}.json`);
}

async function loadGlobalMetrics(){
  globalLoading=true;render();
  try{globalMetrics=await globalProvider.load();}catch{globalMetrics=telemetry.summaryGlobal();}
  globalLoading=false;if(insights)render();
}


function resumeTimers(){const pause=clock()-pausedAt;deadline+=pause;problemDeadline+=pause;startedAt+=pause;stepStartedAt+=pause;}
function closeInsights(){resumeTimers();insights=false;render();}

function swipe(direction,meta){
  const step=expectedStep(work);
  if(step?.kind==="swipe")act({kind:"swipe",direction,column:step.column},meta);
}
let drag=null;
function track(event){
  if(!drag||event.pointerId!==drag.id)return;
  const dy=event.clientY-drag.y,dx=event.clientX-drag.x;
  if(Math.abs(dy)>=24&&Math.abs(dy)>Math.abs(dx)*1.2)drag.direction??=dy<0?"up":"down";
}
root.addEventListener("pointerdown",event=>{
  if(!event.isPrimary||event.button!==0||!event.target.closest(".board")||event.target.closest("[data-swipe]")||locked||overlay||insights)return;
  event.preventDefault();root.setPointerCapture(event.pointerId);
  drag={id:event.pointerId,x:event.clientX,y:event.clientY,t:clock(),state:work};
});
root.addEventListener("pointermove",track);
root.addEventListener("pointerup",event=>{
  if(!drag||event.pointerId!==drag.id)return;
  track(event);const current=drag;drag=null;
  if(current.direction&&current.state===work)swipe(current.direction,{distance:Math.round(Math.abs(event.clientY-current.y)),duration:Math.round(clock()-current.t)});
});
for(const type of ["pointercancel","lostpointercapture"])root.addEventListener(type,event=>{if(drag?.id===event.pointerId)drag=null;});
window.addEventListener("resize",()=>{drag=null;render(true);});

root.addEventListener("click",event=>{
  const target=event.target.closest("button,[data-close-insights]");if(!target)return;
  const has=name=>target.matches("[data-"+name+"]");
  if(has("mode")){mode=Number(target.dataset.mode);restart();}
  else if(has("pause"))togglePause();
  else if(has("boss"))enterBoss();
  else if(has("owned")){const r=RELICS.find(r=>r.id===target.dataset.owned);perkInfo=perkInfo===r?null:r;render();}
  else if(has("enter"))enterLevel();
  else if(has("map")){overlay=isBoss()?'boss':null;screen="map";render();}
  else if(has("swipe"))swipe(target.dataset.swipe);
  else if(has("digit"))act({kind:"digit",digit:Number(target.dataset.digit)});
  else if(has("open-insights")){if(overlay==='pause'||screen==='battle'&&locked&&!overlay)return;pausedAt=clock();insights=true;if(insightScope==='global')loadGlobalMetrics();else render();}
  else if(has("close-insights")&&(target===event.target||target.tagName==="BUTTON"))closeInsights();
  else if(has("home")){if(screen==="battle"&&locked&&!overlay)return;finishRun("abandoned");screen="start";overlay=null;render();}
  else if(has("sound")){muted=!muted;render();}
  else if(has("world"))selectWorld(Number(target.dataset.world));
  else if(has("scope")){insightScope=target.dataset.scope;if(insightScope==="global")loadGlobalMetrics();else render();}
  else if(has("relic"))chooseRelic(target.dataset.relic);
  else if(has("restart"))restart();
  else if(has("export"))exportTelemetry();
  else if(has("export-run"))exportRun(target.dataset.exportRun);
});

root.addEventListener("change",event=>{if(event.target.matches("[data-endless]"))endless=event.target.checked;});

window.addEventListener("keydown",event=>{
  if(insights&&event.key==="Escape"){closeInsights();return;}
  if(insights||event.target.matches("input,select,textarea")||event.repeat)return;
  if(event.key==="Escape"||overlay==="pause"&&event.key==="Enter"){event.preventDefault();togglePause();return;}
  if(overlay==='briefing'&&!insights&&(event.key==='Enter'||event.key===String(node.lane+1))){event.preventDefault();enterLevel();return;}
  if(overlay==='boss'&&!insights&&event.key==='Enter'){event.preventDefault();enterBoss();return;}
  if(overlay==="relic"&&/^[1-3]$/.test(event.key)){event.preventDefault();chooseRelic(offered[Number(event.key)-1].id);return;}
  if(screen==='map'&&/^[1-5]$/.test(event.key)){event.preventDefault();selectWorld(Number(event.key)-1);return;}
  if(screen!=="battle")return;
  if(/^[0-9]$/.test(event.key)){act({kind:"digit",digit:Number(event.key)});return;}
  if(event.key==="ArrowUp"||event.key==="ArrowDown"){
    event.preventDefault();swipe(event.key==="ArrowUp"?"up":"down");
  }
});

if("serviceWorker" in navigator&&location.protocol!=="file:")navigator.serviceWorker.register("./sw.js").catch(()=>{});
render();

setInterval(updateTimer,50);
