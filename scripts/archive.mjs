import {readFile} from "node:fs/promises";
import {deflateAsync} from "@gfx/zopfli";
import {deflateRawSync} from "node:zlib";
export const ZIP_LIMIT=13000;
export async function archive({standard=false}={}){
 const bytes=await readFile(new URL("../dist/index.html",import.meta.url)),name=Buffer.from("index.html");
 const data=standard?deflateRawSync(bytes,{level:6}):Buffer.from(await deflateAsync(bytes,{numiterations:200}));
 let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}crc=(crc^0xffffffff)>>>0;
 const local=Buffer.alloc(30),central=Buffer.alloc(46),end=Buffer.alloc(22);
 local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(8,8);local.writeUInt16LE(33,12);local.writeUInt32LE(crc,14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(bytes.length,22);local.writeUInt16LE(name.length,26);
 central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);local.copy(central,8,6,28);
 const offset=local.length+name.length+data.length;
 end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(central.length+name.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([local,name,data,central,name,end]);
}
