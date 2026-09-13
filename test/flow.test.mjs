import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
async function game(){
 const root={innerHTML:'',setPointerCapture(){},addEventListener:(k,fn)=>handlers[k]=fn},handlers={},timers=[],storage=new Map(),labels={};let now=0;
 const context=vm.createContext({document:{querySelector:s=>s==='#app'?root:labels[s]??={},querySelectorAll:()=>[]},window:{addEventListener:(k,fn)=>handlers[k]=fn},navigator:{},crypto,performance:{now:()=>now},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},setTimeout:fn=>timers.push(fn),setInterval(){}});
 const source=(await Promise.all(['math-engine','telemetry-store','world','main'].map(n=>readFile(new URL(`../src/${n}.js`,import.meta.url),'utf8')))).join('\n').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
 const run=code=>vm.runInContext(code,context),flush=()=>{while(timers.length)timers.shift()();};run(source);
 const key=k=>handlers.keydown({key:k,target:{matches:()=>false},preventDefault(){}});
 const click=(selector,dataset={})=>{const target={dataset,matches:s=>s===selector,closest:()=>target,tagName:'BUTTON'};handlers.click({target});};
 const enter=()=>run('node=worlds[(run.room-1)%10][2];enterLevel()');
 const solve=()=>{let guard=0;while(!run('locked')&&guard++<100)run('act(expectedStep(work))');assert.ok(guard<100);flush();};
 const pointer=(type,{x=100,y=150,id=1,primary=true,button=0,backup=false}={})=>handlers[type]({clientX:x,clientY:y,pointerId:id,isPrimary:primary,button,preventDefault(){},target:{closest:s=>s==='[data-swipe]'?backup:s==='.board'}});
 return {root,run,flush,key,click,enter,solve,pointer,change:checked=>handlers.change({target:{matches:s=>s==="[data-endless]",checked}}),advance:ms=>{now+=ms;run('updateTimer()');}};
}
test('ten rows, perks, and ten-question boss victory',async()=>{
 const g=await game(),{run,root,solve,key}=g;
 assert.doesNotMatch(root.innerHTML,/data-login/);assert.equal((root.innerHTML.match(/data-mode=/g)||[]).length,3);assert.equal(run('telemetry.data.runs.length'),0);
 g.click('[data-open-insights]');assert.match(root.innerHTML,/Learning metrics/);g.key('Escape');
 run('restart()');assert.match(root.innerHTML,/Rainbow trail/);assert.equal(run('worlds[0].length'),5);assert.equal(run('run.hp'),3);
 for(let row=0;row<10;row++){
  g.enter();const start=run('run.jump');assert.equal(run('problemIndex'),start);
  for(let q=start;q<run("questionCount()");q++){assert.equal(run('overlay'),null);solve();}
  assert.equal(run('overlay'),'relic');assert.match(root.innerHTML,/backdrop perks/);
  const before=run('run.horn.length');assert.equal(run('offered.length'),3);key('1');assert.ok(before>=1);
 }
 assert.equal(run('overlay'),'boss');assert.match(root.innerHTML,/Boss fight/);assert.equal(run('telemetry.data.runs.at(-1).status'),'active');
 const initial=6,increment=run('7-run.horn.length');g.click('[data-boss]');assert.equal(run('problemIndex'),0);
 for(let q=0;q<10;q++){assert.equal(run('problemIndex'),q);assert.equal(run('levelScore(node)'),initial+q*increment);solve();}
 assert.equal(run('overlay'),'win');assert.equal(run('levelScore(node)'),initial+10*increment);assert.equal(run('telemetry.data.runs.at(-1).status'),'won');
});
test('level points subtract every mistake, including timeouts, and snack shows lives',async()=>{
 const g=await game(),{run}=g;run('restart()');g.enter();run('node.strictness=1');
 run('act({kind:"digit",digit:99});act({kind:"digit",digit:99})');g.solve();
 g.advance(100000);g.flush();assert.equal(run('mistakes'),3);assert.equal(run('problemIndex'),0);
 const difficulty=run('levelScore(node)');for(let i=0;i<run("questionCount()");i++)g.solve();
 assert.equal(run('run.score'),difficulty-3);assert.equal(run('telemetry.data.runs.at(-1).events.at(-1).points'),difficulty-3);
 run('run.hp=2;offered=[RELICS[0],RELICS[1],RELICS[2]];render()');assert.match(g.root.innerHTML,/Lives: 2\/3/);
 g.click('[data-relic]',{relic:'snack'});assert.equal(run('run.hp'),3);
});
test('road perks change future levels with a valid minimum',async()=>{
 const g=await game(),{run}=g;run('restart()');g.enter();
 const past=run('JSON.stringify(worlds[0])'),before=run('worlds[1].map(levelScore)');
 run('offered=[...RELICS];overlay="relic"');g.click('[data-relic]',{relic:'hard'});assert.equal(run('JSON.stringify(worlds[0])'),past);
 assert.deepEqual(Array.from(run('worlds[1].map(levelScore)')),Array.from(before,n=>n+5));
 run('offered=[...RELICS];overlay="relic"');g.click('[data-relic]',{relic:'easy'});
 run('worlds.flat().forEach(n=>tuneLevel(n,-100))');assert.equal(run('worlds.flat().every(n=>levelScore(n)===0)'),true);

});
test('boss difficulty returns to baseline after a setback and retry',async()=>{
 const g=await game(),{run}=g;run('restart();run.room=11;run.horn=[0,1,2,3];enterBoss()');
 assert.equal(run('levelScore(node)'),6);g.solve();assert.equal(run('levelScore(node)'),9);
 g.advance(100000);g.flush();assert.equal(run('problemIndex'),0);assert.equal(run('levelScore(node)'),6);
 g.advance(100000);g.flush();assert.equal(run('overlay'),'failed');assert.equal(run('run.hp'),2);
 g.click('[data-map]');assert.equal(run('overlay'),'boss');g.click('[data-boss]');assert.equal(run('levelScore(node)'),6);assert.equal(run('problemIndex'),0);
});
test('mistakes are shared across questions, setbacks and three lost lives',async()=>{
 const g=await game(),{run,flush}=g;run('restart()');g.enter();run('node.strictness=1');
 for(let i=0;i<5;i++)run('act({kind:"digit",digit:99})');
 assert.equal(run('locked'),false);assert.equal(run('mistakes'),5);g.solve();assert.equal(run('problemIndex'),1);
 run('act({kind:"digit",digit:99})');flush();assert.equal(run('problemIndex'),0);assert.equal(run('run.hp'),3);
 run('act({kind:"digit",digit:99})');flush();assert.equal(run('run.hp'),2);assert.equal(run('overlay'),'failed');
 for(let life=1;life>=0;life--){g.click('[data-map]');g.enter();run('node.strictness=5;act({kind:"digit",digit:99})');flush();assert.equal(run('run.hp'),life);}
 assert.equal(run('overlay'),'lose');assert.equal(run('telemetry.data.runs.at(-1).status'),'lost');
});
test('per-step timer resets, total timer starts later, stats pause both, timeout moves back',async()=>{
 const g=await game(),{run,flush}=g;run('restart()');g.enter();assert.equal(run('problemDeadline'),Infinity);
 g.advance(100);run('act(expectedStep(work))');assert.equal(run('deadline-stepStartedAt'),run('stepSeconds()*1000'));flush();
 run('node={...node,stage:3,difficulty:5,speed:2};problemIndex=1;begin()');const total=run('problemDeadline'),step=run('deadline');assert.ok(Number.isFinite(total));
 g.click('[data-open-insights]');g.advance(2000);g.key('Escape');assert.equal(run('problemDeadline'),total+2000);assert.equal(run('deadline'),step+2000);
 run('act(expectedStep(work))');assert.equal(run('problemDeadline'),total+2000);
 g.advance(100000);flush();assert.equal(run('problemIndex'),0);assert.equal(run('run.hp'),3);
 const current=run('problemIndex');run('deadline=clock()+10000;problemDeadline=clock()-1;updateTimer()');flush();assert.equal(current,0);assert.equal(run('run.hp'),2);
});
test('snack, next-row reach, jumpstart cap and stale callbacks',async()=>{
 const g=await game(),{run}=g;run('restart()');g.enter();run('run.hp=2;offered=[...RELICS];overlay="relic"');g.click('[data-relic]',{relic:'snack'});assert.equal(run('run.hp'),3);
 run('offered=[...RELICS];overlay="relic";chooseRelic("pegacorn");pathTaken=[2]');assert.equal(run('run.reach'),2);assert.equal(run('worlds[run.room-1].filter(reachable).length'),5);
 run('offered=[...RELICS];overlay="relic";chooseRelic("snack")');assert.equal(run('run.reach'),1);assert.equal(run('worlds[run.room-1].filter(reachable).length'),3);
 run('run.jump=3;offered=[...RELICS];overlay="relic"');g.key('3');assert.equal(run('run.jump'),3);assert.equal(run('overlay'),'relic');g.key('1');
 g.enter();assert.equal(run('problemIndex'),3);run('act({kind:"digit",digit:99});screen="start";restart()');g.flush();assert.equal(run('screen'),'map');assert.equal(run('run.hp'),3);
});
test('map number keys select reachable lanes and owned perk icons show details',async()=>{
 const g=await game(),{run,key,root}=g;run('restart()');
 key('5');assert.equal(run('node.lane'),4);assert.equal(run('overlay'),'briefing');
 g.click('[data-map]');run('run.room=2;pathTaken=[0]');key('5');assert.equal(run('overlay'),null);
 key('2');assert.equal(run('node.lane'),1);g.click('[data-enter]');
 run('offered=[...RELICS];overlay="relic"');key('3');assert.equal(run('run.perks.jumpstart'),1);assert.match(root.innerHTML,/data-owned="jumpstart"/);
 g.click('[data-owned]',{owned:'jumpstart'});assert.match(root.innerHTML,/Jumpstart: Start \+1 question/);
 assert.equal(run('run.jump'),1);g.click('[data-owned]',{owned:'jumpstart'});assert.equal(run('perkInfo'),null);
 run('restart()');assert.equal(run('Object.keys(run.perks).length'),0);
});
test('Enter or the selected lane key confirms the briefing',async()=>{
 for(const confirm of ['Enter','3']){
  const g=await game();g.run('restart()');g.key('3');assert.equal(g.run('overlay'),'briefing');
  g.key('4');assert.equal(g.run('overlay'),'briefing');g.key(confirm);assert.equal(g.run('screen'),'battle');assert.equal(g.run('overlay'),null);assert.equal(g.run('mistakes'),0);
 }
});
test('multiplication gains two seconds for digits and neutral carry adjustments',async()=>{
 const g=await game(),{run}=g;run('restart()');g.enter();
 run('node={...node,theme:"×",speed:10,stage:0};begin();work=startProblem({top:9,bottom:7,operation:"×",width:1,seed:1});render()');
 assert.equal(run('stepSeconds()'),3);assert.equal(run('deadline-startedAt'),3000);
 g.key('3');assert.equal(run('work.phase'),'carry');assert.doesNotMatch(g.root.innerHTML,/CARRY 6/);
 g.key('ArrowUp');assert.equal(run('work.carryDial'),1);assert.equal(run('tone'),'neutral');assert.equal(run('mistakes'),0);assert.equal(run('deadline-stepStartedAt'),3000);
 g.key('ArrowDown');assert.equal(run('work.carryDial'),0);for(let i=0;i<6;i++)g.key('ArrowUp');assert.equal(run('work.phase'),'leading');
 assert.equal(run('telemetry.data.runs.at(-1).events.filter(e=>e.type==="adjustment").length'),7);
});
test('a complete horn keeps the boss at six and setbacks do not cause difficulty drift',async()=>{
 const g=await game(),{run}=g;run('restart();run.room=11;run.horn=[0,1,2,3,4,5,6];enterBoss()');
 for(let i=0;i<10;i++){g.solve();assert.equal(run('levelScore(node)'),6);}assert.equal(run('overlay'),'win');
 run('restart();run.room=11;run.horn=[0,1,2,3];enterBoss()');
 for(let i=0;i<5;i++){g.solve();assert.equal(run('levelScore(node)'),9);g.advance(100000);g.flush();assert.equal(run('levelScore(node)'),6);assert.equal(run('problemIndex'),0);}
});

