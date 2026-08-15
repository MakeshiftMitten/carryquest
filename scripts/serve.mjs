import {createServer} from "node:http";
import {watch} from "node:fs";
import {readFile,stat} from "node:fs/promises";
import {networkInterfaces} from "node:os";
import {extname,resolve,sep} from "node:path";
import {spawn} from "node:child_process";

const args=new Set(process.argv.slice(2)),host=valueAfter("--host")??"127.0.0.1",port=Number(process.env.PORT??4173),project=resolve(new URL("../",import.meta.url).pathname),root=resolve(project,valueAfter("--root")??"dist"),development=root===project;
const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".svg":"image/svg+xml",".webmanifest":"application/manifest+json",".json":"application/json"};
const liveClients=new Set();let reloadTimer;

function valueAfter(flag){const index=process.argv.indexOf(flag);return index>=0?process.argv[index+1]:null;}
async function exists(path){try{return (await stat(path)).isFile();}catch{return false;}}
function open(url){const command=process.platform==="darwin"?["open",[url]]:process.platform==="win32"?["cmd",["/c","start","",url]]:["xdg-open",[url]];try{spawn(command[0],command[1],{detached:true,stdio:"ignore"}).unref();}catch{}}

if(!await exists(resolve(root,"index.html"))){console.error("dist/index.html is missing. Run npm install && npm run build once.");process.exit(1);}

const server=createServer(async(request,response)=>{
  try{
    const pathname=decodeURIComponent(new URL(request.url,"http://local").pathname),requested=pathname==="/"?"index.html":pathname.replace(/^\/+/,""),path=resolve(root,requested);
    if(development&&pathname==="/__live"){
      response.writeHead(200,{"Content-Type":"text/event-stream","Cache-Control":"no-cache","Connection":"keep-alive"});response.write(": connected\n\n");liveClients.add(response);request.on("close",()=>liveClients.delete(response));return;
    }
    if(path!==root&&!path.startsWith(root+sep)){response.writeHead(403).end("Forbidden");return;}
    const publicPath=development?resolve(project,"public",requested):path,selected=await exists(path)?path:await exists(publicPath)?publicPath:resolve(root,"index.html"),extension=extname(selected);let body=await readFile(selected);
    if(development&&extension===".html")body=Buffer.from(body.toString().replace("</body>",'<script>new EventSource("/__live").onmessage=()=>location.reload()</script></body>'));
    response.writeHead(200,{"Content-Type":types[extension]??"application/octet-stream","Cache-Control":"no-cache"});response.end(body);
  }catch{response.writeHead(500).end("Server error");}
});

if(development){
  const reload=()=>{clearTimeout(reloadTimer);reloadTimer=setTimeout(()=>{for(const client of liveClients)client.write("data: reload\n\n");},45);};
  for(const path of [resolve(project,"src"),resolve(project,"public"),resolve(project,"index.html")])watch(path,reload);
}

server.listen(port,host,()=>{
  const local=`http://localhost:${port}`;console.log(`Carry Quest: ${local}`);
  if(host==="0.0.0.0")try{for(const list of Object.values(networkInterfaces()))for(const address of list??[])if(address.family==="IPv4"&&!address.internal)console.log(`Phone/tablet: http://${address.address}:${port}`);}catch{console.log("Phone/tablet: use this computer's LAN IP with port "+port);}
  if(development)console.log("Live reload: desktop and mobile refresh together.");
  console.log("Press Ctrl+C to stop.");if(args.has("--open"))open(local);
});
