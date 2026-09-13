import test from "node:test";
import assert from "node:assert/strict";
import {makeMap,worldProblem,levelScore,seconds,allowance,tuneLevel,operationScore} from "../src/world.js";
import {startProblem,expectedStep,applyAction} from "../src/math-engine.js";
test("maps and problems replay from seeds and vary across runs",()=>{
  assert.deepEqual(makeMap(123),makeMap(123));
  assert.notDeepEqual(makeMap(123),makeMap(124));
  const node=makeMap(123)[0][0];
  assert.deepEqual(worldProblem(node,0),worldProblem(node,0));
  assert.notDeepEqual(worldProblem(node,0),worldProblem(node,1));
});
test('operation presence and additional questions contribute the exact points',()=>{
  const themes=['+','−','×','+−','+×','−×','+−×'];
  assert.deepEqual(themes.map(operationScore),[1,2,4,4,6,7,9]);
  const counts=new Set();for(let seed=0;seed<50;seed++)for(const n of makeMap(seed).flat()){
    assert.ok(n.questions>=5&&n.questions<=10);counts.add(n.questions);
    assert.equal(levelScore(n),operationScore(n.theme)+n.difficulty+n.speed+n.strictness+n.questions-9);
  }
  assert.equal(counts.size,6);
});
test("difficulty rises each row and a complete rainbow is reachable",()=>{
  assert.deepEqual(Array.from({length:10},(_,i)=>seconds(i+1)),[10,9,8,7,6,5,4,3,2,1]);
  assert.equal(allowance(1),5);assert.equal(allowance(5),0);
  let challenges=0;
  for(let seed=0;seed<100;seed++){
    const map=makeMap(seed);assert.equal(map.length,10);
    let paths=[{lane:2,mask:0}],previousBase=4;
    for(const row of map){
      assert.equal(row.length,5);
      const scores=row.map(n=>levelScore(n)-(n.challenge?2:0));assert.ok(scores.every(s=>s===scores[0]));assert.ok(scores[0]>previousBase);previousBase=scores[0];
      for(const n of row){assert.ok(n.speed>=1&&n.speed<=10);assert.ok(n.difficulty>=1);assert.ok(n.strictness>=1&&n.strictness<=5);assert.equal(n.pieces.length,n.challenge?2:1);if(n.challenge){challenges++;assert.notEqual(...n.pieces);}}
      const next=new Map();for(const p of paths)for(const n of row)if(Math.abs(p.lane-n.lane)<=1){const mask=n.pieces.reduce((m,c)=>m|1<<c,p.mask);next.set(n.lane+':'+mask,{lane:n.lane,mask});}paths=[...next.values()];
    }
    assert.ok(paths.some(p=>p.mask===127),'seed '+seed);
  }
  assert.ok(challenges>0);
});
test("generated arithmetic solves correctly across 100 galaxies",()=>{
  const operations=new Set();
  for(let seed=0;seed<100;seed++)for(const node of makeMap(seed).flat())for(let i=0;i<5;i++){
    const p=worldProblem(node,i);operations.add(p.operation);if(p.operation==='×')assert.ok(p.bottom>=1&&p.bottom<=9);
    let state=startProblem(p),steps=0;
    const wrong=applyAction(state,{kind:"digit",digit:99});assert.equal(wrong.correct,false);assert.equal(wrong.state,state);
    while(!state.complete&&steps++<100)state=applyAction(state,expectedStep(state)).state;
    assert.ok(state.complete);
    assert.equal(Number(state.answer.join("")),p.operation==="+"?p.top+p.bottom:p.operation==="−"?p.top-p.bottom:p.top*p.bottom);
  }
  assert.equal(operations.size,3);
});
test("road and boss difficulty extends beyond 18 with valid arithmetic and timers",()=>{
  for(const delta of [-100,-5,5,35,65])for(const original of makeMap(123).flat()){
    const n=tuneLevel({...original},delta);assert.equal(levelScore(n),Math.max(0,levelScore(original)+delta));
    assert.ok(seconds(n.speed)>=1);assert.ok(allowance(n.strictness)>=0);
    for(let i=0;i<3;i++){
      const p=worldProblem(n,i);if(p.operation==='×')assert.ok(p.bottom>=1&&p.bottom<=9);let s=startProblem(p),steps=0;
      while(!s.complete&&steps++<60)s=applyAction(s,expectedStep(s)).state;
      assert.ok(s.complete);assert.equal(Number(s.answer.join('')),p.operation==='+'?p.top+p.bottom:p.operation==='−'?p.top-p.bottom:p.top*p.bottom);
    }
  }
});

test('presets start at zero, five and ten and progress consistently across endless batches',()=>{
 for(let mode=0;mode<3;mode++)for(let seed=0;seed<20;seed++){
  let previous;
  for(const offset of [0,10,20])for(const row of makeMap(seed,offset,mode)){
   const base=levelScore(row[0])-(row[0].challenge?2:0);
   if(previous===undefined)assert.equal(base,mode*5);
   else assert.ok(mode?base-previous>=mode&&base-previous<=mode+1:base-previous===1);
   assert.ok(row.every(n=>levelScore(n)===base+(n.challenge?2:0)));
   previous=base;
  }
 }
});
