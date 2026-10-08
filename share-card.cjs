'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const W=1200,H=630;let art;
function crc(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(type,data){const name=Buffer.from(type),size=Buffer.alloc(4),check=Buffer.alloc(4);size.writeUInt32BE(data.length);check.writeUInt32BE(crc(Buffer.concat([name,data])));return Buffer.concat([size,name,data,check]);}
function encode(pixels){const header=Buffer.alloc(13);header.writeUInt32BE(W);header.writeUInt32BE(H,4);header[8]=8;header[9]=6;
 const rows=Buffer.alloc(H*(W*4+1));for(let y=0;y<H;y++)pixels.copy(rows,y*(W*4+1)+1,y*W*4,(y+1)*W*4);
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);}
function load(){if(art)return art;const png=fs.readFileSync(path.join(__dirname,'share-art-v1.png')),parts=[];let height;
 for(let i=8;i<png.length;){const n=png.readUInt32BE(i),type=png.toString('ascii',i+4,i+8),data=png.subarray(i+8,i+8+n);if(type==='IHDR'){if(data.readUInt32BE(0)!==W||data[8]!==8||data[9]!==6)throw Error('Invalid share artwork');height=data.readUInt32BE(4);}if(type==='IDAT')parts.push(data);i+=12+n;}
 const rows=zlib.inflateSync(Buffer.concat(parts)),pixels=Buffer.alloc(W*height*4);for(let y=0;y<height;y++){if(rows[y*(W*4+1)]!==0)throw Error('Invalid share filter');rows.copy(pixels,y*W*4,y*(W*4+1)+1,(y+1)*(W*4+1));}return art=pixels;}
function picture(record,trial=false){const source=load(),pixels=Buffer.from(source.subarray(0,W*H*4));
 function text(value,x,y,size,color,maxWidth=700){const chars=String(value).normalize('NFKD').replace(/[^\x20-\x7e]/g,'').toUpperCase().slice(0,60)||'CATOSHI',scale=Math.min(size/96,maxWidth/(Math.max(1,chars.length)*68)),width=Math.round(100*scale),height=Math.round(144*scale),advance=Math.round(68*scale);
  let dx=x;for(const char of chars){const n=char.charCodeAt(0)-32,sx=n%12*100,sy=630+Math.floor(n/12)*144;
   for(let cy=0;cy<height;cy++)for(let cx=0;cx<width;cx++){const py=y+cy,px=dx+cx;if(px<0||px>=W||py<0||py>=H)continue;
    const a=source[((sy+Math.floor(cy/scale))*W+sx+Math.floor(cx/scale))*4+3]/255;if(a===0)continue;
    const at=(py*W+px)*4;for(let k=0;k<3;k++)pixels[at+k]=Math.round(pixels[at+k]*(1-a)+color[k]*a);pixels[at+3]=255;
   }dx+=advance;
  }
 }
 const cream=[242,239,233],orange=[242,107,53],muted=[141,136,128];
 text(trial?'SPEED TRIAL '+record.level:'VAULT RUN',60,146,26,orange);
 text(record.name||'CATOSHI',60,195,36,cream);
 text(trial?(Number(record.time_ms)/1000).toFixed(3)+'s':Number(record.score||0).toLocaleString('en-US'),54,258,100,orange,710);
 text(trial?record.courseName||'FASTEST LINE':'POINTS',60,388,30,cream);
 text(trial?'REPLAY VERIFIED':Math.round(record.distance||0)+'m / REPLAY VERIFIED',60,449,23,muted);
 return encode(pixels);
}
module.exports={picture};
