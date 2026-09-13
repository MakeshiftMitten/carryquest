import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer} from 'node:net';
import {compactSelectors} from './selectors.mjs';
const compact=compactSelectors((await Promise.all(['style','profiles','world'].map(n=>readFile(new URL('../src/'+n+'.css',import.meta.url),'utf8')))).join('\n'));
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const profile=await mkdtemp(join(tmpdir(),'carry-quest-browser-'));
const server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:String(port)},windowsHide:true,stdio:'ignore'});
const browser=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let socket;
try{
  let debugPort;for(let i=0;i<100&&!debugPort;i++){try{debugPort=Number((await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);}catch{await sleep(100);}}
  assert.ok(debugPort,'Browser started');
  const pages=await(await fetch(`http://127.0.0.1:${debugPort}/json`)).json();socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
  await new Promise(r=>socket.addEventListener('open',r,{once:true}));let id=0;const pending=new Map(),errors=[];
  socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('CDP timeout: '+method)),5000);pending.set(++id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression:compact(expression),awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:360,height:800,deviceScaleFactor:1,mobile:true});
  await send('Page.navigate',{url:`http://127.0.0.1:${port}/`});await sleep(700);
  assert.equal(await evaluate('!!document.querySelector("[data-restart]")'),true);
  await evaluate('document.querySelector("[data-restart]").click()');
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".user-bar")).display'),'none');
  assert.equal(await evaluate('document.querySelectorAll(".planet").length'),50);
  assert.equal(await evaluate('document.querySelectorAll(".planet:not(:disabled)").length'),5);
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  const map=(await send('Page.captureScreenshot')).data;await writeFile(join(profile,'map.png'),Buffer.from(map,'base64'));
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'3',code:'Digit3'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'3',code:'Digit3'});
  assert.match(await evaluate('document.querySelector(".reward").textContent'),/Level mistake pool/);
  assert.ok(await evaluate('parseFloat(getComputedStyle(document.querySelector(".hearts")).fontSize)>=24'));
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'3',code:'Digit3'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'3',code:'Digit3'});
  const count=()=>evaluate('Number(document.querySelector(".world-label").textContent.match(/Question \\d+ \\/ (\\d+)/)[1])');
  const solveQuestion=async()=>{
    await evaluate(`(async()=>{
      const a=Number([...document.querySelectorAll('.operand')].filter(n=>Number(n.dataset.column)>=0).map(n=>n.querySelector('span:last-of-type').textContent).join('')),b=Number([...document.querySelectorAll('.lower-digit')].map(n=>n.textContent).join('')),op=document.querySelector('.operator').textContent,answer=op==='×'?a*b:op==='+'?a+b:a-b;
      if(op==='×'&&(b<1||b>9))throw new Error('Multiplier must be single digit');
      const digits=String(answer).padStart(document.querySelectorAll('.answer').length,'0');
      for(let i=0;i<100&&!document.querySelector('[data-digit]').disabled;i++){
        const target=document.querySelector('.answer-target');
        if(target){const index=[...document.querySelectorAll('.answer')].indexOf(target);document.querySelector('[data-digit="'+digits[index]+'"]').click();}
        else document.body.dispatchEvent(new KeyboardEvent('keydown',{key:document.querySelector('.prompt strong').textContent.includes('↓')?'ArrowDown':'ArrowUp',bubbles:true}));
      }
    })()`);
    await sleep(520);
  };
  await evaluate('document.querySelector("[data-pause]").click()');
  assert.equal(await evaluate('document.querySelectorAll(".rules li").length'),6);
  await writeFile(join(profile,'pause.png'),Buffer.from((await send('Page.captureScreenshot')).data,'base64'));
  await sleep(1500);assert.ok(await evaluate('!!document.querySelector("[aria-label=Paused]")'));
  await evaluate('document.querySelector(".rules [data-pause]").click()');
  await evaluate('document.querySelector("[data-open-insights]").click()');
  assert.equal(await evaluate('document.querySelector(".metrics strong").textContent'),'0');
  assert.equal(await evaluate('document.querySelectorAll("[data-export-run]").length'),0);
  await evaluate('document.querySelector("button[data-close-insights]").click()');
  const firstCount=await count();for(let question=0;question<firstCount;question++)await solveQuestion();
  assert.equal(await evaluate('!!document.querySelector("[data-relic]")'),true);
  assert.equal(await evaluate('document.querySelectorAll("[data-relic]").length'),3);
  assert.match(await evaluate('document.querySelector(".world-label").textContent'),new RegExp('Question '+firstCount+' / '+firstCount));
  const rect=await evaluate('(()=>{const r=document.querySelector(".reward").getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:innerHeight}})()');assert.ok(rect.top>=rect.height/2,JSON.stringify(rect));assert.ok(rect.bottom<=rect.height,JSON.stringify(rect));
  assert.ok(await evaluate('document.querySelector("[data-relic]:last-child").getBoundingClientRect().bottom<=document.querySelector(".reward").getBoundingClientRect().bottom'));
  await writeFile(join(profile,'perks.png'),Buffer.from((await send('Page.captureScreenshot')).data,'base64'));
  const chosen=await evaluate('document.querySelectorAll("[data-relic]")[1].dataset.relic');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'2',code:'Digit2'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'2',code:'Digit2'});
  assert.equal(await evaluate('document.querySelectorAll(".planet:not(:disabled)").length'),chosen==='pegacorn'?5:3);
  await evaluate('document.querySelector("[data-owned='+chosen+']").click()');
  assert.ok(await evaluate('!!document.querySelector(".perk-note")'));
  await evaluate('document.querySelector("[data-owned='+chosen+']").click()');
  for(let row=1;row<10;row++){
    await evaluate('document.querySelector(".planet:not(:disabled)[data-world=\\"2\\"]").click()');
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter'});
    const n=await count(),start=await evaluate('Number(document.querySelector(".world-label").textContent.match(/Question (\\d+)/)[1])-1');for(let q=start;q<n;q++)await solveQuestion();
    assert.equal(await evaluate('document.querySelectorAll("[data-relic]").length'),3);
    await evaluate('document.querySelector("[data-relic]").click()');
  }
  const missing=await evaluate('7-Number(document.querySelector(".horn").getAttribute("aria-label").match(/\\d+/)[0])');
  await evaluate('document.querySelector("[data-boss]").click()');
  const bossDifficulty=await evaluate('Number(document.querySelector(".world-label").textContent.match(/difficulty (\\d+)/)[1])');
  for(let q=0;q<10;q++){
    assert.equal(await evaluate('Number(document.querySelector(".world-label").textContent.match(/difficulty (\\d+)/)[1])'),bossDifficulty+q*missing);
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await solveQuestion();
  }
  assert.match(await evaluate('document.querySelector(".result").textContent'),/Rainbow victory/);
  await evaluate('document.querySelector("[data-open-insights]").click()');
  assert.equal(await evaluate('document.querySelector(".metrics strong").textContent'),'1');
  assert.equal(await evaluate('document.querySelectorAll("[data-export-run]").length'),1);
  assert.deepEqual(errors,[]);
  const artifacts=resolve('browser-check');await import('node:fs/promises').then(m=>m.mkdir(artifacts,{recursive:true}));
  for(const name of ['map.png','perks.png','pause.png'])await writeFile(join(artifacts,name),await readFile(join(profile,name)));
  console.log('Production browser passed: keyboard confirmation, variable level lengths, carry dials, perks, ten boss questions scaled by missing colors, victory, no overflow or JS errors. Screenshots: browser-check/');
  await send('Browser.close').catch(()=>{});
}finally{
  socket?.close();browser.kill();server.kill();await sleep(300);
  if(resolve(profile).startsWith(resolve(tmpdir())+'\\'))await rm(profile,{recursive:true,force:true,maxRetries:3}).catch(()=>{});
}
