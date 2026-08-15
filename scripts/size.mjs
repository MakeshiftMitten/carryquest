import {readdir,readFile,stat} from "node:fs/promises";
import {gzipSync} from "node:zlib";
import {join,relative} from "node:path";

const root=new URL("../dist/",import.meta.url),limit=13*1024;

async function files(directory){
  const output=[];
  for(const name of await readdir(directory)){
    const path=new URL(name+(name.endsWith("/")?"":""),directory),info=await stat(path);
    if(info.isDirectory())output.push(...await files(new URL(`${name}/`,directory)));else output.push(path);
  }
  return output;
}

let entries;
try{entries=await files(root);}catch{console.error("No dist build found. Run npm run build first.");process.exit(1);}
const rows=[];
for(const file of entries){const bytes=await readFile(file),gzip=gzipSync(bytes,{level:9}).length;rows.push({file:relative(root.pathname,file.pathname),raw:bytes.length,gzip});}
const raw=rows.reduce((sum,row)=>sum+row.raw,0),gzip=rows.reduce((sum,row)=>sum+row.gzip,0);
for(const row of rows.sort((a,b)=>b.gzip-a.gzip))console.log(`${String(row.gzip).padStart(6)} B gzip  ${row.file}`);
console.log(`\n${gzip} B gzip total / ${limit} B budget (${raw} B raw)`);
if(gzip>limit){console.error(`Budget exceeded by ${gzip-limit} B.`);process.exit(1);}
console.log(`${limit-gzip} B remain.`);
