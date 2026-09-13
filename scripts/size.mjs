import {archive,ZIP_LIMIT} from "./archive.mjs";
for(const standard of [false,true]){
 const size=(await archive({standard})).length;
 console.log((standard?'Standard':'Optimized')+' ZIP: '+size+' bytes; must be below '+ZIP_LIMIT);
 if(size>=ZIP_LIMIT)process.exitCode=1;
}
