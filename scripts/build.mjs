import {cp,mkdir,readFile,rm,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";

const project=fileURLToPath(new URL("../",import.meta.url)),dist=resolve(project,"dist");
await rm(dist,{recursive:true,force:true});
await mkdir(dist,{recursive:true});
await cp(resolve(project,"src"),resolve(dist,"src"),{recursive:true});
await cp(resolve(project,"public"),dist,{recursive:true});
const html=await readFile(resolve(project,"index.html"),"utf8");
await writeFile(resolve(dist,"index.html"),html);
console.log("Built dist/ with no runtime or build dependencies.");
