export const STORE_KEY="carry-quest-store-v2";
const LEGACY_KEY="carry-quest-events-v1";

export const uid=prefix=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const emptyStore=()=>({schemaVersion:2,users:[],activeUserId:null,runs:[]});
const guid8=()=>globalThis.crypto?.randomUUID?globalThis.crypto.randomUUID().slice(0,8):Math.floor(Math.random()*0x100000000).toString(16).padStart(8,"0");
export function createGlobalUsername(username,existing=[]){
  const prefix=String(username).trim().toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,4)||"user";
  let value;do value=`${prefix}-${guid8()}`;while(existing.includes(value));return value;
}

export function summarize(runs){
  runs=runs.filter(run=>run.status!=="active");
  const events=runs.flatMap(run=>run.events??[]),actions=events.filter(row=>row.type==="action"),problems=events.filter(row=>row.type==="problem"),errors=actions.filter(row=>row.correct===false);
  const times=problems.map(row=>row.elapsedMs??0).sort((a,b)=>a-b),friction={};
  for(const row of errors)friction[row.errorCode??"unknown"]=(friction[row.errorCode??"unknown"]??0)+1;
  const places=["ones","tens","hundreds","leading"].map(place=>{const rows=actions.filter(row=>row.place===place);return {place,attempts:rows.length,errors:rows.filter(row=>!row.correct).length};}).filter(row=>row.attempts);
  return {runs:runs.length,completedRuns:runs.filter(run=>run.status==="won").length,problems:problems.length,actions:actions.length,accuracy:actions.length?Math.round((actions.length-errors.length)/actions.length*100):0,medianMs:times.length?times[Math.floor(times.length/2)]:0,errors:errors.length,events:events.length,friction:Object.entries(friction).sort((a,b)=>b[1]-a[1]),places};
}

export function createTelemetryStore(storage=localStorage){
  let data=load();
  function load(){
    try{const saved=JSON.parse(storage.getItem(STORE_KEY)??"null");if(saved?.schemaVersion===2&&Array.isArray(saved.users)&&Array.isArray(saved.runs)){let changed=false;for(const user of saved.users){if(!user.username){user.username=user.name??"Player";changed=true;}if(!user.globalUsername){user.globalUsername=createGlobalUsername(user.username,saved.users.map(row=>row.globalUsername).filter(Boolean));changed=true;}}if(changed)persist(saved);return saved;}}catch{}
    const next=emptyStore();
    try{
      const legacy=JSON.parse(storage.getItem(LEGACY_KEY)??"[]");
      if(Array.isArray(legacy)&&legacy.length){
        const user={id:"legacy",username:"Legacy player",globalUsername:createGlobalUsername("Legacy player"),createdAt:new Date().toISOString()},groups=new Map();next.users.push(user);next.activeUserId=user.id;
        for(const event of legacy){const runId=event.runId??"legacy-run";if(!groups.has(runId))groups.set(runId,{id:runId,userId:user.id,seed:event.seed??null,startedAt:event.at??null,endedAt:null,status:"imported",score:null,events:[]});groups.get(runId).events.push(event);}
        next.runs=[...groups.values()];
      }
    }catch{}
    persist(next);return next;
  }
  function persist(value=data){try{storage.setItem(STORE_KEY,JSON.stringify(value));}catch{}}
  function addUser(username){const clean=String(username).trim().slice(0,40);if(!clean)throw new Error("A username is required.");const user={id:uid("user"),username:clean,globalUsername:createGlobalUsername(clean,data.users.map(row=>row.globalUsername)),createdAt:new Date().toISOString()};data.users.push(user);data.activeUserId=user.id;persist();return user;}
  function setActiveUser(id){if(!data.users.some(user=>user.id===id))return false;data.activeUserId=id;persist();return true;}
  function startRun({id,seed,startedAt=new Date().toISOString()}){const record={id,userId:data.activeUserId,seed,startedAt,endedAt:null,status:"active",score:0,events:[]};data.runs.push(record);persist();return record;}
  function record(runId,event){const found=data.runs.find(row=>row.id===runId);if(!found)return;found.events.push({...event,userId:found.userId});persist();}
  function finishRun(runId,{status,score,endedAt=new Date().toISOString()}){const found=data.runs.find(row=>row.id===runId);if(!found)return;found.status=status;found.score=score;found.endedAt=endedAt;persist();}
  const runsFor=userId=>data.runs.filter(run=>run.userId===userId&&run.status!=="active");
  return {get data(){return data;},persist,addUser,setActiveUser,startRun,record,finishRun,runsFor,summaryForUser:userId=>summarize(runsFor(userId)),summaryForRun:runId=>summarize(data.runs.filter(run=>run.id===runId)),summaryGlobal:()=>summarize(data.runs)};
}

export function localGlobalMetricsProvider(store){return {kind:"local",label:"This device",load:async()=>store.summaryGlobal()};}
