import fs from 'node:fs';
import {parseOBJ,render} from './lib/render.mjs';
import {encodePNG} from './lib/tex.mjs';
const ROOT='/storage/emulated/0/Documents/fitpulse';
const obj=parseOBJ(fs.readFileSync(ROOT+'/assets/models/gym_trainer_lod.obj','utf8'));
const COL={steel:[0.78,0.79,0.82],rubber:[0.16,0.17,0.19],accent:[0.85,0.62,0.35],leather:[0.55,0.50,0.46]};
const W=720,H=720;const shots=[35,80,125,170,215,260,305,350];
const tiles=[];
for(let i=0;i<8;i++){
  const img=render(obj,W,H,shots[i],18,COL,{zoom:1.55});
  const raw=img instanceof Uint8Array?img:img.data;
  const p=ROOT+'/assets/previews/lod3_'+i+'.png';
  fs.writeFileSync(p,encodePNG(img,W,H));
  tiles.push(img);
  console.log('lod shot',i,fs.statSync(p).size);
}
// 4x2 contact sheet
const SW=360,SH=360,cols=4,rows=2;
const sheet={data:new Uint8Array(cols*SW*rows*SH*4),width:cols*SW,height:rows*SH};
for(let t=0;t<8;t++){
  const cx=(t%cols)*SW,cy=Math.floor(t/cols)*SH;
  const src=tiles[t];
  const sd=src instanceof Uint8Array?src:src.data;
  for(let y=0;y<SH;y++)for(let x=0;x<SW;x++){
    const sx=Math.floor(x*W/SW),sy=Math.floor(y*H/SH);
    const si=(sy*W+sx)*4,di=((cy+y)*sheet.width+(cx+x))*4;
    for(let k=0;k<4;k++)sheet.data[di+k]=sd[si+k];
  }
}
fs.writeFileSync(ROOT+'/assets/previews/lod3_sheet.png',encodePNG(Buffer.from(sheet.data.buffer),sheet.width,sheet.height));
console.log('sheet',fs.statSync(ROOT+'/assets/previews/lod3_sheet.png').size);
