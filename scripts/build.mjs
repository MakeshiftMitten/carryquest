import {mkdir,readFile,writeFile} from "node:fs/promises";
import {transform} from "esbuild";
import {minify} from "terser";
import {compactSelectors} from "./selectors.mjs";
const root=new URL("../",import.meta.url);
const read=async name=>(await readFile(new URL(name,root),"utf8")).replace(/^\uFEFF/,"");
let html=(await read("index.html")).replace(/\s*<meta name="(?:description|theme-color)"[^>]*>/g,"");
html=html.replace(/>\s+</g,"><").trim();
const styles=(await Promise.all(["style","profiles","world"].map(n=>read(`src/${n}.css`)))).join("\n");
const code=(await Promise.all(["math-engine","telemetry-store","world","main"].map(n=>read(`src/${n}.js`)))).join("\n").replace(/^import .*;\r?\n/gm,"").replace(/^export /gm,"").replace(/^if\("serviceWorker".*$/gm,"");
// Only internal model fields: do not rename DOM properties, dynamic stat keys,
// telemetry fields, or the public metrics-provider contract.
const mangleProps=/^(activeColumn|originalTop|pendingCarry|carryDial|leadingCarry|revision|carries|queue|maxHp|reach|jump|horn|perks|theme|stage|lane|pieces|problem|answer|complete|challenge|adjusting|state|boss|top|bottom|width|operation)$/;
const compact=compactSelectors(styles);
const [{code:css},{code:js}]=await Promise.all([transform(compact(styles),{loader:"css",minify:true}),transform(compact(code),{loader:"js",minify:true,format:"iife",target:"es2022",charset:"utf8",mangleProps})]);
const optimized=await minify(js,{module:true,compress:{passes:3},mangle:true,format:{comments:false}});
html=html.replace(/\s*<link[^>]+>/g,"").replace('</head>',`<style>${css}</style></head>`).replace(/<script[^>]*><\/script>/,()=>`<script type="module">${optimized.code}</script>`);
await mkdir(new URL("dist/",root),{recursive:true});
await writeFile(new URL("dist/index.html",root),html);
console.log("Built self-contained dist/index.html.");
