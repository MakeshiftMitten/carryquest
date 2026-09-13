import test from "node:test";
import assert from "node:assert/strict";
import {applyAction,expectedStep,startProblem} from "../src/math-engine.js";

const apply=(state,action)=>{const result=applyAction(state,action);assert.equal(result.correct,true,result.message);return result.state;};

test("47 + 38 requires the ones answer before its carry",()=>{
  let state=startProblem({top:47,bottom:38,operation:"+",width:2});
  assert.deepEqual(expectedStep(state),{kind:"digit",digit:5,column:1,reason:"answer"});
  assert.equal(applyAction(state,{kind:"swipe",direction:"up",column:0}).errorCode,"unexpected_gesture");
  state=apply(state,{kind:"digit",digit:5});
  assert.deepEqual(expectedStep(state),{kind:"swipe",direction:"up",column:0,reason:"carry"});
  state=apply(state,{kind:"swipe",direction:"up",column:0});
  state=apply(state,{kind:"digit",digit:8});
  assert.equal(state.complete,true);
  assert.deepEqual(state.answer,[null,8,5]);
});

test("302 − 178 enforces every link of the borrow chain",()=>{
  let state=startProblem({top:302,bottom:178,operation:"−",width:3});
  const steps=[
    {kind:"swipe",direction:"down",column:0},
    {kind:"swipe",direction:"up",column:1},
    {kind:"swipe",direction:"down",column:1},
    {kind:"swipe",direction:"up",column:2},
    {kind:"digit",digit:4},{kind:"digit",digit:2},{kind:"digit",digit:1}
  ];
  for(const step of steps)state=apply(state,step);
  assert.equal(state.complete,true);
  assert.deepEqual(state.answer,[null,1,2,4]);
});

test("leading carry must be moved before its digit can be entered",()=>{
  const problem={id:"leading",seed:1,top:95,bottom:8,operation:"+",width:2,room:1,mechanic:"carry"};
  let state=startProblem(problem);
  for(const step of [{kind:"digit",digit:3},{kind:"swipe",direction:"up",column:0},{kind:"digit",digit:0}])state=apply(state,step);
  assert.equal(state.phase,"carry");
  assert.equal(applyAction(state,{kind:"digit",digit:1}).errorCode,"carry_skipped");
  state=apply(state,{kind:"swipe",direction:"up",column:-1});
  assert.equal(state.phase,"leading");
  assert.equal(applyAction(state,{kind:"digit",digit:0}).errorCode,"wrong_digit");
  state=apply(state,{kind:"digit",digit:1});
  assert.deepEqual(state.answer,[1,0,3]);
});

test("9+3 and 3x7 reject typing the answer without moving the final carry",()=>{
  for(const p of [{top:9,bottom:3,operation:'+',ones:2,carry:1},{top:3,bottom:7,operation:'×',ones:1,carry:2}]){
    let state=startProblem({...p,width:1});
    state=apply(state,{kind:'digit',digit:p.ones});
    assert.deepEqual(expectedStep(state),{kind:'swipe',direction:'up',column:-1,reason:'carry'});
    assert.equal(applyAction(state,{kind:'digit',digit:p.carry}).errorCode,'carry_skipped');
    assert.equal(applyAction(state,{kind:'swipe',direction:'up',column:0}).errorCode,'wrong_column');
    for(let i=0;i<p.carry;i++)state=apply(state,{kind:'swipe',direction:'up',column:-1});
    assert.equal(state.leadingCarry,p.carry);
    state=apply(state,{kind:'digit',digit:p.carry});assert.ok(state.complete);
    assert.equal(Number(state.answer.join('')),p.carry*10+p.ones);
  }
});
test("31x7 and 18x7 carry the correct amounts between columns",()=>{
  let state=startProblem({top:31,bottom:7,operation:'×',width:2});
  for(const action of [{kind:'digit',digit:7},{kind:'digit',digit:1},{kind:'swipe',direction:'up',column:-1},{kind:'swipe',direction:'up',column:-1},{kind:'digit',digit:2}])state=apply(state,action);
  assert.deepEqual(state.answer,[2,1,7]);assert.ok(state.complete);
  state=startProblem({top:18,bottom:7,operation:'×',width:2});state=apply(state,{kind:'digit',digit:6});
  assert.equal(state.pendingCarry,5);for(let i=0;i<5;i++)state=apply(state,{kind:'swipe',direction:'up',column:0});
  assert.equal(state.carries[0],5);assert.equal(expectedStep(state).digit,2);
  for(const action of [{kind:'digit',digit:2},{kind:'swipe',direction:'up',column:-1},{kind:'digit',digit:1}])state=apply(state,action);
  assert.deepEqual(state.answer,[1,2,6]);assert.ok(state.complete);
  assert.throws(()=>startProblem({top:31,bottom:12,operation:'×',width:2}),/one digit/);
});
test('a carry of six takes six upward swipes or four downward swipes',()=>{
  for(const direction of ['up','down']){
    let state=startProblem({top:9,bottom:7,operation:'×',width:1});state=apply(state,{kind:'digit',digit:3});
    const count=direction==='up'?6:4;
    for(let i=0;i<count;i++){
      const previous=state,result=applyAction(state,{kind:'swipe',direction,column:-1});state=result.state;
      assert.equal(result.correct,true);assert.equal(state.carryDial,(i+1)*(direction==='up'?1:9)%10);
      if(i<count-1){assert.equal(state.phase,'carry');assert.equal(result.adjusting,true);assert.equal(applyAction(state,{kind:'digit',digit:6}).errorCode,'carry_skipped');}
      assert.equal(previous.answer[0],null);
    }
    assert.equal(state.leadingCarry,6);state=apply(state,{kind:'digit',digit:6});assert.ok(state.complete);
  }
});
