import {applyAction,expectedStep,placeName,problemForRoom,startProblem} from "./math-engine.js";

const ROOMS=["Moss Gate","Echo Cave","Carry Tower","Zero Vault","Citadel"];
const ENEMIES=["Nibble Slime","Tally Bat","Column Golem","Null Wraith","Miscalculator"];
const RELICS=[
  {id:"pencil",icon:"✦",name:"Sharp Pencil",copy:"Perfect solves gain +75 score."},
  {id:"ward",icon:"◇",name:"Margin Ward",copy:"Block the next two mistakes."},
  {id:"snack",icon:"+",name:"Pocket Snack",copy:"Gain a max heart and heal two."}
];
const SEED=0xc0ffee,STORAGE="carry-quest-events-v1",root=document.querySelector("#app");
const clock=()=>globalThis.performance?.now()??0;
const freshSeed=()=>Date.now()>>>0;
const newRun=(seed=SEED)=>({id:`run-${seed.toString(36)}`,seed,room:1,hp:6,maxHp:6,shield:0,bonus:0,score:0});
const requestedRoom=Math.max(1,Math.min(5,Number(new URLSearchParams(location.search).get("room"))||1));

let run={...newRun(),room:requestedRoom},work=startProblem(problemForRoom(requestedRoom,SEED)),mistakes=0,feedback="Start on the right.",tone="neutral",shake=false,hit=false,locked=false,overlay=null,insights=false;
let startedAt=clock(),stepStartedAt=startedAt,events=loadEvents();

function loadEvents(){
  try{const value=JSON.parse(localStorage.getItem(STORAGE)??"[]");return Array.isArray(value)?value:[];}catch{return [];}
}

function record(row){
  events=[...events,row].slice(-5000);
  try{localStorage.setItem(STORAGE,JSON.stringify(events));}catch{}
}

function promptFor(state){
  const expected=expectedStep(state);
  if(!expected)return "PROBLEM CLEARED";
  if(expected.kind==="digit")return expected.reason==="leading"?"FINAL CARRY · ENTER THE NEW DIGIT":`${placeName(expected.column,state.problem.width).toUpperCase()} · ENTER THE RESULT`;
  if(expected.reason==="carry")return "CARRY · FLICK OR PRESS ↑";
  return expected.reason==="borrow-give"?"BORROW · FLICK OR PRESS ↓":"BORROW · FLICK OR PRESS ↑";
}

const hearts=()=>Array.from({length:run.maxHp},(_,index)=>`<span class="${index<run.hp?"full":""}">♥</span>`).join("");

function board(){
  const expected=expectedStep(work),target=expected?.kind==="digit"?(expected.column<0?0:expected.column+1):-1;
  const top=work.top.map((value,column)=>{
    const borrowed=value>=10,shown=borrowed?value-10:value,active=expected?.kind==="swipe"&&expected.column===column;
    return `<button class="operand ${active?"gesture-target":""}" data-column="${column}" aria-label="Top digit ${shown}; flick up to add a small one or down to decrease">${work.carries[column]?`<span class="carry-mark">${work.carries[column]}</span>`:""}${value!==work.originalTop[column]&&!borrowed?`<span class="old-value">${work.originalTop[column]}</span>`:""}${borrowed?'<sup class="borrow-mark">1</sup>':""}<span>${shown}</span>${active?"<i>↕</i>":""}</button>`;
  }).join("");
  const lower=work.bottom.map(digit=>`<span class="lower-digit">${digit}</span>`).join("");
  const answer=work.answer.map((digit,index)=>`<span class="answer ${target===index?"answer-target":""}">${digit??""}</span>`).join("");
  return `<section class="board ${shake?"shake":""}" aria-label="Current arithmetic problem">
    <div class="board-meta"><span>${work.problem.mechanic.replace("-"," ")}</span><span>seed ${work.problem.seed.toString(36).slice(-5)}</span></div>
    <div class="math-stack" style="--count:${work.problem.width+1}">
      <div class="digit-row top-row"><span></span>${top}</div>
      <div class="digit-row lower-row"><b class="operator">${work.problem.operation}</b><span></span>${lower}</div>
      <div class="sum-line"></div><div class="digit-row answer-row">${answer}</div>
    </div>
    <div class="gesture-key"><span><b>↑</b> add small 1</span><span><b>↓</b> decrease</span></div>
  </section>`;
}

function map(){
  return ROOMS.map((name,index)=>{const roomNumber=index+1;return `<div class="${roomNumber<run.room?"done":""} ${roomNumber===run.room?"current":""}"><span>${roomNumber<run.room?"✓":roomNumber}</span><small>${name}</small></div>`;}).join("");
}

