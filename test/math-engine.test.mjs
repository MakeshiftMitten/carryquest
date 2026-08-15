import test from "node:test";
import assert from "node:assert/strict";
import {applyAction,expectedStep,problemForRoom,startProblem} from "../src/math-engine.js";

const apply=(state,action)=>{const result=applyAction(state,action);assert.equal(result.correct,true,result.message);return result.state;};

test("47 + 38 requires the ones answer before its carry",()=>{
  let state=startProblem(problemForRoom(1,0xc0ffee));
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
  let state=startProblem(problemForRoom(4,0xc0ffee));
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

test("leading carry is a separately judged step",()=>{
  const problem={id:"leading",seed:1,top:95,bottom:8,operation:"+",width:2,room:1,mechanic:"carry"};
  let state=startProblem(problem);
  for(const step of [{kind:"digit",digit:3},{kind:"swipe",direction:"up",column:0},{kind:"digit",digit:0}])state=apply(state,step);
  assert.equal(state.phase,"leading");
  assert.equal(applyAction(state,{kind:"digit",digit:0}).errorCode,"wrong_digit");
  state=apply(state,{kind:"digit",digit:1});
  assert.deepEqual(state.answer,[1,0,3]);
});