test('pause explains the rules and freezes timers, inputs and solve latency',async()=>{
 const g=await game(),{run}=g;run('restart()');g.enter();
 run('node={...node,stage:3};begin();render()');assert.match(g.root.innerHTML,/rule-icons/);assert.match(g.root.innerHTML,/PAUSE/);
 const deadlines=Array.from(run('[deadline,problemDeadline,startedAt,stepStartedAt]')),state=run('JSON.stringify(work)');
 g.click('[data-pause]');assert.equal(run('overlay'),'pause');assert.match(g.root.innerHTML,/<ol>/);assert.match(g.root.innerHTML,/Level mistake pool/);
 g.advance(30000);g.key('1');g.key('ArrowUp');assert.equal(run('JSON.stringify(work)'),state);assert.equal(run('mistakes'),0);
 g.key('Enter');assert.equal(run('overlay'),null);assert.deepEqual(Array.from(run('[deadline,problemDeadline,startedAt,stepStartedAt]')),deadlines.map(t=>t+30000));
 g.key('Escape');assert.equal(run('overlay'),'pause');g.click('[data-pause]');assert.equal(run('overlay'),null);
 g.advance(100000);g.click('[data-pause]');assert.equal(run('overlay'),null);g.flush();assert.equal(run('overlay'),'failed');
});

