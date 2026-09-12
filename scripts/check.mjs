import {access,readFile} from "node:fs/promises";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";

const project=fileURLToPath(new URL("../",import.meta.url)),dist=resolve(project,"dist");
const mustExist=async path=>{try{await access(path);}catch{throw new Error(`Missing build asset: ${path.slice(dist.length+1)}`);}};
const html=await readFile(resolve(dist,"index.html"),"utf8");

if(/(?:src|href)=["']\//.test(html))throw new Error("Root-relative HTML asset found; GitHub Pages project URLs require ./ paths.");
const refs=[...html.matchAll(/(?:src|href)=["'](\.\/[^"']+)["']/g)].map(match=>match[1]);
for(const ref of refs)await mustExist(resolve(dist,ref));

const scripts=refs.filter(ref=>ref.endsWith(".js"));
for(const script of scripts){
  const path=resolve(dist,script),source=await readFile(path,"utf8");
  for(const match of source.matchAll(/(?:from\s*|import\s*)["'](\.[^"']+)["']/g)){
    if(!match[1].endsWith(".js"))throw new Error(`Non-JavaScript module import in ${script}: ${match[1]}`);
    await mustExist(resolve(dirname(path),match[1]));
  }
}

console.log(`Static smoke check passed (${refs.length} linked assets, GitHub Pages-safe paths).`);