function insightsDialog(){
  const actions=events.filter(event=>event.type==="action"),problems=events.filter(event=>event.type==="problem"),errors=actions.filter(event=>event.correct===false),correct=actions.length-errors.length;
  const times=problems.map(event=>event.elapsedMs??0).sort((a,b)=>a-b),median=times.length?times[Math.floor(times.length/2)]:0,counts=new Map();
  errors.forEach(event=>counts.set(event.errorCode??"unknown",(counts.get(event.errorCode??"unknown")??0)+1));
  const friction=[...counts.entries()].sort((a,b)=>b[1]-a[1]);
  const places=["ones","tens","hundreds"].map(place=>{const rows=actions.filter(event=>event.place===place);return {place,attempts:rows.length,errors:rows.filter(event=>!event.correct).length};}).filter(row=>row.attempts);
  return `<div class="backdrop" data-close-insights><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="insight-title">
    <div class="handle"></div><header class="sheet-head"><div><p>LOCAL LEARNING DATA</p><h2 id="insight-title">Where the work sticks</h2></div><button data-close-insights aria-label="Close insights">×</button></header>
    <div class="metrics"><article><strong>${problems.length}</strong><span>problems</span></article><article><strong>${actions.length?Math.round(correct/actions.length*100):0}%</strong><span>step accuracy</span></article><article><strong>${median?`${(median/1000).toFixed(1)}s`:"—"}</strong><span>median solve</span></article><article><strong>${errors.length}</strong><span>slips</span></article></div>
    <div class="insight-section"><div class="section-title"><h3>Top friction</h3><span>mistake events</span></div>${friction.length?friction.map(([name,count])=>`<div class="friction"><strong>${name.replaceAll("_"," ")}</strong><span>${count}</span><i><b style="width:${Math.min(100,count*24)}%"></b></i></div>`).join(""):'<p class="empty">Make a few moves and the sticking points will appear here.</p>'}</div>
    <div class="insight-section"><div class="section-title"><h3>By place value</h3><span>errors / attempts</span></div>${places.map(row=>`<div class="place-row"><strong>${row.place}</strong><span>${row.errors} / ${row.attempts}</span></div>`).join("")}</div>
    <footer class="sheet-footer"><span>${events.length} events on this device · schema v1</span><button data-export>Export JSON</button></footer>
  </section></div>`;
}

function overlayDialog(){
  if(overlay==="relic")return `<div class="backdrop centered"><section class="reward" role="dialog" aria-modal="true"><p>ROOM ${run.room} CLEARED</p><h2>Choose one relic</h2><small>Build the run. Keep the arithmetic fast.</small><div>${RELICS.map(relic=>`<button data-relic="${relic.id}"><i>${relic.icon}</i><span><strong>${relic.name}</strong><small>${relic.copy}</small></span><b>›</b></button>`).join("")}</div></section></div>`;
  if(overlay==="win"||overlay==="lose")return `<div class="backdrop centered"><section class="result" role="dialog" aria-modal="true"><i>${overlay==="win"?"✦":"×"}</i><p>${overlay==="win"?"CITADEL CLEARED":`FELL IN ROOM ${run.room}`}</p><h2>${overlay==="win"?"The sums are safe.":"The run ends here."}</h2><span>Score ${run.score}</span><button data-restart>Start a fresh run</button></section></div>`;
  return "";
}

function render(){
  root.innerHTML=`<main class="game-shell"><div class="game-frame">
    <header class="topbar"><div class="brand"><span>+1</span><div><strong>Carry Quest</strong><small>ARITHMETIC ROGUELITE</small></div></div><button class="insight-button" data-open-insights>▥ Insights</button></header>
    <nav class="map" aria-label="Room ${run.room} of 5">${map()}</nav>
    <section class="battle"><div class="player"><div class="hearts">${hearts()}</div><small>${run.shield?`◇ ${run.shield} · `:""}✦ ${run.score}</small></div><div class="enemy enemy-${run.room} ${hit?"hit":""}" aria-hidden="true"><i class="horn left"></i><i class="horn right"></i><i class="eye left"></i><i class="eye right"></i><i class="mouth"></i></div><div class="enemy-name"><strong>${ENEMIES[run.room-1]}</strong><span>ROOM ${run.room}</span><i><b></b></i></div></section>
    ${board()}<div class="prompt ${tone}" aria-live="polite"><strong>${promptFor(work)}</strong><span>${feedback}</span></div>
    <section class="keypad" aria-label="Number pad">${[1,2,3,4,5,6,7,8,9,0].map(digit=>`<button data-digit="${digit}" ${locked?"disabled":""}>${digit}</button>`).join("")}</section>
    <footer><span>Every step is checked · wrong steps cost a heart</span><span>seed ${run.seed.toString(36)}</span></footer>
  </div>${insights?insightsDialog():""}${overlayDialog()}</main>`;
  bindGestures();
}