test('three seeded perks remain stable, exclude capped jumpstart and reject unoffered choices',async()=>{
 const g=await game(),{run}=g;run('restart()');g.enter();
 const sequences=new Set();
 for(let seed=0;seed<30;seed++){
  run('node.seed='+seed+';run.jump=0;offerPerks()');const ids=Array.from(run('offered.map(r=>r.id)'));
  assert.equal(ids.length,3);assert.equal(new Set(ids).size,3);sequences.add(ids.join(','));
  run('offerPerks();render()');assert.deepEqual(Array.from(run('offered.map(r=>r.id)')),ids);
  run('run.jump=3;offerPerks()');assert.equal(run('offered.length'),3);assert.equal(run('offered.some(r=>r.id==="jumpstart")'),false);
 }
 assert.ok(sequences.size>5);run('overlay="relic";render()');assert.equal((g.root.innerHTML.match(/data-relic=/g)||[]).length,3);
 const room=run('run.room'),id=run('offered[2].id');run('chooseRelic(RELICS.find(r=>!offered.includes(r)).id)');assert.equal(run('run.room'),room);
 g.key('4');assert.equal(run('overlay'),'relic');g.key('3');assert.equal(run('run.room'),room+1);assert.equal(run('run.perks["'+id+'"]'),1);
});

