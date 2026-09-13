import assert from "node:assert/strict";
import {createServer} from "node:net";
import {spawn} from "node:child_process";
import {once} from "node:events";
import {fileURLToPath} from "node:url";

const project=fileURLToPath(new URL("../",import.meta.url));
const probe=createServer();
await new Promise((resolve,reject)=>probe.listen(0,"127.0.0.1",resolve).once("error",reject));
const port=probe.address().port;
await new Promise(resolve=>probe.close(resolve));

const child=spawn(process.execPath,["scripts/serve.mjs","--root",".","--host","127.0.0.1"],{
  cwd:project,
  env:{...process.env,PORT:String(port)},
  stdio:["ignore","pipe","pipe"]
});
let output="";
const ready=new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error(`Development server did not start.\n${output}`)),5000);
  const listen=data=>{output+=data;if(output.includes("Press Ctrl+C to stop.")){clearTimeout(timer);resolve();}};
  child.stdout.on("data",listen);
  child.stderr.on("data",listen);
  child.once("exit",code=>{if(code){clearTimeout(timer);reject(new Error(`Development server exited ${code}.\n${output}`));}});
});

try{
  await ready;
  const origin=`http://127.0.0.1:${port}`;
  const page=await fetch(`${origin}/?room=4`);
  assert.equal(page.status,200);
  assert.match(page.headers.get("content-type")??"",/^text\/html/);
  assert.match(await page.text(),/EventSource\('\/__live'\)/);

  const script=await fetch(`${origin}/src/main.js`);
  assert.equal(script.status,200);
  assert.match(script.headers.get("content-type")??"",/^text\/javascript/);
  const source=await script.text();
  assert.doesNotMatch(source,/import\s+["']\.\/style\.css["']/);
  assert.match(source,/Rainbow trail/);
  const world=await fetch(`${origin}/src/world.js`);
  assert.equal(world.status,200);
  assert.match(await world.text(),/export function makeMap/);

  const style=await fetch(`${origin}/src/style.css`);
  assert.equal(style.status,200);
  assert.match(style.headers.get("content-type")??"",/^text\/css/);

  const missing=await fetch(`${origin}/missing.js`,{headers:{accept:"*/*"}});
  assert.equal(missing.status,404);
  console.log("Development server smoke check passed (HTML, JS, CSS, room URL, and 404 behavior). ");
}finally{
  if(child.exitCode===null){child.kill();await Promise.race([once(child,"exit"),new Promise(resolve=>setTimeout(resolve,1000))]);}
}