function begin(next){
  work=startProblem(problemForRoom(next.room,next.seed));
  startedAt=stepStartedAt=clock();mistakes=0;feedback="New room. Start on the right.";tone="neutral";locked=false;
}

function act(action,meta={}){
  if(locked||overlay||insights)return;
  const now=clock(),before=expectedStep(work),result=applyAction(work,action),place=before?(before.column<0?"leading":placeName(before.column,work.problem.width)):"complete";
  record({at:new Date().toISOString(),runId:run.id,type:"action",problemId:work.problem.id,phase:work.phase,place,expected:before,actual:action,correct:result.correct,errorCode:result.errorCode??null,latencyMs:Math.round(now-stepStartedAt),seed:work.problem.seed,room:run.room,...meta});
  if(!result.correct){
    mistakes+=1;feedback=result.message;tone="bad";shake=true;
    if(run.shield)run={...run,shield:run.shield-1};else run={...run,hp:Math.max(0,run.hp-1)};
    if(!run.hp){locked=true;setTimeout(()=>{overlay="lose";render();},220);}
    render();setTimeout(()=>{shake=false;render();},230);return;
  }
  work=result.state;stepStartedAt=now;feedback=result.message;tone="good";
  if(work.complete){
    locked=true;
    record({at:new Date().toISOString(),runId:run.id,type:"problem",problemId:work.problem.id,elapsedMs:Math.round(now-startedAt),mistakes,seed:work.problem.seed,room:run.room});
    hit=true;run={...run,score:run.score+100+(mistakes===0?50+run.bonus:0)};
    setTimeout(()=>{hit=false;render();},260);
    setTimeout(()=>{overlay=run.room===5?"win":"relic";render();},380);
  }
  render();
}

function chooseRelic(id){
  let next={...run,room:run.room+1};
  if(id==="pencil")next.bonus+=75;
  if(id==="ward")next.shield+=2;
  if(id==="snack"){next.maxHp+=1;next.hp=Math.min(next.maxHp,next.hp+2);}
  record({at:new Date().toISOString(),runId:run.id,type:"perk",perk:id,room:run.room});
  run=next;overlay=null;begin(next);render();
}

function restart(){
  const seed=freshSeed(),next=newRun(seed);run=next;overlay=null;begin(next);
  record({at:new Date().toISOString(),runId:next.id,type:"run",seed,room:1});render();
}

function exportTelemetry(){
  const blob=new Blob([JSON.stringify({schemaVersion:1,product:"Carry Quest",exportedAt:new Date().toISOString(),events},null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),anchor=document.createElement("a");
  anchor.href=url;anchor.download="carry-quest-telemetry.json";anchor.click();setTimeout(()=>URL.revokeObjectURL(url),500);
}

function bindGestures(){
  document.querySelectorAll(".operand").forEach(button=>{
    let start=null;
    button.addEventListener("pointerdown",event=>{start={y:event.clientY,t:clock()};button.setPointerCapture(event.pointerId);});
    button.addEventListener("pointerup",event=>{if(!start)return;const dy=event.clientY-start.y,duration=clock()-start.t;start=null;if(Math.abs(dy)>=24)act({kind:"swipe",direction:dy<0?"up":"down",column:Number(button.dataset.column)},{distance:Math.round(Math.abs(dy)),duration:Math.round(duration)});});
    button.addEventListener("pointercancel",()=>{start=null;});
  });
}

root.addEventListener("click",event=>{
  const target=event.target.closest("button,[data-close-insights]");if(!target)return;
  if(target.matches("[data-digit]"))act({kind:"digit",digit:Number(target.dataset.digit)});
  else if(target.matches("[data-open-insights]")){insights=true;render();}
  else if(target.matches("[data-close-insights]")&&(target===event.target||target.tagName==="BUTTON")){insights=false;render();}
  else if(target.matches("[data-relic]"))chooseRelic(target.dataset.relic);
  else if(target.matches("[data-restart]"))restart();
  else if(target.matches("[data-export]"))exportTelemetry();
});

window.addEventListener("keydown",event=>{
  if(insights&&event.key==="Escape"){insights=false;render();return;}
  if(/^[0-9]$/.test(event.key)){act({kind:"digit",digit:Number(event.key)});return;}
  if(event.key==="ArrowUp"||event.key==="ArrowDown"){
    event.preventDefault();const expected=expectedStep(work),column=expected?.kind==="swipe"?expected.column:Math.max(0,work.activeColumn);
    act({kind:"swipe",direction:event.key==="ArrowUp"?"up":"down",column});
  }
});

if("serviceWorker" in navigator&&location.protocol!=="file:")navigator.serviceWorker.register("./sw.js").catch(()=>{});
render();