test('board-wide swipes latch direction, ignore noise, and cancel stale touches',async()=>{
 const g=await game(),{run,pointer}=g;run('restart()');g.enter();
 run('work=startProblem({top:9,bottom:7,operation:"×",width:1});act({kind:"digit",digit:3})');
 pointer('pointerdown');pointer('pointermove',{y:100});pointer('pointerup',{y:170});
 assert.equal(run('work.carryDial'),1,'release wobble must not reverse an upward swipe');
 pointer('pointerdown');pointer('pointermove',{y:200});pointer('pointerup',{y:120});assert.equal(run('work.carryDial'),0);
 for(const gesture of ['short','horizontal','cancel','lost','secondary']){
  pointer('pointerdown');
  if(gesture==='short')pointer('pointermove',{y:145});
  if(gesture==='horizontal')pointer('pointermove',{x:240,y:180});
  if(gesture==='cancel')pointer('pointercancel');
  if(gesture==='lost')pointer('lostpointercapture');
  if(gesture==='secondary')pointer('pointermove',{y:70,id:2,primary:false});
  pointer('pointerup');assert.equal(run('work.carryDial'),0,gesture);
 }
 pointer('pointerdown');pointer('pointerdown',{y:250,id:2,primary:false});pointer('pointercancel',{id:2});pointer('pointerup',{y:100});assert.equal(run('work.carryDial'),1);
 pointer('pointerdown');pointer('pointermove',{y:100});run('begin()');const state=run('JSON.stringify(work)');pointer('pointerup',{y:100});assert.equal(run('JSON.stringify(work)'),state);
 assert.equal(run('mistakes'),0);
});

