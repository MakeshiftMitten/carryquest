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
  const checkMap=async()=>assert.equal(await evaluate(`(()=>{
    const map=document.querySelector('.map-window'),bounds=map.getBoundingClientRect(),planet=document.querySelector('.planet:not(:disabled)').getBoundingClientRect(),horn=document.querySelector('.horn-heading');
    const top=horn.getBoundingClientRect().top,scroll=map.scrollTop;
    if(planet.top<bounds.top||planet.bottom>bounds.bottom||bounds.bottom>innerHeight||document.documentElement.scrollHeight>innerHeight+1)return false;
    map.scrollTop=0;const fixed=horn.getBoundingClientRect().top===top&&scrollY===0;map.scrollTop=scroll;return fixed&&map.scrollHeight>map.clientHeight;
  })()`),true,'Current row visible; only the map scrolls');
  const checkKeypad=async()=>assert.equal(await evaluate(`(()=>{
    const keys=[...document.querySelectorAll('[data-digit]')];
    return keys.length===10&&keys.every(k=>{const r=k.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth&&r.height>=44&&r.width>=44})&&document.documentElement.scrollHeight<=innerHeight+1;
  })()`),true,'All ten keypad buttons fit the viewport at touch size: '+await evaluate(`JSON.stringify({width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollHeight,children:[...document.querySelector('.battle-view').children].map(n=>[n.className,n.getBoundingClientRect().toJSON()])})`));
  await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:360,height:800,deviceScaleFactor:1,mobile:true});
  await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
  await send('Page.navigate',{url:`http://127.0.0.1:${port}/`});await sleep(700);
  assert.equal(await evaluate('document.querySelectorAll("[data-mode]").length'),3);
  assert.equal(await evaluate('!!document.querySelector("[data-login]")'),false);
  await evaluate('document.querySelectorAll("[data-mode]")[1].click()');
  assert.equal(await evaluate('document.querySelectorAll(".planet").length'),50);
  assert.equal(await evaluate('document.querySelectorAll(".planet:not(:disabled)").length'),5);
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  await checkMap();
  for(const [width,height] of [[320,568],[360,800]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await sleep(100);await checkMap();
  }
  const map=(await send('Page.captureScreenshot')).data;await writeFile(join(profile,'map.png'),Buffer.from(map,'base64'));
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'3',code:'Digit3'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'3',code:'Digit3'});
  assert.match(await evaluate('document.querySelector(".reward").textContent'),/Level mistake pool/);
  for(const [width,height] of [[320,568],[800,360],[360,800]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
    assert.equal(await evaluate(`(()=>{const r=document.querySelector('.briefing .reward').getBoundingClientRect(),button=document.querySelector('[data-enter]').getBoundingClientRect();return r.top===0&&r.left===0&&r.width===innerWidth&&r.height===innerHeight&&button.top>=0&&button.bottom<=innerHeight})()`),true,'Full-screen briefing with visible Start button');
  }
  await writeFile(join(profile,'briefing.png'),Buffer.from((await send('Page.captureScreenshot')).data,'base64'));
  assert.ok(await evaluate('parseFloat(getComputedStyle(document.querySelector(".hearts")).fontSize)>=24'));
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'3',code:'Digit3'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'3',code:'Digit3'});
  const count=()=>evaluate('Number(document.querySelector(".world-label").textContent.match(/Question \\d+ \\/ (\\d+)/)[1])');
  await evaluate(`window.__checkColumns=()=>{
    const center=n=>{const range=document.createRange();range.selectNodeContents(n);const r=range.getBoundingClientRect();return r.left+r.width/2};
    const top=[...document.querySelectorAll('.operand')],bottom=[...document.querySelectorAll('.lower-digit')],answer=[...document.querySelectorAll('.answer')];
    for(let i=1;i<top.length;i++){
      const digit=top[i].querySelector('span:last-of-type'),x=center(digit);
      for(const n of [bottom[i-1],answer[i]])if(n.textContent&&Math.abs(center(n)-x)>1)throw new Error('Digit columns misaligned: '+i);
    }
  }`);
  let touched=false;
  const solveQuestion=async()=>{
    await evaluate(`window.__solveNext=(()=>{
      const a=Number([...document.querySelectorAll('.operand')].filter(n=>Number(n.dataset.column)>=0).map(n=>n.querySelector('span:last-of-type').textContent).join('')),b=Number([...document.querySelectorAll('.lower-digit')].map(n=>n.textContent).join('')),op=document.querySelector('.operator').textContent,answer=op==='×'?a*b:op==='+'?a+b:a-b;
      if(op==='×'&&(b<1||b>9))throw new Error('Multiplier must be single digit');
      const digits=String(answer).padStart(document.querySelectorAll('.answer').length,'0');
      return buttons=>{for(let i=0;i<100&&!document.querySelector('[data-digit]').disabled;i++){
        window.__checkColumns();
        const target=document.querySelector('.answer-target');
        if(target){const index=[...document.querySelectorAll('.answer')].indexOf(target);document.querySelector('[data-digit="'+digits[index]+'"]').click();}
        else{const direction=document.querySelector('.prompt strong').textContent.includes('↓')?'down':'up';if(!buttons)return direction;document.querySelector('[data-swipe="'+direction+'"]').click();}
      }};
    })()`);
    const direction=await evaluate('window.__solveNext('+touched+')');
    if(direction){
      const point=await evaluate(`(()=>{const r=document.querySelector('.board').getBoundingClientRect();return {x:r.left+10,y:r.top+r.height/2}})()`),sign=direction==='up'?-1:1;
      const touch=async(type,y)=>send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x:point.x,y,radiusX:2,radiusY:2,id:1}]});
      await touch('touchStart',point.y);await touch('touchMove',point.y+sign*55);await touch('touchMove',point.y-sign*8);await touch('touchEnd');
      touched=true;await evaluate('window.__solveNext(true)');
    }
    await sleep(520);
  };
  await evaluate('document.querySelector("[data-pause]").click()');
  for(const [width,height] of [[320,480],[320,568],[360,640],[390,844],[800,360],[568,320],[360,800]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await sleep(100);
    await checkKeypad();
    await evaluate('window.__checkColumns()');
    await evaluate(`(()=>{
      const track=document.querySelector('.question-track');while(track.children.length<10)track.append(track.firstElementChild.cloneNode(true));
      const perks=document.querySelector('.owned-perks');for(let i=0;i<5;i++)perks.insertAdjacentHTML('beforeend','<button>★<small>10</small></button>');
    })()`);
    await checkKeypad();
    assert.equal(await evaluate(`(()=>{const b=document.querySelector('.board').getBoundingClientRect();return [...document.querySelectorAll('.digit-row,.swipe-buttons button')].every(n=>{const r=n.getBoundingClientRect();return r.top>=b.top&&r.bottom<=b.bottom&&r.left>=b.left&&r.right<=b.right})})()`),true,'Arithmetic rows and backup arrows fit the shrinking board');
    if(height===480||height===320){
      await evaluate('document.querySelector(".backdrop").style.visibility="hidden"');
      await writeFile(join(profile,height===480?'portrait-small.png':'landscape-small.png'),Buffer.from((await send('Page.captureScreenshot')).data,'base64'));
      await evaluate('document.querySelector(".backdrop").style.visibility=""');
    }
  }
  assert.equal(await evaluate('document.querySelectorAll(".rules li").length'),6);
  await writeFile(join(profile,'pause.png'),Buffer.from((await send('Page.captureScreenshot')).data,'base64'));
  await sleep(1500);assert.ok(await evaluate('!!document.querySelector("[aria-label=Paused]")'));
  await evaluate('document.querySelector(".rules [data-pause]").click()');
  await writeFile(join(profile,'battle.png'),Buffer.from((await send('Page.captureScreenshot')).data,'base64'));
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
    await checkMap();
    await evaluate('document.querySelector(".planet:not(:disabled)[data-world=\\"2\\"]").click()');
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter'});
    await checkKeypad();
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
  assert.equal(touched,true,'Real touch swipe outside digits exercised');
  await evaluate('document.querySelector("[data-open-insights]").click()');
  assert.equal(await evaluate('document.querySelector(".metrics strong").textContent'),'1');
  assert.equal(await evaluate('document.querySelectorAll("[data-export-run]").length'),1);
  assert.deepEqual(errors,[]);
  const artifacts=resolve('browser-check');await import('node:fs/promises').then(m=>m.mkdir(artifacts,{recursive:true}));
  for(const name of ['map.png','perks.png','pause.png','briefing.png','battle.png','portrait-small.png','landscape-small.png'])await writeFile(join(artifacts,name),await readFile(join(profile,name)));
  console.log('Production browser passed: all keypad buttons and arithmetic rows fit seven phone viewports, fixed map header and visible rows, full-screen briefings, touch swipe with release wobble, backup arrows, ten levels and boss victory, no overflow or JS errors. Screenshots: browser-check/');
  await send('Browser.close').catch(()=>{});
}finally{
  socket?.close();browser.kill();server.kill();await sleep(300);
  if(resolve(profile).startsWith(resolve(tmpdir())+'\\'))await rm(profile,{recursive:true,force:true,maxRetries:3}).catch(()=>{});
}
