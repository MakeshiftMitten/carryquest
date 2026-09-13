import {writeFile} from "node:fs/promises";
import {archive,ZIP_LIMIT} from "./archive.mjs";
const zip=await archive();
if(zip.length>=ZIP_LIMIT||(await archive({standard:true})).length>=ZIP_LIMIT)throw new Error("ZIP must be below 13,000 bytes (optimized and standard compression)");
await writeFile(new URL("../carry-quest.zip",import.meta.url),zip);
console.log(`Created carry-quest.zip (${zip.length} bytes)`);
