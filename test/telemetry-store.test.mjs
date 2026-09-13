import test from "node:test";
import assert from "node:assert/strict";
import {createGlobalUsername,createTelemetryStore,STORE_KEY,summarize} from "../src/telemetry-store.js";

const memory=initial=>{const values=new Map(Object.entries(initial??{}));return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),value:key=>JSON.parse(values.get(key))};};

test("stores users and isolates lifetime and run metrics",()=>{
  const storage=memory(),store=createTelemetryStore(storage),ada=store.addUser("Ada");
  assert.match(ada.globalUsername,/^ada-[0-9a-f]{8}$/);
  store.startRun({id:"one",seed:1});store.record("one",{type:"action",correct:true,place:"ones"});store.finishRun("one",{status:"won",score:150});
  store.startRun({id:"two",seed:2});store.record("two",{type:"action",correct:false,place:"tens",errorCode:"wrong_digit"});
  const grace=store.addUser("Grace");store.startRun({id:"three",seed:3});store.record("three",{type:"action",correct:true,place:"ones"});
  store.finishRun("two",{status:"lost",score:2});store.finishRun("three",{status:"abandoned",score:0});
  assert.equal(store.summaryForUser(ada.id).runs,2);assert.equal(store.summaryForUser(ada.id).accuracy,50);
  assert.equal(store.summaryForUser(grace.id).runs,1);assert.equal(store.summaryForRun("two").errors,1);assert.equal(store.summaryGlobal().runs,3);
  assert.equal(storage.value(STORE_KEY).runs[0].status,"won");
});

test("migrates legacy flat events into reviewable run JSON",()=>{
  const legacy=[{runId:"old-a",type:"action",correct:true,at:"2025-01-01T00:00:00Z"},{runId:"old-b",type:"problem",elapsedMs:900}];
  const store=createTelemetryStore(memory({"carry-quest-events-v1":JSON.stringify(legacy)}));
  assert.equal(store.data.users[0].username,"Legacy player");assert.match(store.data.users[0].globalUsername,/^lega-[0-9a-f]{8}$/);assert.equal(store.data.runs.length,2);assert.equal(store.data.runs[0].status,"imported");
});

test("upgrades existing profiles with stable global usernames",()=>{
  const storage=memory({[STORE_KEY]:JSON.stringify({schemaVersion:2,users:[{id:"u1",name:"Alexander",createdAt:"now"}],activeUserId:"u1",runs:[]})}),store=createTelemetryStore(storage);
  assert.equal(store.data.users[0].username,"Alexander");assert.match(store.data.users[0].globalUsername,/^alex-[0-9a-f]{8}$/);
  assert.equal(createTelemetryStore(storage).data.users[0].globalUsername,store.data.users[0].globalUsername);
});

test("global usernames avoid supplied collisions",()=>{
  const first=createGlobalUsername("Taylor");assert.match(first,/^tayl-[0-9a-f]{8}$/);assert.notEqual(createGlobalUsername("Taylor",[first]),first);
});

test("summarize returns stable empty metrics",()=>{
  assert.deepEqual(summarize([]),{runs:0,completedRuns:0,problems:0,actions:0,accuracy:0,medianMs:0,errors:0,events:0,friction:[],places:[]});
});

test('active runs stay out of all insights and archives until they end',()=>{
 const storage=memory(),store=createTelemetryStore(storage),user=store.addUser('Player');
 for(const status of ['won','lost','abandoned']){
  const before=store.summaryGlobal();store.startRun({id:status,seed:1});store.record(status,{type:'action',correct:false});
  assert.deepEqual(store.summaryGlobal(),before);assert.deepEqual(store.summaryForUser(user.id),before);
  assert.equal(store.summaryForRun(status).runs,0);assert.equal(store.runsFor(user.id).some(r=>r.id===status),false);
  assert.deepEqual(createTelemetryStore(storage).summaryGlobal(),before);
  store.finishRun(status,{status,score:10});assert.equal(store.summaryForRun(status).runs,1);
  assert.equal(store.summaryGlobal().runs,before.runs+1);assert.equal(store.runsFor(user.id).at(-1).status,status);
 }
});