test('backup arrows operate the required column and board swipes ignore result-entry steps',async()=>{
 const g=await game(),{run,pointer}=g;run('restart()');g.enter();
 run('work=startProblem({top:9,bottom:7,operation:"×",width:1});render()');
 pointer('pointerdown');pointer('pointerup',{y:80});assert.equal(run('mistakes'),0);
 g.key('3');g.click('[data-swipe]',{swipe:'up'});assert.equal(run('work.carryDial'),1);
 pointer('pointerdown',{backup:true});pointer('pointerup',{y:80});assert.equal(run('work.carryDial'),1);
 g.click('[data-swipe]',{swipe:'down'});assert.equal(run('work.carryDial'),0);
 for(let i=0;i<6;i++)g.click('[data-swipe]',{swipe:'up'});assert.equal(run('work.phase'),'leading');
 assert.match(g.root.innerHTML,/data-swipe="up"[^>]+disabled/);
 run('work=startProblem({top:302,bottom:178,operation:"−",width:3})');g.click('[data-swipe]',{swipe:'down'});
 assert.equal(run('work.top[0]'),2);g.click('[data-swipe]',{swipe:'up'});assert.equal(run('work.top[1]'),10);
});

test('difficulty buttons and unlimited checkbox configure a fresh three-life run',async()=>{
 for(let mode=0;mode<3;mode++){
  const g=await game();g.change(true);g.click('[data-mode]',{mode:String(mode)});
  assert.equal(g.run('run.mode'),mode);assert.equal(g.run('run.endless'),true);
  assert.equal(g.run('run.hp'),3);assert.equal(g.run('levelScore(worlds[0][0])'),mode*5);
  g.click('[data-home]');g.change(false);g.click('[data-mode]',{mode:String(mode)});
  assert.equal(g.run('run.endless'),false);
 }
});

test('unlimited crosses two map boundaries with perks, roads and three lives, then records only the ended run',async()=>{
 const g=await game(),{run}=g;g.change(true);g.click('[data-mode]',{mode:'0'});
 for(let row=0;row<21;row++){
  assert.equal(run('overlay'),null);assert.equal(run('run.room'),row+1);
  assert.equal(run('worlds[0][0].stage'),Math.floor(row/10)*10);
  assert.equal(run('worlds.flat().filter(reachable).length'),row?3:5);
  g.enter();assert.equal(run('node.stage'),row);
  for(let q=run('run.jump');q<run('questionCount()');q++)g.solve();
  assert.equal(run('overlay'),'relic');
  assert.equal(run('telemetry.summaryForUser(activeUser().id).runs'),0);
  run('offered=[...RELICS]');g.click('[data-relic]',{relic:row===0?'easy':row===1?'hard':row===2?'jumpstart':'snack'});
  assert.equal(run('run.hp'),3);assert.equal(run('isBoss()'),false);
  if(row===9||row===19){
   assert.ok(run('run.horn.length')>0);assert.equal(run('run.jump'),1);
   assert.equal(run('JSON.stringify(worlds)'),run('JSON.stringify(makeMap(run.seed,run.room-1,run.mode).map(row=>row.map(n=>tuneLevel(tuneLevel(n,-5),5))))'));
  }
 }
 for(let life=2;life>=0;life--){
  g.enter();run('problemIndex=0;node.strictness=5;act({kind:"digit",digit:99})');g.flush();assert.equal(run('run.hp'),life);
  if(life)g.click('[data-map]');
 }
 assert.equal(run('overlay'),'lose');assert.equal(run('telemetry.summaryForUser(activeUser().id).runs'),1);
});
