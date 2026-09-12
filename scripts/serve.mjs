import {createServer} from "node:http";
import {watch} from "node:fs";
import {readFile,stat} from "node:fs/promises";
import {networkInterfaces} from "node:os";
import {extname,resolve,sep} from "node:path";
import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";

const args=new Set(process.argv.slice(2));
const host=valueAfter("--host")??"127.0.0.1";
const port=Number(process.env.PORT??4173);
const project=fileURLToPath(new URL("../",import.meta.url));
const root=resolve(project,valueAfter("--root")??"dist");
const development=root===resolve(project);
const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".svg":"image/svg+xml",".webmanifest":"application/manifest+json",".json":"application/json"};
const liveClients=new Set();
let reloadTimer,reloadKind="css";

function valueAfter(flag){const index=process.argv.indexOf(flag);return index>=0?process.argv[index+1]:null;}
async function exists(path){try{return (await stat(path)).isFile();}catch{return false;}}
function open(url){
  const command=process.platform==="darwin"?["open",[url]]:process.platform==="win32"?["cmd",["/c","start","",url]]:["xdg-open",[url]];
  try{spawn(command[0],command[1],{detached:true,stdio:"ignore"}).unref();}catch{}
}
function injectDevelopment(html){
  const client=`<script>(()=>{navigator.serviceWorker?.getRegistrations().then(all=>all.forEach(item=>item.unregister()));new EventSource('/__live').onmessage=event=>{if(event.data==='css'){for(const link of document.querySelectorAll('link[rel="stylesheet"]')){const url=new URL(link.href);url.searchParams.set('__reload',Date.now());link.href=url}}else location.reload()}})()</script>`;
  return html.replace("</body>",`${client}</body>`);
}
function mobileAddresses(){
  const addresses=new Set();
  try{for(const list of Object.values(networkInterfaces()))for(const address of list??[])if(address.family==="IPv4"&&!address.internal)addresses.add(address.address);}catch{}
  return [...addresses];
}

if(!Number.isInteger(port)||port<1||port>65535){console.error("PORT must be a number from 1 through 65535.");process.exit(1);}
if(!await exists(resolve(root,"index.html"))){console.error(development?"index.html is missing.":"dist/index.html is missing. Run npm run build once.");process.exit(1);}

const server=createServer(async(request,response)=>{
  try{
    const pathname=decodeURIComponent(new URL(request.url,"http://local").pathname);
    if(development&&pathname==="/__live"){
      response.writeHead(200,{"Content-Type":"text/event-stream","Cache-Control":"no-store","Connection":"keep-alive"});
      response.write(": connected\n\n");
      liveClients.add(response);
      request.on("close",()=>liveClients.delete(response));
      return;
    }
    const requested=pathname==="/"?"index.html":pathname.replace(/^\/+/,"");
    const path=resolve(root,requested);
    if(path!==root&&!path.startsWith(root+sep)){response.writeHead(403).end("Forbidden");return;}
    const publicPath=development?resolve(project,"public",requested):path;
    let selected=await exists(path)?path:await exists(publicPath)?publicPath:null;
    if(!selected&&request.headers.accept?.includes("text/html"))selected=resolve(root,"index.html");
    if(!selected){response.writeHead(404,{"Cache-Control":"no-store"}).end("Not found");return;}
    const extension=extname(selected);
    let body=await readFile(selected);
    if(development&&extension===".html")body=Buffer.from(injectDevelopment(body.toString()));
    response.writeHead(200,{"Content-Type":types[extension]??"application/octet-stream","Cache-Control":development?"no-store":"no-cache","X-Content-Type-Options":"nosniff"});
    response.end(body);
  }catch(error){
    response.writeHead(error instanceof URIError?400:500).end(error instanceof URIError?"Bad URL":"Server error");
  }
});

if(development){
  const reload=(_event,filename)=>{
    if(!String(filename??"").endsWith(".css"))reloadKind="reload";
    clearTimeout(reloadTimer);
    reloadTimer=setTimeout(()=>{
      for(const client of liveClients)client.write(`data: ${reloadKind}\n\n`);
      reloadKind="css";
    },60);
  };
  for(const path of [resolve(project,"src"),resolve(project,"public"),resolve(project,"index.html")])watch(path,reload);
}

server.on("error",error=>{
  if(error.code==="EADDRINUSE")console.error(`Port ${port} is already in use. Stop the other preview or set a different PORT.`);
  else console.error(error.message);
  process.exit(1);
});

server.listen(port,host,()=>{
  const local=`http://localhost:${port}`;
  console.log(`Carry Quest: ${local}`);
  if(host==="0.0.0.0"){
    const addresses=mobileAddresses();
    if(addresses.length)for(const address of addresses)console.log(`Phone/tablet: http://${address}:${port}`);
    else console.log(`Phone/tablet: use this computer's LAN IP with port ${port}.`);
  }
  if(development){
    console.log("Live reload: CSS updates in place; HTML/JS refresh every connected device.");
    console.log("Jump to a room: add ?room=1 through ?room=5 to the URL.");
  }
  console.log("Press Ctrl+C to stop.");
  if(args.has("--open"))open(local);
});
